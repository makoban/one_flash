/**
 * API Route: POST /api/admin/confirm-payment
 *
 * ココナラ顧客の課金確認 → 有効期限35日延長 + ログ記録。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureTablesExist,
  query,
  extendSubscriptionExpiry,
  insertPaymentLog,
} from "@/lib/db";
import type { OpfSubscriptionRow } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { pw, subscriptionId, amount, memo } = body;

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || pw !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!subscriptionId) {
    return NextResponse.json({ error: "Missing subscriptionId" }, { status: 400 });
  }

  try {
    await ensureTablesExist();

    // サブスクリプション取得・バリデーション
    const subResult = await query<OpfSubscriptionRow>(
      `SELECT * FROM opf_subscriptions WHERE id = $1`,
      [subscriptionId]
    );
    const sub = subResult.rows[0];
    if (!sub) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }
    if (sub.payment_source !== "coconala") {
      return NextResponse.json(
        { error: "Only coconala subscriptions can be confirmed manually" },
        { status: 400 }
      );
    }

    // 有効期限延長
    const { newExpiresAt } = await extendSubscriptionExpiry(subscriptionId);

    // 課金ログ記録
    const paymentLog = await insertPaymentLog({
      subscriptionId,
      amount: amount ?? 1000,
      memo,
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscriptionId,
        newExpiresAt: newExpiresAt.toISOString(),
      },
      paymentLog: {
        id: paymentLog.id,
        confirmedAt: paymentLog.confirmedAt.toISOString(),
        periodStart: paymentLog.periodStart.toISOString(),
        periodEnd: paymentLog.periodEnd.toISOString(),
        amount: amount ?? 1000,
      },
    });
  } catch (error) {
    console.error("[admin/confirm-payment] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
