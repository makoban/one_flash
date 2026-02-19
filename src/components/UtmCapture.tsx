/**
 * UTM パラメータ取得コンポーネント
 *
 * ページロード時に URL から UTM パラメータを sessionStorage に保存する。
 * Server Component の LP にも埋め込めるよう "use client" で分離。
 */

"use client";

import { useEffect } from "react";
import { captureUtmParams, trackEvent } from "@/lib/utm";

export default function UtmCapture({ trackPageView = false }: { trackPageView?: boolean }) {
  useEffect(() => {
    captureUtmParams();
    if (trackPageView) {
      trackEvent("page_view");
    }
  }, [trackPageView]);

  return null;
}
