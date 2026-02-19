/**
 * API Route: POST /api/create-checkout-session
 *
 * Stripe Checkout セッション（サブスクリプション）を作成する。
 *
 * フロー:
 *   1. フロントエンドからフォームデータ + 生成済みHTMLを受け取る
 *   2. HTMLをR2のドラフト領域に一時保存
 *   3. Stripe Checkout Session (mode: subscription) を作成
 *   4. チェックアウトURLを返す
 *   5. 決済完了後は Webhook (stripe/route.ts) がドラフトを本公開する
 *
 * 料金体系:
 *   - 初期制作費 ¥1,980（一回のみ・初回請求に含む）
 *   - 月額利用料 ¥380/月（毎月自動課金）
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe, INITIAL_FEE, MONTHLY_FEE, CURRENCY } from "@/lib/stripe";
import { uploadDraftHTML } from "@/lib/r2";
import type { SiteFormData } from "@/lib/gemini";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface CreateCheckoutRequestBody {
  formData: SiteFormData;
  html: string;
  utm?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  };
  sessionId?: string;
}

// ---------------------------------------------------------------------------
// ハンドラー
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CreateCheckoutRequestBody;
    const { formData, html, utm, sessionId } = body;

    // --- バリデーション ---
    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "html is required" }, { status: 400 });
    }

    const validationError = validateFormData(formData);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // --- HTML をドラフトとして R2 に一時保存 ---
    const draftId = crypto.randomUUID();
    await uploadDraftHTML(draftId, html);
    console.log(`[create-checkout-session] Draft saved: ${draftId}`);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // --- Stripe Checkout セッション作成（サブスクリプション） ---
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        // 初期制作費（一回のみ・初回請求に含む）
        {
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: "OnePage-Flash 初期制作費",
              description: `「${formData.siteName}」のホームページ制作`,
            },
            unit_amount: INITIAL_FEE,
          },
          quantity: 1,
        },
        // 月額利用料（毎月自動課金）
        {
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: "OnePage-Flash 月額利用料",
              description: "ホームページ公開・維持費",
            },
            unit_amount: MONTHLY_FEE,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${appUrl}/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/create`,
      customer_email: formData.email || undefined,
      metadata: {
        draftId,
        subdomain: formData.subdomain,
        siteName: formData.siteName,
        email: formData.email,
        colorTheme: formData.colorTheme,
        catchphrase: formData.catchphrase,
        contactInfo: formData.contactInfo,
        description: formData.description.substring(0, 500),
        ...(utm?.utm_source && { utm_source: utm.utm_source }),
        ...(utm?.utm_medium && { utm_medium: utm.utm_medium }),
        ...(utm?.utm_campaign && { utm_campaign: utm.utm_campaign }),
        ...(utm?.utm_content && { utm_content: utm.utm_content }),
        ...(utm?.utm_term && { utm_term: utm.utm_term }),
        ...(sessionId && { session_id: sessionId }),
      },
    });

    console.log(`[create-checkout-session] Session created: ${session.id}`);
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error: unknown) {
    console.error("[create-checkout-session] Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// バリデーション関数
// ---------------------------------------------------------------------------

function validateFormData(formData: SiteFormData | undefined): string | null {
  if (!formData) return "formData is required";
  if (!formData.siteName || formData.siteName.trim().length === 0) return "siteName is required";
  if (!formData.subdomain || formData.subdomain.trim().length === 0) return "subdomain is required";
  if (!formData.email || formData.email.trim().length === 0) return "email is required";
  if (!formData.catchphrase || formData.catchphrase.trim().length === 0) return "catchphrase is required";
  if (!formData.description || formData.description.trim().length === 0) return "description is required";
  if (!formData.contactInfo || formData.contactInfo.trim().length === 0) return "contactInfo is required";
  if (!["simple", "colorful", "business"].includes(formData.colorTheme)) return "Invalid colorTheme";
  return null;
}
