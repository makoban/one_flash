/**
 * API Route: POST /api/generate-job
 *
 * サイトHTML生成のジョブを開始し、即座に jobId を返す。
 * 生成結果は GET /api/generate-job-status?id={jobId} でポーリング取得する。
 *
 * 長時間HTTPリクエストがスマホで切断される問題（iOS Safari の
 * "The string did not match the expected pattern." 等）への恒久対策。
 * レート制限は middleware で /api/generate と同等に適用される。
 *
 * Request:  { formData: SiteFormData, instruction?: string }
 * Response: { jobId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { validateGenerationInput } from "@/lib/generationService";
import { startGenerationJob } from "@/lib/generationJobs";
import type { SiteFormData } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { formData?: SiteFormData; instruction?: string };
  try {
    body = (await request.json()) as { formData?: SiteFormData; instruction?: string };
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const validationError = validateGenerationInput(body.formData);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const jobId = startGenerationJob(body.formData as SiteFormData, body.instruction);
  return NextResponse.json({ jobId }, { status: 202 });
}
