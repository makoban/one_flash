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
import { getDraftHTML, deleteDraftHTML, deactivateSite, reactivateSite } from "@/lib/r2";
import { sendSiteCompletionEmail } from "@/lib/email";
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
    // Stripe には200を返す（リトライ防止。エラーはログで追跡）
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// サブスク決済完了 → ドラフトHTML公開 + DB登録 + メール送信
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = session.metadata;
  if (!metadata?.draftId || !metadata?.subdomain) {
    console.error("[webhook/stripe] Missing metadata in session:", session.id);
    return;
  }

  const {
    draftId,
    subdomain,
    siteName = "",
    email: metaEmail = "",
    colorTheme = "simple",
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
    return;
  }

  // --- Step 2: Worker 経由でR2に公開 ---
  const workerUrl = process.env.WORKER_URL;
  const uploadSecret = process.env.UPLOAD_SECRET;

  if (!workerUrl || !uploadSecret) {
    console.error("[webhook/stripe] WORKER_URL or UPLOAD_SECRET not configured");
    return;
  }

  const publishResponse = await fetch(`${workerUrl}/_api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subdomain,
      html,
      secret: uploadSecret,
      formData: { siteName, catchphrase, description, contactInfo, colorTheme },
      email: customerEmail,
    }),
  });

  if (!publishResponse.ok) {
    const errorData = (await publishResponse.json().catch(() => ({}))) as { error?: string };
    console.error(`[webhook/stripe] Publish failed: ${errorData.error ?? publishResponse.statusText}`);
    return;
  }

  console.log(`[webhook/stripe] Site published: ${subdomain}`);

  // --- Step 3: DB登録 ---
  const user = await findOrCreateUser(customerEmail, stripeCustomerId ?? undefined);

  let subscriptionRecord = null;
  if (stripeSubscriptionId) {
    subscriptionRecord = await createSubscription({
      userId: user.id,
      stripeSubscriptionId,
      status: "active",
    });
  }

  await createSite({
    userId: user.id,
    subscriptionId: subscriptionRecord?.id ?? "",
    subdomain,
    siteName,
    inputSnapshot: { siteName, catchphrase, description, contactInfo, colorTheme, email: customerEmail },
  });

  // --- Step 4: ドラフト削除 ---
  await deleteDraftHTML(draftId).catch((err: unknown) =>
    console.warn("[webhook/stripe] Failed to delete draft:", err)
  );

  // --- Step 5: 完了メール送信 ---
  const publicUrl = `${workerUrl}/s/${subdomain}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const revisionUrl = `${appUrl}/revise?subdomain=${subdomain}`;

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
    }
  }

  // --- Step 6: subscribed イベント記録 ---
  await insertAdEvent({
    eventType: "subscribed",
    userId: user.id,
    utmSource: metadata.utm_source,
    utmMedium: metadata.utm_medium,
    utmCampaign: metadata.utm_campaign,
    utmContent: metadata.utm_content,
    utmTerm: metadata.utm_term,
    sessionId: metadata.session_id,
  }).catch((err: unknown) => console.warn("[webhook/stripe] Failed to record ad event:", err));

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
  // Stripe API v2026+ 対応: subscription プロパティへの安全なアクセス
  const invoiceData = invoice as unknown as Record<string, unknown>;
  const subRaw = invoiceData.subscription;
  const subId = typeof subRaw === "string" ? subRaw : (subRaw as { id?: string } | null)?.id ?? null;

  if (!subId) return;

  const existing = await getSubscriptionByStripeId(subId);
  if (!existing) return;

  // 期間情報を更新
  const lines = invoiceData.lines as { data?: Array<{ period?: { start?: number; end?: number } }> } | undefined;
  if (lines?.data?.[0]) {
    const line = lines.data[0];
    await query(
      `UPDATE opf_subscriptions SET
         status = 'active',
         current_period_start = $2,
         current_period_end = $3,
         updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [
        subId,
        line.period?.start ? new Date(line.period.start * 1000) : null,
        line.period?.end ? new Date(line.period.end * 1000) : null,
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
  const invoiceData = invoice as unknown as Record<string, unknown>;
  const subRaw = invoiceData.subscription;
  const subId = typeof subRaw === "string" ? subRaw : (subRaw as { id?: string } | null)?.id ?? null;

  if (!subId) return;

  await updateSubscriptionStatus(subId, "past_due");
  console.warn(`[webhook/stripe] Payment failed for subscription: ${subId}`);
  // TODO: ユーザーへ決済失敗通知メールを送信
}
