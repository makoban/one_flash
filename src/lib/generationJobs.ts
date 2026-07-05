/**
 * 生成ジョブストア（in-memory）
 *
 * スマホ（特に iOS Safari）では80秒級の長時間HTTPリクエストが
 * 画面ロックやアプリ切替で切断されやすい。そこで生成をジョブ化し、
 * クライアントは POST /api/generate-job でジョブを開始してすぐ jobId を受け取り、
 * GET /api/generate-job-status?id= を数秒おきにポーリングして結果を取得する。
 *
 * ストアは middleware のレート制限と同じく in-memory Map ベース
 * （Render 単一インスタンス前提）。サーバー再起動でジョブは消えるが、
 * クライアント側が「ジョブ消失 → リトライ」として扱うため安全に回復する。
 */

import { randomUUID } from "crypto";
import {
  runGeneration,
  isRetryableGeminiError,
  getErrorMessage,
  GenerationRejectedError,
  GENERATION_BUSY_MESSAGE,
  GENERATION_FATAL_MESSAGE,
} from "@/lib/generationService";
import { notifyCustomerError } from "@/lib/slack";
import type { GenerationResult } from "@/lib/generationService";
import type { SiteFormData } from "@/lib/gemini";

export interface GenerationJob {
  id: string;
  status: "pending" | "complete" | "error";
  result?: GenerationResult;
  error?: string;
  retryable?: boolean;
  createdAt: number;
  finishedAt?: number;
}

// 完了後もクライアントが取得し直せるよう、TTL は生成時間より十分長く取る
const JOB_TTL_MS = 15 * 60_000;
const CLEANUP_INTERVAL_MS = 60_000;

// Next.js の dev ホットリロードでモジュールが再評価されても
// ストアとクリーンアップタイマーが重複しないよう globalThis に保持する
const globalStore = globalThis as unknown as {
  __opfGenerationJobs?: Map<string, GenerationJob>;
  __opfGenerationJobsCleanup?: ReturnType<typeof setInterval>;
};

const jobs: Map<string, GenerationJob> =
  globalStore.__opfGenerationJobs ?? new Map<string, GenerationJob>();
globalStore.__opfGenerationJobs = jobs;

if (!globalStore.__opfGenerationJobsCleanup) {
  globalStore.__opfGenerationJobsCleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - job.createdAt > JOB_TTL_MS) {
        jobs.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // プロセス終了を妨げないようにする
  globalStore.__opfGenerationJobsCleanup.unref?.();
}

/** 生成ジョブを開始し、jobId を返す（生成はバックグラウンドで継続する） */
export function startGenerationJob(formData: SiteFormData, instruction?: string): string {
  const id = randomUUID();
  const job: GenerationJob = { id, status: "pending", createdAt: Date.now() };
  jobs.set(id, job);

  void (async () => {
    try {
      const result = await runGeneration(formData, instruction);
      job.result = result;
      job.status = "complete";
    } catch (error: unknown) {
      console.error(`[generate-job] Job ${id} failed:`, error);
      if (error instanceof GenerationRejectedError) {
        // モデレーション却下: 日本語メッセージをそのまま見せる。リトライ不要。
        job.error = error.message;
        job.retryable = false;
      } else {
        const retryable = isRetryableGeminiError(error);
        if (!retryable) {
          await notifyCustomerError("generate", "生成ジョブ致命的エラー", {
            siteName: formData.siteName,
            error: getErrorMessage(error),
          }).catch(() => undefined);
        }
        job.error = retryable ? GENERATION_BUSY_MESSAGE : GENERATION_FATAL_MESSAGE;
        job.retryable = retryable;
      }
      job.status = "error";
    } finally {
      job.finishedAt = Date.now();
    }
  })();

  return id;
}

/** ジョブを取得する（存在しない/期限切れなら undefined） */
export function getGenerationJob(id: string): GenerationJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  if (Date.now() - job.createdAt > JOB_TTL_MS) {
    jobs.delete(id);
    return undefined;
  }
  return job;
}
