/**
 * API Route: GET /api/generate-job-status?id={jobId}
 *
 * 生成ジョブの状態を返すポーリング用エンドポイント。
 * 軽量・短時間のリクエストなので、スマホの画面ロックや回線切替が
 * あっても次のポーリングでやり直せる（結果を取り逃さない）。
 *
 * Response:
 *   pending  → { status: "pending" }
 *   complete → { status: "complete", html, warnings }
 *   error    → { status: "error", error, retryable }
 *   不明なID → 404 { error }（サーバー再起動等。クライアントはリトライ扱い）
 */

import { NextRequest, NextResponse } from "next/server";
import { getGenerationJob } from "@/lib/generationJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const job = getGenerationJob(id);
  if (!job) {
    return NextResponse.json(
      { error: "ジョブが見つかりません。再試行してください。" },
      { status: 404 }
    );
  }

  if (job.status === "complete" && job.result) {
    return NextResponse.json(
      {
        status: "complete",
        html: job.result.html,
        warnings: job.result.warnings,
        meta: job.result.meta,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (job.status === "error") {
    return NextResponse.json(
      { status: "error", error: job.error, retryable: job.retryable ?? false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { status: "pending" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
