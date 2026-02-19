/**
 * API Route: POST /api/webhook/stripe
 *
 * Stripe Webhook を受信してサイト生成処理を実行する。
 *
 * 処理フロー（checkout.session.completed イベント）:
 *   1. Webhook 署名検証
 *   2. metadata からフォームデータを取り出す
 *   3. Gemini でコンテンツモデレーション
 *   4. モデレーション通過後: Gemini でHTML生成
 *   5. 生成HTMLを R2 に保存
 *   6. DBにサイト情報を記録
 *   7. 完了メール送信
 *
 * 重要: Next.js の bodyParser を無効にする必要がある（生のリクエストボディが必要）
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { geminiModel, moderationModel } from "@/lib/gemini";
import { uploadSiteHTML, getSitePublicUrl } from "@/lib/r2";
import { query } from "@/lib/db";
import { sendSiteCompletionEmail } from "@/lib/email";
import { buildModerationPrompt, parseModerationResponse } from "@/prompts/moderation";
import { buildGeneratorPrompt, parseGeneratorResponse } from "@/prompts/generator";
import type { SiteFormData } from "@/lib/gemini";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Next.js の bodyParser を無効化（Stripe Webhook の署名検証に必須）
// ---------------------------------------------------------------------------
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

  // --- 生のリクエストボディを取得（署名検証に必要） ---
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  // --- Webhook 署名検証 ---
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Webhook signature verification failed";
    console.error("[webhook/stripe] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // --- イベント処理 ---
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // 非同期でサイト生成処理を実行（Webhook はすぐに200を返す）
    // TODO: 本番環境では Vercel Background Functions や Queue を使用すること
    handleSiteGeneration(session).catch((error: unknown) => {
      console.error("[webhook/stripe] Site generation failed:", error);
    });
  }

  // Stripe には即座に 200 を返す（タイムアウト防止）
  return NextResponse.json({ received: true }, { status: 200 });
}

// ---------------------------------------------------------------------------
// サイト生成処理（非同期）
// ---------------------------------------------------------------------------

async function handleSiteGeneration(
  session: import("stripe").Stripe.Checkout.Session
): Promise<void> {
  const metadata = session.metadata;

  if (!metadata) {
    console.error("[webhook/stripe] No metadata in session:", session.id);
    return;
  }

  const customerEmail = session.customer_details?.email ?? "";

  const formData: SiteFormData = {
    siteName: metadata.siteName ?? "",
    catchphrase: metadata.catchphrase ?? "",
    description: metadata.description ?? "",
    contactInfo: metadata.contactInfo ?? "",
    colorTheme: (metadata.colorTheme as SiteFormData["colorTheme"]) ?? "minimal",
    email: metadata.email ?? customerEmail,
    subdomain: metadata.subdomain ?? "",
  };

  // --- Step 1: コンテンツモデレーション ---
  console.log("[webhook/stripe] Starting content moderation for session:", session.id);

  let isSafe = false;
  let moderationReason = "";

  // パースエラー時のリトライ（最大3回）
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const moderationPrompt = buildModerationPrompt(formData);
      const moderationResult = await moderationModel.generateContent(moderationPrompt);
      const moderationText = moderationResult.response.text();

      const parsed = parseModerationResponse(moderationText);
      isSafe = parsed.isSafe;
      moderationReason = parsed.reason;
      break; // パース成功
    } catch (error) {
      console.warn(`[webhook/stripe] Moderation attempt ${attempt} failed:`, error);
      if (attempt === 3) {
        // 3回失敗した場合は安全側に倒す（生成しない）
        console.error("[webhook/stripe] Moderation failed after 3 attempts, skipping generation");
        // TODO: 管理者にアラートメール送信
        return;
      }
    }
  }

  if (!isSafe) {
    console.warn(
      `[webhook/stripe] Content moderation failed for session ${session.id}: ${moderationReason}`
    );
    // TODO: ユーザーに審査NG通知メール送信 + 返金処理
    return;
  }

  // --- Step 2: HTML 生成 ---
  console.log("[webhook/stripe] Starting HTML generation for session:", session.id);

  let generatedHtml = "";

  // パースエラー時のリトライ（最大3回）
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const generatorPrompt = buildGeneratorPrompt(formData);
      const generationResult = await geminiModel.generateContent(generatorPrompt);
      const rawHtml = generationResult.response.text();

      generatedHtml = parseGeneratorResponse(rawHtml);
      break; // 成功
    } catch (error) {
      console.warn(`[webhook/stripe] Generation attempt ${attempt} failed:`, error);
      if (attempt === 3) {
        console.error("[webhook/stripe] HTML generation failed after 3 attempts");
        // TODO: 管理者にアラートメール送信
        return;
      }
    }
  }

  // --- Step 3: スラッグ生成 & R2 に保存 ---
  const slug = generateSlug();
  console.log("[webhook/stripe] Uploading HTML to R2 with slug:", slug);

  await uploadSiteHTML(slug, generatedHtml);

  // --- Step 4: DB にサイト情報を記録 ---
  const revisionToken = crypto.randomUUID();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const siteDomain = process.env.SITE_DOMAIN ?? "info-page.jp";

  // TODO: sites テーブルが作成されたら以下のクエリを有効化
  await query(
    `INSERT INTO sites (slug, site_name, email, revision_token, revision_count, stripe_session_id, color_theme, site_domain)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      slug,
      formData.siteName,
      customerEmail,
      revisionToken,
      0,
      session.id,
      formData.colorTheme,
      siteDomain,
    ]
  );

  // --- Step 5: 完了メール送信 ---
  const publicUrl = getSitePublicUrl(slug);
  const revisionUrl = `${appUrl}/revise?token=${revisionToken}`;

  if (customerEmail) {
    await sendSiteCompletionEmail({
      to: customerEmail,
      siteName: formData.siteName,
      publicUrl,
      revisionUrl,
      freeRevisionsRemaining: 2,
    });
  }

  console.log(
    `[webhook/stripe] Site generation completed. slug: ${slug}, url: ${publicUrl}`
  );
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

/**
 * ランダムなサイトスラッグを生成する（英数字8文字）
 */
function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}
