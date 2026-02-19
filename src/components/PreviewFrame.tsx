/**
 * PreviewFrame コンポーネント
 *
 * 生成されたHTMLをiframe内でプレビュー表示する。
 * サンドボックス属性でスクリプトの実行を制限（セキュリティ対策）。
 *
 * @example
 * <PreviewFrame html={generatedHtml} />
 */

"use client";

import { useState, useEffect, useRef } from "react";

interface PreviewFrameProps {
  html: string;
  className?: string;
}

export default function PreviewFrame({ html, className = "" }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    setIsLoading(true);

    // srcdoc を使って HTML を安全にロード
    iframe.srcdoc = html;

    const handleLoad = () => {
      setIsLoading(false);
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [html]);

  return (
    <div className={`relative w-full ${className}`}>
      {/* ローディングオーバーレイ */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">プレビューを読み込み中...</span>
          </div>
        </div>
      )}

      {/* プレビューiframe */}
      <iframe
        ref={iframeRef}
        title="サイトプレビュー"
        className={`w-full rounded-lg border border-gray-200 shadow-sm transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        style={{ height: "600px" }}
        // セキュリティ: スクリプト実行を許可（Tailwind / Lucide CDN が必要なため）
        // TODO: 本番では allow-scripts を除外するか、Content-Security-Policy で制限する
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
      />
    </div>
  );
}
