/**
 * ConversionTracker
 *
 * /complete ページに埋め込み、Google Ads コンバージョンと GA4 イベントを送信する。
 * 環境変数 NEXT_PUBLIC_AW_CONVERSION_ID と NEXT_PUBLIC_AW_CONVERSION_LABEL が
 * 設定されている場合のみ Google Ads コンバージョンを送信。
 */

"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function ConversionTracker() {
  useEffect(() => {
    if (typeof window.gtag !== "function") return;

    // GA4 イベント
    window.gtag("event", "purchase", {
      currency: "JPY",
      value: 3980,
      items: [{ item_name: "OnePage-Flash 初期制作", price: 3980, quantity: 1 }],
    });

    // Google Ads コンバージョン（環境変数が設定されている場合のみ）
    const awId = process.env.NEXT_PUBLIC_AW_CONVERSION_ID;
    const awLabel = process.env.NEXT_PUBLIC_AW_CONVERSION_LABEL;
    if (awId && awLabel) {
      window.gtag("event", "conversion", {
        send_to: `${awId}/${awLabel}`,
        value: 3980,
        currency: "JPY",
      });
    }
  }, []);

  return null;
}
