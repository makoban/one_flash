/**
 * /create ページ
 *
 * フォーム入力 → 生成中アニメーション → プレビュー → 完了（モック）の
 * 4ステート遷移を管理するページコンポーネント。
 *
 * 状態遷移:
 *   form → generating → preview → complete
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CardStepForm from "@/components/CardStepForm";
import PreviewSection from "@/app/create/PreviewSection";
import type { SiteFormData } from "@/lib/gemini";
import { trackEvent, getUtmParams, getSessionId } from "@/lib/utm";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

type PageState = "form" | "generating" | "preview" | "complete";

interface PreviewData {
  pcImage: string;
  mobileImage: string;
  html: string;
}

// ---------------------------------------------------------------------------
// 生成中に順に表示するメッセージ
// ---------------------------------------------------------------------------

const GENERATING_MESSAGES = [
  "あなたのサイトを設計中...",
  "最適なレイアウトを選定中...",
  "キャッチコピーを磨いています...",
  "最終チェック中...",
  "完成しました！",
];

const MESSAGE_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// 再生成の最大回数（プロトタイプ用）
// ---------------------------------------------------------------------------

const MAX_REGENERATIONS = 10;

// ---------------------------------------------------------------------------
// メインページコンポーネント
// ---------------------------------------------------------------------------

export default function CreatePage() {
  const [pageState, setPageState] = useState<PageState>("form");
  const [formData, setFormData] = useState<SiteFormData | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationsLeft, setRegenerationsLeft] = useState(MAX_REGENERATIONS);

  // form_start イベント（初回のみ）
  const [formStartTracked, setFormStartTracked] = useState(false);
  function trackFormStart() {
    if (!formStartTracked) {
      trackEvent("form_start");
      setFormStartTracked(true);
    }
  }

  // --- フォーム送信処理 ---
  async function handleFormSubmit(data: SiteFormData): Promise<void> {
    setError(null);
    setFormData(data);
    setIsSubmitting(true);
    setPageState("generating");

    try {
      const preview = await generateAndScreenshot(data);
      setPreviewData(preview);
      setPageState("preview");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "エラーが発生しました。もう一度お試しください。";
      setError(message);
      setPageState("form");
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- 再生成処理（編集データ + 追加指示を受け取る） ---
  async function handleRegenerate(updatedData: SiteFormData, instruction: string): Promise<void> {
    if (regenerationsLeft <= 0) return;
    setError(null);
    setIsRegenerating(true);
    setFormData(updatedData);

    try {
      const preview = await generateAndScreenshot(updatedData, instruction);
      setPreviewData(preview);
      setRegenerationsLeft((prev) => prev - 1);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "再生成に失敗しました。もう一度お試しください。";
      setError(message);
    } finally {
      setIsRegenerating(false);
    }
  }

  // --- 公開（Stripe Checkout セッション作成 → 決済ページへリダイレクト） ---
  const [isPublishing, setIsPublishing] = useState(false);

  async function handlePublish(): Promise<void> {
    if (!previewData || !formData) return;
    setError(null);
    setIsPublishing(true);

    // checkout_start イベント
    trackEvent("checkout_start");

    try {
      const utm = getUtmParams();
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData,
          html: previewData.html,
          utm,
          sessionId: getSessionId(),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "決済セッションの作成に失敗しました");
      }

      const { url } = (await response.json()) as { url: string };
      // Stripe Checkout ページへリダイレクト
      window.location.href = url;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "エラーが発生しました。もう一度お試しください。";
      setError(message);
      setIsPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-10 px-4">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-indigo-600 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          トップページに戻る
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">OnePage-Flash</h1>
        <p className="mt-2 text-sm text-gray-500">
          テキストを入力するだけで、10分でホームページが完成
        </p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 状態別コンテンツ */}
      {pageState === "form" && (
        <CardStepForm onSubmit={handleFormSubmit} isSubmitting={isSubmitting} onFirstInteraction={trackFormStart} />
      )}

      {pageState === "generating" && (
        <GeneratingView />
      )}

      {pageState === "preview" && previewData && formData && (
        <PreviewSection
          pcImage={previewData.pcImage}
          mobileImage={previewData.mobileImage}
          formData={formData}
          regenerationsLeft={regenerationsLeft}
          onRegenerate={handleRegenerate}
          onPublish={handlePublish}
          isRegenerating={isRegenerating}
          isPublishing={isPublishing}
        />
      )}

      {pageState === "complete" && formData && (
        <div className="max-w-lg mx-auto text-center py-16 px-4">
          <p className="text-gray-500">決済ページへリダイレクト中...</p>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// API: HTML生成 + スクリーンショット取得
// ---------------------------------------------------------------------------

async function generateAndScreenshot(data: SiteFormData, instruction?: string): Promise<PreviewData> {
  // Step 1: HTML生成
  const generateResponse = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formData: data, instruction }),
  });

  if (!generateResponse.ok) {
    const errorData = (await generateResponse.json()) as { error?: string };
    throw new Error(errorData.error ?? "HTML生成に失敗しました");
  }

  const { html } = (await generateResponse.json()) as { html: string };

  // Step 2: スクリーンショット取得
  const screenshotResponse = await fetch("/api/screenshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });

  if (!screenshotResponse.ok) {
    const errorData = (await screenshotResponse.json()) as { error?: string };
    throw new Error(errorData.error ?? "スクリーンショットの取得に失敗しました");
  }

  const { pcImage, mobileImage } = (await screenshotResponse.json()) as {
    pcImage: string;
    mobileImage: string;
  };

  return { pcImage, mobileImage, html };
}

// ---------------------------------------------------------------------------
// 生成中ビュー
// ---------------------------------------------------------------------------

function GeneratingView() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (messageIndex >= GENERATING_MESSAGES.length - 1) {
      setDone(true);
      return;
    }

    const timer = setTimeout(() => {
      setMessageIndex((prev) => prev + 1);
    }, MESSAGE_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [messageIndex]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      {/* スピナー */}
      <div className="relative mb-8">
        <div className="w-20 h-20 border-4 border-indigo-100 rounded-full" />
        <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        {/* 中央アイコン */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-indigo-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
      </div>

      {/* メッセージ */}
      <div className="text-center">
        <p
          key={messageIndex}
          className="text-lg font-semibold text-gray-800"
          style={{ animation: "fadeSlideIn 0.4s ease both" }}
        >
          {GENERATING_MESSAGES[messageIndex]}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          AIがあなたのホームページを作成しています
        </p>
      </div>

      {/* ステップインジケーター */}
      <div className="mt-8 flex gap-2">
        {GENERATING_MESSAGES.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-500 ${
              i < messageIndex
                ? "bg-indigo-500"
                : i === messageIndex
                ? "bg-indigo-400 scale-125"
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {done && (
        <p
          className="mt-6 text-sm text-indigo-600 font-medium"
          style={{ animation: "fadeSlideIn 0.4s ease both" }}
        >
          まもなくプレビューが表示されます...
        </p>
      )}

      {/* アニメーション定義 */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

