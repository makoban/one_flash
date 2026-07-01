/**
 * ConversionTracker
 *
 * /complete ページに埋め込み、Google Ads コンバージョンと GA4 イベントを送信する。
 * 環境変数 NEXT_PUBLIC_AW_CONVERSION_ID と NEXT_PUBLIC_AW_CONVERSION_LABEL が
 * 設定されている場合のみ Google Ads コンバージョンを送信。
 */

"use client";

import { useEffect } from "react";
import { trackXPixelEvent } from "@/lib/utm";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function ConversionTracker() {
  useEffect(() => {
    if (typeof window.gtag === "function") {
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
    }

    const checkoutSessionId = new URLSearchParams(window.location.search).get("session_id");
    trackXPixelEvent(process.env.NEXT_PUBLIC_X_EVENT_PURCHASE_ID, {
      value: 3980,
      currency: "JPY",
      conversion_id: checkoutSessionId ?? undefined,
      contents: [
        {
          content_id: "opf_initial",
          content_name: "OnePage-Flash 初期制作",
          content_price: 3980,
          num_items: 1,
        },
      ],
    });
  }, []);

  return null;
}
