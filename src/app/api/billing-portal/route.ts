/**
 * API Route: POST /api/billing-portal
 *
 * Stripe Billing Portal セッションを作成する。
 * ユーザーが請求履歴の確認・支払い方法の変更・サブスク解約を行えるポータルへリダイレクトする。
 *
 * Request:  { email: string }
 * Response: { url: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { email?: string };
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    // email から Stripe Customer を検索
    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: "この メールアドレスに紐づくアカウントが見つかりません" },
        { status: 404 }
      );
    }

    const customerId = customers.data[0].id;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Billing Portal セッション作成
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/edit`,
    });

    return NextResponse.json({ url: portalSession.url }, { status: 200 });
  } catch (error: unknown) {
    console.error("[billing-portal] Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
