/**
 * Stripe クライアント初期化モジュール
 *
 * サーバーサイド専用。フロントエンドには NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY のみ公開。
 */

import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Stripeクライアント（遅延初期化: 環境変数未設定でもビルドを通す）
// ---------------------------------------------------------------------------
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("Missing Stripe environment variable: STRIPE_SECRET_KEY");
  }
  _stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-01-28.clover",
    typescript: true,
  });
  return _stripe;
}

/** 後方互換: 既存コードから stripe を参照できるようにする */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** サービス料金（日本円・税込） */
export const PRICE_AMOUNT = 5000;

/** 修正1回の料金（3回目以降） */
export const REVISION_PRICE_AMOUNT = 500;

/** Stripe に設定する通貨コード */
export const CURRENCY = "jpy";

// ---------------------------------------------------------------------------
// TODO: 本格実装時に追加するヘルパー関数
// ---------------------------------------------------------------------------
// export async function createCheckoutSession(params: {
//   siteFormData: SiteFormData;
//   successUrl: string;
//   cancelUrl: string;
// }): Promise<Stripe.Checkout.Session> { ... }
//
// export async function createRevisionCheckoutSession(params: {
//   siteId: string;
//   revisionToken: string;
//   successUrl: string;
//   cancelUrl: string;
// }): Promise<Stripe.Checkout.Session> { ... }
