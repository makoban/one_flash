/**
 * API Route: POST /api/create-checkout-session
 *
 * Stripe Checkout セッションを作成してチェックアウトURLを返す。
 * フォームデータは Stripe Checkout の metadata に含めて Webhook に渡す。
 *
 * フロー:
 *   1. フロントエンドからフォームデータを受け取る
 *   2. 入力バリデーション
 *   3. Stripe Checkout セッション作成
 *   4. チェックアウトURL を返す
 *   5. Webhook（stripe/route.ts）で決済完了後の処理を実行
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe, PRICE_AMOUNT, CURRENCY } from "@/lib/stripe";
import type { SiteFormData } from "@/lib/gemini";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface CreateCheckoutRequestBody {
  formData: SiteFormData;
}

// ---------------------------------------------------------------------------
// ハンドラー
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CreateCheckoutRequestBody;
    const { formData } = body;

    // --- バリデーション ---
    const validationError = validateFormData(formData);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // --- Stripe Checkout セッション作成 ---
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: "OnePage-Flash - ホームページ作成",
              description: `「${formData.siteName}」のホームページを作成します`,
            },
            unit_amount: PRICE_AMOUNT,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // 決済成功後・キャンセル時のリダイレクト先
      success_url: `${appUrl}/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/create`,
      // フォームデータを metadata に含める（Webhook で参照）
      metadata: {
        siteName: formData.siteName,
        catchphrase: formData.catchphrase,
        // description は255文字制限があるため最初の500文字のみ（Stripeの制限）
        description: formData.description.substring(0, 500),
        contactInfo: formData.contactInfo,
        colorTheme: formData.colorTheme,
      },
      // TODO: メールアドレス収集（Stripe Checkout で収集するか、フォームで事前収集するか）
      // customer_email: formData.email,
    });

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
  if (!formData) {
    return "formData is required";
  }

  if (!formData.siteName || formData.siteName.trim().length === 0) {
    return "サイト名は必須です";
  }

  if (formData.siteName.length > 100) {
    return "サイト名は100文字以内で入力してください";
  }

  if (!formData.catchphrase || formData.catchphrase.trim().length === 0) {
    return "キャッチコピーは必須です";
  }

  if (formData.catchphrase.length > 200) {
    return "キャッチコピーは200文字以内で入力してください";
  }

  if (!formData.description || formData.description.trim().length === 0) {
    return "本文・説明は必須です";
  }

  if (!formData.contactInfo || formData.contactInfo.trim().length === 0) {
    return "連絡先情報は必須です";
  }

  if (!["minimal", "business", "casual"].includes(formData.colorTheme)) {
    return "カラーテーマの選択が無効です";
  }

  return null;
}
