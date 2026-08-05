/**
 * API Route: POST /api/webhook/stripe
 *
 * Stripe Webhook を受信してサブスクリプション関連の処理を実行する。
 *
 * 対応イベント:
 *   - checkout.session.completed   → サイト公開 + DB登録 + メール送信
 *   - customer.subscription.updated → サブスク状態更新
 *   - customer.subscription.deleted → サイト非公開化
 *   - invoice.payment_succeeded     → 期間更新
 *   - invoice.payment_failed        → past_due に更新
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  ensureTablesExist,
  findOrCreateUser,
  createSubscription,
  createSite,
  getSubscriptionByStripeId,
  getSiteBySubscriptionId,
  updateSubscriptionStatus,
  updateSiteIsActive,
  query,
  insertAdEvent,
} from "@/lib/db";
import { getDraftHTML, deleteDraftHTML, deactivateSite, getSiteHTML } from "@/lib/r2";
import { sendSiteCompletionEmail, sendPaymentFailureEmail } from "@/lib/email";
import { notifyCustomerError } from "@/lib/slack";
import { isOnePageFlashCheckoutMetadata } from "@/lib/stripe-checkout-ownership.mjs";
import crypto from "crypto";
import type Stripe from "stripe";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// ハンドラー
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Webhook signature verification failed";
    console.error("[webhook/stripe] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log(`[webhook/stripe] Event received: ${event.type} (${event.id})`);

  // テーブルが存在しなければ自動作成
  try {
    await ensureTablesExist();
  } catch (err) {
    console.error("[webhook/stripe] Failed to ensure tables:", err);
  }

  // --- イベント別処理 ---
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[webhook/stripe] Unhandled event type: ${event.type}`);
    }
  } catch (error: unknown) {
    console.error(`[webhook/stripe] Error handling ${event.type}:`, error);
    await notifyCustomerError("webhook/stripe", `イベント処理失敗: ${event.type}`, {
      event_id: event.id,
      error: error instanceof Error ? error.message : String(error),
    });
    // Stripe には200を返す（リトライ防止。エラーはログで追跡）
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ---------------------------------------------------------------------------
// Invoice からサブスクリプションIDを取り出すヘルパー
// Stripe API 2025+ で invoice.subscription が廃止され
// invoice.parent.subscription_details.subscription に移動したため両対応
// ---------------------------------------------------------------------------

function extractSubscriptionId(invoice: Stripe.Invoice): string | null {
  const data = invoice as unknown as Record<string, unknown>;
  const parent = data.parent as
    | { subscription_details?: { subscription?: string | { id?: string } } }
    | undefined;
  const raw = parent?.subscription_details?.subscription ?? data.subscription;
  if (!raw) return null;
  return typeof raw === "string" ? raw : (raw as { id?: string }).id ?? null;
}

// ---------------------------------------------------------------------------
// サブドメイン衝突ガード
// R2 公開は DB 登録より先に行われるため、既存サブドメインと衝突すると
// 既存顧客のサイトを上書き（＆パスワード再生成）してしまう。
// 公開前に空きを確認し、衝突していれば別サブドメインを採番する。
// ---------------------------------------------------------------------------

function generateSubdomainCandidate(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[bytes[i] % chars.length];
  return `site-${s}`;
}

async function isSubdomainTaken(subdomain: string): Promise<boolean> {
  try {
    const html = await getSiteHTML(subdomain);
    // 既存の実サイト / 非公開ページがあれば「使用中」とみなす。
    // ソフト削除プレースホルダのみ再利用可能とする。
    return Boolean(html && html !== "<!-- deleted -->" && html !== "<!-- expired -->");
  } catch {
    // 確認に失敗した場合は公開をブロックしない（false を返す）
    return false;
  }
}

async function ensureFreeSubdomain(preferred: string): Promise<string> {
  if (!(await isSubdomainTaken(preferred))) return preferred;
  console.warn(`[webhook/stripe] Subdomain collision detected: ${preferred}, regenerating`);
  for (let i = 0; i < 5; i++) {
    const candidate = generateSubdomainCandidate();
    if (!(await isSubdomainTaken(candidate))) return candidate;
  }
  // ここに到達するのは事実上あり得ない（衝突が6連続）
  return `${preferred}-${crypto.randomBytes(2).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// サブスク決済完了 → ドラフトHTML公開 + DB登録 + メール送信
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = session.metadata;

  // BANTEX共通Stripeアカウントでは、他サービスのCheckout完了イベントも
  // このWebhookへ届く。OnePage-Flash所有と判定できない決済は正常系として無視する。
  if (!isOnePageFlashCheckoutMetadata(metadata)) {
    console.log(`[webhook/stripe] Ignoring checkout session for another service: ${session.id}`);
    return;
  }

  if (!metadata?.draftId || !metadata?.subdomain) {
    console.error("[webhook/stripe] Missing metadata in session:", session.id);
    await notifyCustomerError("webhook/stripe", "メタデータ不足で公開処理スキップ", {
      session_id: session.id,
    });
    return;
  }

  const {
    draftId,
    subdomain,
    siteName = "",
    email: metaEmail = "",
    colorTheme = "clean-light",
    catchphrase = "",
    contactInfo = "",
    description = "",
  } = metadata;

  const customerEmail = session.customer_details?.email ?? metaEmail;
  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null;

  console.log(`[webhook/stripe] Processing checkout: session=${session.id}, subdomain=${subdomain}`);

  // --- Step 1: ドラフトHTMLを取得 ---
  const html = await getDraftHTML(draftId);
  if (!html) {
    console.error(`[webhook/stripe] Draft not found: ${draftId}`);
    await notifyCustomerError("webhook/stripe", "課金済みだがドラフトHTML未発見", {
      subdomain, draftId, email: customerEmail,
    });
    return;
  }

  // --- Step 2: Worker 経由でR2に公開 ---
  const workerUrl = process.env.WORKER_URL;
  const uploadSecret = process.env.UPLOAD_SECRET;

  if (!workerUrl || !uploadSecret) {
    console.error("[webhook/stripe] WORKER_URL or UPLOAD_SECRET not configured");
    return;
  }

  // 既存サイトとの衝突を避けるため、公開前に空きサブドメインを確定する
  const publishSubdomain = await ensureFreeSubdomain(subdomain);

  const publishResponse = await fetch(`${workerUrl}/_api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subdomain: publishSubdomain,
      html,
      secret: uploadSecret,
      formData: { siteName, catchphrase, description, contactInfo, colorTheme },
      email: customerEmail,
    }),
  });

  if (!publishResponse.ok) {
    const errorData = (await publishResponse.json().catch(() => ({}))) as { error?: string };
    const publishError = errorData.error ?? publishResponse.statusText;
    console.error(`[webhook/stripe] Publish failed: ${publishError}`);
    await notifyCustomerError("webhook/stripe", "課金済みだがサイト公開失敗（R2アップロード）", {
      subdomain: publishSubdomain, email: customerEmail, error: publishError,
    });
    return;
  }

  console.log(`[webhook/stripe] Site published: ${publishSubdomain}`);

  // 衝突で採番し直した場合、/complete ポーリング（check-site-status）が
  // 正しいサブドメインを見つけられるよう session metadata を更新する
  if (publishSubdomain !== subdomain) {
    await stripe.checkout.sessions
      .update(session.id, { metadata: { ...metadata, subdomain: publishSubdomain } })
      .catch((err: unknown) =>
        console.warn("[webhook/stripe] Failed to update session metadata after subdomain change:", err)
      );
  }

  // --- Step 3: DB登録（DB未設定でもサイト公開は成功させる） ---
  let revisionToken: string | null = null;
  try {
    if (process.env.DATABASE_URL) {
      const user = await findOrCreateUser(customerEmail, stripeCustomerId ?? undefined);

      let subscriptionRecord = null;
      if (stripeSubscriptionId) {
        const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const subData = stripeSubscription as unknown as Record<string, unknown>;
        const currentPeriodStart = typeof subData.current_period_start === "number"
          ? new Date((subData.current_period_start as number) * 1000)
          : undefined;
        const currentPeriodEnd = typeof subData.current_period_end === "number"
          ? new Date((subData.current_period_end as number) * 1000)
          : undefined;

        subscriptionRecord = await createSubscription({
          userId: user.id,
          stripeSubscriptionId,
          status: stripeSubscription.status,
          currentPeriodStart,
          currentPeriodEnd,
        });
      }

      const siteRecord = await createSite({
        userId: user.id,
        subscriptionId: subscriptionRecord?.id ?? "",
        subdomain: publishSubdomain,
        siteName,
        inputSnapshot: { siteName, catchphrase, description, contactInfo, colorTheme, email: customerEmail },
      });

      // revision_token を保持（メールURL用）
      revisionToken = siteRecord.revision_token;

      // subscribed イベント記録
      await insertAdEvent({
        eventType: "subscribed",
        userId: user.id,
        utmSource: metadata.utm_source,
        utmMedium: metadata.utm_medium,
        utmCampaign: metadata.utm_campaign,
        utmContent: metadata.utm_content,
        utmTerm: metadata.utm_term,
        gclid: metadata.gclid,
        twclid: metadata.twclid,
        sessionId: metadata.session_id,
      }).catch((err: unknown) => console.warn("[webhook/stripe] Failed to record ad event:", err));

      console.log(`[webhook/stripe] DB records created for ${publishSubdomain}`);
    } else {
      console.warn("[webhook/stripe] DATABASE_URL not set, skipping DB registration");
    }
  } catch (dbErr) {
    console.error("[webhook/stripe] DB registration failed (site still published):", dbErr);
    await notifyCustomerError("webhook/stripe", "DB登録失敗（サイトは公開済み）", {
      subdomain: publishSubdomain, email: customerEmail,
      error: dbErr instanceof Error ? dbErr.message : String(dbErr),
    });
  }

  // --- Step 4: ドラフト削除 ---
  await deleteDraftHTML(draftId).catch((err: unknown) =>
    console.warn("[webhook/stripe] Failed to delete draft:", err)
  );

  // --- Step 5: 完了メール送信 ---
  const publicUrl = `${workerUrl}/s/${publishSubdomain}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const revisionUrl = revisionToken
    ? `${appUrl}/revise?token=${revisionToken}`
    : `${appUrl}/revise?subdomain=${publishSubdomain}`;

  if (customerEmail) {
    try {
      await sendSiteCompletionEmail({
        to: customerEmail,
        siteName,
        publicUrl,
        revisionUrl,
      });
      console.log(`[webhook/stripe] Email sent to ${customerEmail}`);
    } catch (err) {
      console.error("[webhook/stripe] Failed to send email:", err);
      await notifyCustomerError("webhook/stripe", "完了メール送信失敗（サイトは公開済み）", {
        subdomain, email: customerEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(`[webhook/stripe] Checkout completed: ${subdomain} → ${publicUrl}`);
}

// ---------------------------------------------------------------------------
// customer.subscription.updated
// サブスク状態変更（cancel_at_period_end 等）
// ---------------------------------------------------------------------------

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const existing = await getSubscriptionByStripeId(subscription.id);
  if (!existing) {
    console.log(`[webhook/stripe] Subscription not found in DB: ${subscription.id}`);
    return;
  }

  // Stripe API v2026+ ではプロパティ構造が変わる可能性があるため安全にアクセス
  const subData = subscription as unknown as Record<string, unknown>;
  const periodStart = typeof subData.current_period_start === "number"
    ? new Date((subData.current_period_start as number) * 1000)
    : null;
  const periodEnd = typeof subData.current_period_end === "number"
    ? new Date((subData.current_period_end as number) * 1000)
    : null;

  await query(
    `UPDATE opf_subscriptions SET
       status = $2,
       cancel_at_period_end = $3,
       current_period_start = $4,
       current_period_end = $5,
       updated_at = NOW()
     WHERE stripe_subscription_id = $1`,
    [
      subscription.id,
      subscription.status,
      subscription.cancel_at_period_end,
      periodStart,
      periodEnd,
    ]
  );

  console.log(`[webhook/stripe] Subscription updated: ${subscription.id} → ${subscription.status}`);
}

// ---------------------------------------------------------------------------
// customer.subscription.deleted
// サブスク解約完了 → サイト非公開化
// ---------------------------------------------------------------------------

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  // DB: ステータス更新
  await updateSubscriptionStatus(subscription.id, "canceled", new Date());

  // DB: サイトの is_active を false に
  const sub = await getSubscriptionByStripeId(subscription.id);
  if (sub) {
    const site = await getSiteBySubscriptionId(sub.id);
    if (site) {
      await updateSiteIsActive(site.subdomain, false);

      // R2: HTMLをバックアップして「非公開」ページに差し替え
      await deactivateSite(site.subdomain, site.site_name ?? "").catch((err: unknown) =>
        console.error("[webhook/stripe] Failed to deactivate site:", err)
      );

      console.log(`[webhook/stripe] Site deactivated: ${site.subdomain}`);
    }
  }

  console.log(`[webhook/stripe] Subscription deleted: ${subscription.id}`);
}

// ---------------------------------------------------------------------------
// invoice.payment_succeeded
// 月次決済成功 → 期間更新
// ---------------------------------------------------------------------------

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  // サブスクIDを取得（Stripe API 2025+ の新形状に対応）
  const subId = extractSubscriptionId(invoice);
  const invoiceData = invoice as unknown as Record<string, unknown>;

  if (!subId) return;

  const existing = await getSubscriptionByStripeId(subId);
  if (!existing) return;

  // 期間情報を更新
  // 初回請求には初期制作費（単発）と月額（継続）の2行が含まれるため、
  // 継続課金（recurring）の行を優先して期間を採用する。
  const lines = invoiceData.lines as
    | {
        data?: Array<{
          period?: { start?: number; end?: number };
          price?: { recurring?: unknown } | null;
        }>;
      }
    | undefined;
  const lineData = lines?.data ?? [];
  const subLine =
    lineData.find((l) => l.price?.recurring) ??
    lineData.find((l) => l.period?.start && l.period?.end) ??
    lineData[0];
  if (subLine) {
    await query(
      `UPDATE opf_subscriptions SET
         status = 'active',
         current_period_start = $2,
         current_period_end = $3,
         updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [
        subId,
        subLine.period?.start ? new Date(subLine.period.start * 1000) : null,
        subLine.period?.end ? new Date(subLine.period.end * 1000) : null,
      ]
    );
  }

  console.log(`[webhook/stripe] Payment succeeded for subscription: ${subId}`);
}

// ---------------------------------------------------------------------------
// invoice.payment_failed
// 決済失敗 → past_due に更新
// ---------------------------------------------------------------------------

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // サブスクIDを取得（Stripe API 2025+ の新形状に対応）
  const subId = extractSubscriptionId(invoice);

  if (!subId) return;

  await updateSubscriptionStatus(subId, "past_due");
  console.warn(`[webhook/stripe] Payment failed for subscription: ${subId}`);

  // ユーザーへ決済失敗通知メールを送信
  try {
    const sub = await getSubscriptionByStripeId(subId);
    if (sub) {
      const site = await getSiteBySubscriptionId(sub.id);
      if (site) {
        const userResult = await query<{ email: string }>(
          `SELECT email FROM opf_users WHERE id = $1`,
          [site.user_id]
        );
        const email = userResult.rows[0]?.email;
        if (email) {
          // Stripe Billing Portal URL を生成（顧客IDがあれば）
          let billingPortalUrl: string | undefined;
          try {
            const stripeSub = await stripe.subscriptions.retrieve(subId);
            const customerId = typeof stripeSub.customer === "string"
              ? stripeSub.customer
              : stripeSub.customer.id;
            const portalSession = await stripe.billingPortal.sessions.create({
              customer: customerId,
              return_url: process.env.NEXT_PUBLIC_APP_URL ?? "https://oneflash.bantex.jp",
            });
            billingPortalUrl = portalSession.url;
          } catch (portalErr) {
            console.warn("[webhook/stripe] Failed to create billing portal session:", portalErr);
          }

          await sendPaymentFailureEmail({
            to: email,
            siteName: site.site_name ?? site.subdomain,
            billingPortalUrl,
          });
          console.log(`[webhook/stripe] Payment failure email sent to ${email}`);
        }
      }
    }
  } catch (emailErr) {
    console.error("[webhook/stripe] Failed to send payment failure email:", emailErr);
    await notifyCustomerError("webhook/stripe", "決済失敗通知メール送信失敗", {
      subscription_id: subId,
      error: emailErr instanceof Error ? emailErr.message : String(emailErr),
    });
  }
}
