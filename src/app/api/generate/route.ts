/**
 * API Route: POST /api/generate
 *
 * Gemini によるモデレーション・HTML生成エンドポイント（同期版）。
 * 生成ロジック本体は src/lib/generationService.ts に共通化されており、
 * 新しいクライアントはジョブ方式（/api/generate-job）を優先して使う。
 * このエンドポイントは旧クライアント・フォールバック用に維持する。
 *
 * Request:  { formData: SiteFormData, instruction?: string }
 * Response: { html: string, moderation: ModerationResponse, warnings: string[], meta: {...} }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  runGeneration,
  validateGenerationInput,
  isRetryableGeminiError,
  getErrorMessage,
  GenerationRejectedError,
  GENERATION_BUSY_MESSAGE,
  GENERATION_FATAL_MESSAGE,
} from "@/lib/generationService";
import { notifyCustomerError } from "@/lib/slack";
import type { SiteFormData } from "@/lib/gemini";

// Puppeteer を使用する screenshot API と同様に Node.js ランタイムを指定
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { formData: SiteFormData; instruction?: string };
    const { formData, instruction } = body;

    const validationError = validateGenerationInput(formData);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const result = await runGeneration(formData, instruction);

    // html をレスポンスに含める（screenshot API に渡すため）
    return NextResponse.json(
      {
        html: result.html,
        moderation: result.moderation,
        warnings: result.warnings,
        meta: result.meta,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[generate] Error:", error);

    // モデレーション却下: ユーザーにそのまま見せる日本語メッセージ
    if (error instanceof GenerationRejectedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const retryable = isRetryableGeminiError(error);
    if (!retryable) {
      await notifyCustomerError("generate", "生成API致命的エラー", {
        error: getErrorMessage(error),
      });
    }
    // 生のエラー文言（英語）はユーザーに見せず、日本語の汎用メッセージに変換する
    const message = retryable ? GENERATION_BUSY_MESSAGE : GENERATION_FATAL_MESSAGE;
    return NextResponse.json({ error: message, retryable }, { status: retryable ? 503 : 500 });
  }
}
