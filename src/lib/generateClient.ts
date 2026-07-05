/**
 * クライアント側のサイトHTML生成ヘルパー
 *
 * ジョブ方式（POST /api/generate-job → GET /api/generate-job-status のポーリング）を
 * 優先して使う。1回のHTTPリクエストが数秒で終わるため、スマホの画面ロック・
 * アプリ切替・回線切替があっても、次のポーリングで結果を取得し直せる。
 *
 * ジョブ用エンドポイントが存在しない場合（デプロイ切替中など）は、
 * 従来の同期 /api/generate に自動フォールバックする。
 */

import { readErrorResponse, readJsonOrNull } from "@/lib/clientHttp";
import type { SiteFormData } from "@/lib/gemini";

export interface GenerationProgress {
  attempt: number;
  maxAttempts: number;
  retrying: boolean;
  message: string | null;
}

export interface GenerateHtmlResult {
  html: string;
  warnings: string[];
}

export const MAX_GENERATE_REQUEST_ATTEMPTS = 3;
const GENERATE_RETRY_DELAYS_MS = [2500, 7000];

// 生成は最短でも1分程度かかるため、最初のポーリングまで少し待つ
const POLL_INITIAL_DELAY_MS = 5000;
const POLL_INTERVAL_MS = 3000;
// 1ジョブあたりの待ち時間上限（サーバー側の生成は通常75〜105秒）
const POLL_DEADLINE_MS = 240_000;
// ポーリング1回あたりの通信タイムアウト
const POLL_FETCH_TIMEOUT_MS = 15_000;

const RETRY_MESSAGE = "AI生成サービスが混み合っているため、自動で再試行しています。";
const FINAL_MESSAGE =
  "AI生成サービスが混み合っています。入力内容は保持されていますので、少し時間を置いて再試行してください。";

type AttemptOutcome =
  | { kind: "success"; result: GenerateHtmlResult }
  | { kind: "retryable"; message?: string }
  | { kind: "fatal"; message: string }
  | { kind: "unsupported" };

/**
 * サイトHTMLを生成する（自動リトライつき）。
 * 失敗時は日本語メッセージの Error を throw する。
 */
export async function generateSiteHtml(
  formData: SiteFormData,
  instruction?: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<GenerateHtmlResult> {
  let lastMessage: string | undefined;

  for (let attempt = 1; attempt <= MAX_GENERATE_REQUEST_ATTEMPTS; attempt++) {
    onProgress?.({
      attempt,
      maxAttempts: MAX_GENERATE_REQUEST_ATTEMPTS,
      retrying: attempt > 1,
      message: attempt > 1 ? RETRY_MESSAGE : null,
    });

    const outcome = await runJobAttempt(formData, instruction);

    if (outcome.kind === "success") {
      return outcome.result;
    }
    if (outcome.kind === "unsupported") {
      // 旧サーバー（ジョブ未対応）へのフォールバック
      return generateSiteHtmlLegacy(formData, instruction, onProgress);
    }
    if (outcome.kind === "fatal") {
      throw new Error(outcome.message);
    }

    lastMessage = outcome.message ?? lastMessage;
    if (attempt < MAX_GENERATE_REQUEST_ATTEMPTS) {
      await sleep(GENERATE_RETRY_DELAYS_MS[attempt - 1] ?? 7000);
    }
  }

  throw new Error(lastMessage ?? FINAL_MESSAGE);
}

/** ジョブを1回開始してポーリングし、結果を返す */
async function runJobAttempt(
  formData: SiteFormData,
  instruction?: string
): Promise<AttemptOutcome> {
  // --- ジョブ開始 ---
  let startResponse: Response;
  try {
    startResponse = await fetch("/api/generate-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData, instruction }),
    });
  } catch {
    return { kind: "retryable" };
  }

  if (startResponse.status === 404 || startResponse.status === 405) {
    return { kind: "unsupported" };
  }
  if (!startResponse.ok) {
    const errorData = await readErrorResponse(startResponse);
    if (isRetryableGenerateError(startResponse.status, errorData)) {
      return { kind: "retryable", message: errorData.error };
    }
    return { kind: "fatal", message: errorData.error ?? FINAL_MESSAGE };
  }

  const startPayload = await readJsonOrNull<{ jobId?: unknown }>(startResponse);
  const jobId = typeof startPayload?.jobId === "string" ? startPayload.jobId : null;
  if (!jobId) {
    return { kind: "retryable" };
  }

  // --- ポーリング ---
  const deadline = Date.now() + POLL_DEADLINE_MS;
  let missingCount = 0;
  await sleep(POLL_INITIAL_DELAY_MS);

  for (;;) {
    let statusResponse: Response | null = null;
    try {
      statusResponse = await fetchWithTimeout(
        `/api/generate-job-status?id=${encodeURIComponent(jobId)}`,
        POLL_FETCH_TIMEOUT_MS
      );
    } catch {
      // 通信の一時失敗は次のポーリングでやり直す（これがジョブ方式の利点）
    }

    if (statusResponse) {
      if (statusResponse.status === 404) {
        // サーバー再起動等でジョブが消えた。デプロイ切替の揺れを考慮して1回だけ様子を見る。
        missingCount++;
        if (missingCount >= 2) {
          return { kind: "retryable" };
        }
      } else if (statusResponse.ok) {
        const payload = await readJsonOrNull<{
          status?: unknown;
          html?: unknown;
          warnings?: unknown;
          error?: unknown;
          retryable?: unknown;
        }>(statusResponse);

        if (payload?.status === "complete" && typeof payload.html === "string" && payload.html.trim()) {
          return {
            kind: "success",
            result: { html: payload.html, warnings: filterWarnings(payload.warnings) },
          };
        }
        if (payload?.status === "error") {
          const message = typeof payload.error === "string" && payload.error ? payload.error : undefined;
          if (payload.retryable) {
            return { kind: "retryable", message };
          }
          return { kind: "fatal", message: message ?? FINAL_MESSAGE };
        }
        // pending もしくは壊れたJSON → 次のポーリングへ
      }
    }

    // 期限判定はポーリングの「後」に行う。スマホがスリープから復帰した直後でも
    // 必ず1回は最新状態を確認してから諦めるため、完了済みの結果を取り逃さない。
    if (Date.now() >= deadline) {
      return { kind: "retryable" };
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

/** 従来の同期 /api/generate を使う生成（旧サーバー向けフォールバック） */
async function generateSiteHtmlLegacy(
  formData: SiteFormData,
  instruction?: string,
  onProgress?: (progress: GenerationProgress) => void
): Promise<GenerateHtmlResult> {
  let generateErrorData: { error?: string; retryable?: boolean } = {};

  for (let attempt = 1; attempt <= MAX_GENERATE_REQUEST_ATTEMPTS; attempt++) {
    onProgress?.({
      attempt,
      maxAttempts: MAX_GENERATE_REQUEST_ATTEMPTS,
      retrying: attempt > 1,
      message: attempt > 1 ? RETRY_MESSAGE : null,
    });

    let response: Response | null = null;
    try {
      response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData, instruction }),
      });
    } catch {
      generateErrorData = { error: FINAL_MESSAGE, retryable: true };
    }

    if (response) {
      if (response.ok) {
        const payload = await readJsonOrNull<{ html?: unknown; warnings?: unknown }>(response);
        const html = typeof payload?.html === "string" ? payload.html : "";
        if (html.trim().length > 0) {
          return { html, warnings: filterWarnings(payload?.warnings) };
        }
        // 200 なのにボディが読めない（iOS Safari の通信切断など）→ リトライ
        generateErrorData = {
          error:
            "通信が不安定でAI生成結果を読み込めませんでした。入力内容は保持されていますので、同じ内容で再試行してください。",
          retryable: true,
        };
      } else {
        generateErrorData = await readErrorResponse(response);
        if (!isRetryableGenerateError(response.status, generateErrorData)) {
          break;
        }
      }
    }

    if (attempt < MAX_GENERATE_REQUEST_ATTEMPTS) {
      await sleep(GENERATE_RETRY_DELAYS_MS[attempt - 1] ?? 7000);
    }
  }

  throw new Error(generateErrorData.error ?? FINAL_MESSAGE);
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

function filterWarnings(warnings: unknown): string[] {
  return Array.isArray(warnings)
    ? warnings.filter((warning): warning is string => typeof warning === "string")
    : [];
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
