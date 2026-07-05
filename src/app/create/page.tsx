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

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CardStepForm from "@/components/CardStepForm";
import PreviewSection from "@/app/create/PreviewSection";
import type { SiteFormData } from "@/lib/gemini";
import { trackEvent, trackXPixelEvent, getUtmParams, getSessionId } from "@/lib/utm";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

type PageState = "form" | "generating" | "preview" | "complete";

interface PreviewData {
  pcImage?: string | null;
  mobileImage?: string | null;
  html: string;
  warnings?: string[];
  screenshotWarning?: string;
}

interface HistoryEntry {
  id: number;
  previewData: PreviewData;
  instruction: string;
  timestamp: Date;
}

interface GenerationProgress {
  attempt: number;
  maxAttempts: number;
  retrying: boolean;
  message: string | null;
}

// ---------------------------------------------------------------------------
// 生成中に順に表示するメッセージ
// ---------------------------------------------------------------------------

// 生成中に順に表示する「作業中」メッセージ（ループ表示）。
// 実処理（AI生成 + スクリーンショット生成）が終わるまで循環し続けるため、
// 完了していないのに「完成しました！」と表示してしまうことがない。
const GENERATING_MESSAGES = [
  "入力内容を確認しています...",
  "サイトの構成を設計しています...",
  "最適なレイアウトを選んでいます...",
  "文章・キャッチコピーを整えています...",
  "デザインを組み立てています...",
  "プレビュー画像を生成しています...",
  "仕上げの調整をしています...",
];

// 生成完了時にだけ表示する文言（プレビュー表示の直前に一瞬だけ出す）
const COMPLETED_MESSAGE = "完成しました！";
// 「完成しました！」を見せてからプレビューへ切り替えるまでの待機時間
const COMPLETION_FLASH_MS = 900;

const MESSAGE_INTERVAL_MS = 2000;
const MAX_GENERATE_REQUEST_ATTEMPTS = 3;
const GENERATE_RETRY_DELAYS_MS = [2500, 7000];
const GENERATE_RESPONSE_READ_RETRY_MESSAGE =
  "通信が不安定なため、AI生成結果の読み込みを自動で再試行しています。";
const GENERATE_RESPONSE_READ_FINAL_MESSAGE =
  "通信が不安定でAI生成結果を読み込めませんでした。入力内容は保持されていますので、同じ内容で再試行してください。";

// ---------------------------------------------------------------------------
// 再生成の最大回数（プロトタイプ用）
// ---------------------------------------------------------------------------

const MAX_REGENERATIONS = 6;

// ---------------------------------------------------------------------------
// メインページコンポーネント
// ---------------------------------------------------------------------------

export default function CreatePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50" />}>
      <CreatePage />
    </Suspense>
  );
}

function CreatePage() {
  const searchParams = useSearchParams();
  // adminモード判定はクライアント側では pw をそのまま保持し、API呼び出し時に検証
  const adminPw = searchParams.get("pw") ?? "";
  const adminMode = searchParams.get("mode") === "admin" && adminPw.length > 0;

  const [pageState, setPageState] = useState<PageState>("form");
  const [formData, setFormData] = useState<SiteFormData | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerationsLeft, setRegenerationsLeft] = useState(MAX_REGENERATIONS);
  // 生成が実際に完了したか（「完成しました！」表示の制御用）
  const [generationCompleted, setGenerationCompleted] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    attempt: 1,
    maxAttempts: MAX_GENERATE_REQUEST_ATTEMPTS,
    retrying: false,
    message: null,
  });

  // 履歴管理
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

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
    setGenerationCompleted(false);
    setGenerationProgress({
      attempt: 1,
      maxAttempts: MAX_GENERATE_REQUEST_ATTEMPTS,
      retrying: false,
      message: null,
    });

    trackEvent("generate_start");
    try {
      const preview = await generateAndScreenshot(data, undefined, setGenerationProgress);
      trackEvent("generate_complete");
      trackXPixelEvent(process.env.NEXT_PUBLIC_X_EVENT_GENERATE_ID, {
        status: "completed",
        description: "OnePage-Flash preview generated",
      });
      setPreviewData(preview);
      const entry: HistoryEntry = {
        id: 1,
        previewData: preview,
        instruction: "初回生成",
        timestamp: new Date(),
      };
      setHistory([entry]);
      setCurrentHistoryIndex(0);
      // 実処理が完了したこの瞬間にだけ「完成しました！」を表示し、
      // 少し見せてからプレビューへ遷移する（早すぎる完了表示を防ぐ）
      setGenerationCompleted(true);
      await sleep(COMPLETION_FLASH_MS);
      setPageState("preview");
    } catch (err: unknown) {
      setError(
        toUserFacingErrorMessage(
          err,
          "通信が不安定で生成結果を読み込めませんでした。入力内容は保持されていますので、同じ内容で再試行してください。"
        )
      );
      setGenerationCompleted(false);
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
      // 履歴に追加
      setHistory((prev) => {
        const entry: HistoryEntry = {
          id: prev.length + 1,
          previewData: preview,
          instruction: instruction || "再生成",
          timestamp: new Date(),
        };
        return [...prev, entry];
      });
      setCurrentHistoryIndex((prev) => prev + 1);
    } catch (err: unknown) {
      setError(
        toUserFacingErrorMessage(
          err,
          "通信が不安定で再生成結果を読み込めませんでした。もう一度お試しください。"
        )
      );
    } finally {
      setIsRegenerating(false);
    }
  }

  // --- 履歴から復元 ---
  function handleRestoreFromHistory(historyId: number): void {
    const entry = history.find((h) => h.id === historyId);
    if (entry) {
      setPreviewData(entry.previewData);
      setCurrentHistoryIndex(history.indexOf(entry));
    }
  }

  // --- 公開 ---
  const [isPublishing, setIsPublishing] = useState(false);
  const [coconalaOrderId, setCoconalaOrderId] = useState("");
  const [adminPublishResult, setAdminPublishResult] = useState<{
    publicUrl: string;
    revisionUrl: string;
    revisionToken: string;
    expiresAt: string;
  } | null>(null);

  // adminモード: 直接公開
  async function handleAdminPublish(): Promise<void> {
    if (!previewData || !formData) return;
    setError(null);
    setIsPublishing(true);

    try {
      const response = await fetch("/api/admin/publish-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pw: adminPw,
          formData: {
            siteName: formData.siteName,
            catchphrase: formData.catchphrase,
            description: formData.description,
            contactInfo: formData.contactInfo,
            colorTheme: formData.colorTheme,
            subdomain: formData.siteName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `site-${Date.now()}`,
          },
          html: previewData.html,
          coconalaOrderId: coconalaOrderId || undefined,
          sendEmail: false,
        }),
      });

      if (!response.ok) {
        const errorData = await readErrorResponse(response);
        throw new Error(errorData.error ?? "サイト公開に失敗しました");
      }

      const result = await readJsonResponse<{
        site?: { publicUrl?: string; revisionUrl?: string; revisionToken?: string };
        subscription?: { expiresAt?: string };
      }>(response, "公開結果を読み込めませんでした。もう一度お試しください。");
      const site = result.site;
      const expiresAt = result.subscription?.expiresAt;
      if (!site?.publicUrl || !site.revisionUrl || !site.revisionToken || !expiresAt) {
        throw new Error("公開結果に必要な情報が含まれていません。もう一度お試しください。");
      }
      setAdminPublishResult({
        publicUrl: site.publicUrl,
        revisionUrl: site.revisionUrl,
        revisionToken: site.revisionToken,
        expiresAt,
      });
      setPageState("complete");
    } catch (err: unknown) {
      setError(
        toUserFacingErrorMessage(
          err,
          "通信が不安定で公開結果を読み込めませんでした。もう一度お試しください。"
        )
      );
    } finally {
      setIsPublishing(false);
    }
  }

  // 通常モード: Stripe Checkout
  async function handlePublish(): Promise<void> {
    if (adminMode) {
      return handleAdminPublish();
    }

    if (!previewData || !formData) return;
    setError(null);
    setIsPublishing(true);

    trackEvent("checkout_start");
    trackXPixelEvent(process.env.NEXT_PUBLIC_X_EVENT_CHECKOUT_ID, {
      value: 3980,
      currency: "JPY",
      status: "started",
      description: "OnePage-Flash checkout started",
    });

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
        const errorData = await readErrorResponse(response);
        throw new Error(errorData.error ?? "決済セッションの作成に失敗しました");
      }

      const { url } = await readJsonResponse<{ url?: string }>(
        response,
        "決済ページの作成結果を読み込めませんでした。もう一度お試しください。"
      );
      if (!url) {
        throw new Error("決済ページURLを取得できませんでした。もう一度お試しください。");
      }
      window.location.href = url;
    } catch (err: unknown) {
      setError(
        toUserFacingErrorMessage(
          err,
          "通信が不安定で決済ページの作成結果を読み込めませんでした。もう一度お試しください。"
        )
      );
      setIsPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-10 px-4">
      {/* adminモードバー */}
      {adminMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 text-sm font-bold shadow-md">
          管理者モード（ココナラ対応）
        </div>
      )}

      {/* ヘッダー */}
      <div className={`text-center mb-8 ${adminMode ? "mt-10" : ""}`}>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-indigo-600 transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          トップページに戻る
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">OnePage-Flash</h1>
        <p className="mt-2 text-sm text-gray-500">
          6つの質問に答えるだけで、AIが文章とデザインを作成
        </p>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
          {pageState === "form" && formData && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-red-500">
                入力内容は保持されています。修正せずに同じ内容で再試行できます。
              </p>
              <button
                type="button"
                onClick={() => { void handleFormSubmit(formData); }}
                disabled={isSubmitting}
                className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                同じ内容で再試行する
              </button>
            </div>
          )}
        </div>
      )}

      {/* 状態別コンテンツ */}
      {pageState === "form" && (
        <CardStepForm
          onSubmit={handleFormSubmit}
          isSubmitting={isSubmitting}
          onFirstInteraction={trackFormStart}
          isAdmin={adminMode}
          initialData={formData}
        />
      )}

      {pageState === "generating" && (
        <GeneratingView progress={generationProgress} completed={generationCompleted} />
      )}

      {pageState === "preview" && previewData && formData && (
        <>
        {previewData.warnings && previewData.warnings.length > 0 && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              以下の内容はこのサービスでは対応できないため、可能な範囲で作成しました：
            </p>
            <ul className="list-disc list-inside space-y-1">
              {previewData.warnings.map((w, i) => (
                <li key={i} className="text-sm text-amber-700">{w}</li>
              ))}
            </ul>
          </div>
        )}
        {previewData.screenshotWarning && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-semibold text-amber-800">
              プレビュー画像の生成だけ失敗しました
            </p>
            <p className="mt-1 text-sm text-amber-700">
              {previewData.screenshotWarning}
            </p>
          </div>
        )}
        <PreviewSection
          pcImage={previewData.pcImage}
          mobileImage={previewData.mobileImage}
          html={previewData.html}
          formData={formData}
          regenerationsLeft={regenerationsLeft}
          onRegenerate={handleRegenerate}
          onPublish={handlePublish}
          isRegenerating={isRegenerating}
          isPublishing={isPublishing}
          history={history}
          currentHistoryIndex={currentHistoryIndex}
          onRestoreFromHistory={handleRestoreFromHistory}
          isAdmin={adminMode}
          coconalaOrderId={coconalaOrderId}
          onCoconalaOrderIdChange={setCoconalaOrderId}
        />
        </>
      )}

      {pageState === "complete" && adminMode && adminPublishResult && (
        <div className="max-w-lg mx-auto py-16 px-4">
          <div className="bg-white rounded-2xl shadow-sm border p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">サイトを公開しました</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">公開URL</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={adminPublishResult.publicUrl} className="flex-1 px-3 py-2 text-sm bg-gray-50 border rounded-lg" />
                  <button onClick={() => navigator.clipboard.writeText(adminPublishResult.publicUrl)} className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">コピー</button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">修正用URL</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={adminPublishResult.revisionUrl} className="flex-1 px-3 py-2 text-sm bg-gray-50 border rounded-lg" />
                  <button onClick={() => navigator.clipboard.writeText(adminPublishResult.revisionUrl)} className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">コピー</button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">有効期限</label>
                <p className="text-sm text-gray-700">{new Date(adminPublishResult.expiresAt).toLocaleDateString("ja-JP")}</p>
              </div>

              <div className="flex gap-3 mt-6">
                <a href={adminPublishResult.publicUrl} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 text-center bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700">
                  サイトを確認
                </a>
                <button onClick={() => { setPageState("form"); setAdminPublishResult(null); setPreviewData(null); setFormData(null); }} className="flex-1 py-3 text-center border border-gray-300 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50">
                  次のサイトを作成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pageState === "complete" && !adminMode && formData && (
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

async function generateAndScreenshot(
  data: SiteFormData,
  instruction?: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<PreviewData> {
  // Step 1: HTML生成
  let generateResponse: Response | null = null;
  let generateErrorData: { error?: string; retryable?: boolean } = {};
  let generatePayload: { html: string; warnings?: string[] } | null = null;

  for (let attempt = 1; attempt <= MAX_GENERATE_REQUEST_ATTEMPTS; attempt++) {
    onProgress?.({
      attempt,
      maxAttempts: MAX_GENERATE_REQUEST_ATTEMPTS,
      retrying: attempt > 1,
      message:
        attempt > 1
          ? "AI生成サービスが混み合っているため、自動で再試行しています。"
          : null,
    });

    generateResponse = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData: data, instruction }),
    });

    if (generateResponse.ok) {
      const payload = await readJsonOrNull<{ html?: unknown; warnings?: unknown }>(generateResponse);
      const html = typeof payload?.html === "string" ? payload.html : "";
      if (html.trim().length > 0) {
        const warnings = Array.isArray(payload?.warnings)
          ? payload.warnings.filter((warning): warning is string => typeof warning === "string")
          : [];
        generatePayload = { html, warnings };
        break;
      }

      generateErrorData = {
        error: GENERATE_RESPONSE_READ_FINAL_MESSAGE,
        retryable: true,
      };
      if (attempt === MAX_GENERATE_REQUEST_ATTEMPTS) {
        break;
      }

      onProgress?.({
        attempt,
        maxAttempts: MAX_GENERATE_REQUEST_ATTEMPTS,
        retrying: true,
        message: GENERATE_RESPONSE_READ_RETRY_MESSAGE,
      });
      const delay = GENERATE_RETRY_DELAYS_MS[attempt - 1] ?? 7000;
      await sleep(delay);
      continue;
    }

    generateErrorData = await readErrorResponse(generateResponse);
    const shouldRetry = isRetryableGenerateError(generateResponse.status, generateErrorData);
    if (!shouldRetry || attempt === MAX_GENERATE_REQUEST_ATTEMPTS) {
      break;
    }

    const delay = GENERATE_RETRY_DELAYS_MS[attempt - 1] ?? 7000;
    await sleep(delay);
  }

  if (!generatePayload) {
    throw new Error(
      generateErrorData.error ??
        "AI生成サービスが混み合っています。入力内容は保持されていますので、少し時間を置いて再試行してください。"
    );
  }

  const { html, warnings } = generatePayload;

  // Step 2: スクリーンショット取得
  try {
    const screenshotResponse = await fetch("/api/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html }),
    });

    if (!screenshotResponse.ok) {
      const errorData = await readErrorResponse(screenshotResponse);
      throw new Error(errorData.error ?? "スクリーンショットの取得に失敗しました");
    }

    const { pcImage, mobileImage } = (await screenshotResponse.json()) as {
      pcImage: string;
      mobileImage: string;
    };

    return { pcImage, mobileImage, html, warnings: warnings ?? [] };
  } catch (error) {
    console.warn("[create] screenshot failed, falling back to HTML preview:", error);
    return {
      pcImage: null,
      mobileImage: null,
      html,
      warnings: warnings ?? [],
      screenshotWarning:
        "画面内プレビューで表示しています。サイト生成自体は完了しているため、このまま修正や決済へ進めます。",
    };
  }
}

async function readJsonOrNull<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

async function readErrorResponse(response: Response): Promise<{ error?: string; retryable?: boolean }> {
  try {
    return (await response.json()) as { error?: string; retryable?: boolean };
  } catch {
    return {};
  }
}

function isRetryableGenerateError(
  status: number,
  errorData: { error?: string; retryable?: boolean }
): boolean {
  if (errorData.retryable) return true;
  if ([429, 500, 502, 503, 504].includes(status)) {
    const message = errorData.error ?? "";
    if (/missing gemini|api key/i.test(message)) return false;
    return true;
  }
  return /high demand|service unavailable|overloaded|temporarily|googlegenerativeai/i.test(
    errorData.error ?? ""
  );
}

function toUserFacingErrorMessage(error: unknown, fallbackMessage: string): string {
  const message = error instanceof Error ? error.message : "";
  if (
    !message ||
    /the string did not match the expected pattern|unexpected end of json input|unexpected token .*json|failed to execute 'json'|body stream|failed to fetch|load failed|networkerror/i.test(
      message
    )
  ) {
    return fallbackMessage;
  }
  return message;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 生成中ビュー
// ---------------------------------------------------------------------------

function GeneratingView({
  progress,
  completed,
}: {
  progress: GenerationProgress;
  completed: boolean;
}) {
  const [messageIndex, setMessageIndex] = useState(0);

  // 完了するまで作業中メッセージを循環表示する（時間で「完成」に到達しない）
  useEffect(() => {
    if (completed) return;
    const timer = setTimeout(() => {
      setMessageIndex((prev) => (prev + 1) % GENERATING_MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [messageIndex, completed]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      {/* スピナー / 完了チェック */}
      <div className="relative mb-8">
        {completed ? (
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{ animation: "fadeSlideIn 0.4s ease both" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <>
            <div className="w-20 h-20 border-4 border-indigo-100 rounded-full" />
            <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
          </>
        )}
      </div>

      {/* メッセージ */}
      <div className="text-center">
        <p
          key={completed ? "done" : messageIndex}
          className={`text-lg font-semibold ${completed ? "text-green-700" : "text-gray-800"}`}
          style={{ animation: "fadeSlideIn 0.4s ease both" }}
        >
          {completed ? COMPLETED_MESSAGE : GENERATING_MESSAGES[messageIndex]}
        </p>
        <p className="mt-2 text-sm text-gray-400">
          {completed
            ? "プレビューを表示します..."
            : "AIがあなたのホームページを作成しています（1〜2分ほどかかります。そのままお待ちください）"}
        </p>
        {!completed && progress.retrying && (
          <p className="mt-3 text-sm font-medium text-indigo-600">
            {progress.message}（{progress.attempt}/{progress.maxAttempts}回目）
          </p>
        )}
      </div>

      {/* ステップインジケーター（作業中のみ） */}
      {!completed && (
        <div className="mt-8 flex gap-2">
          {GENERATING_MESSAGES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                i === messageIndex ? "bg-indigo-400 scale-125" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
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
