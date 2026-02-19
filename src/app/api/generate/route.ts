/**
 * API Route: POST /api/generate
 *
 * プロトタイプ用: Gemini によるモデレーション・HTML生成エンドポイント。
 * 本番環境では Stripe Webhook 経由での生成が正規フロー。
 *
 * Request:  { formData: SiteFormData }
 * Response: { html: string, moderation: ModerationResponse }
 */

import { NextRequest, NextResponse } from "next/server";
import { geminiModel, moderationModel } from "@/lib/gemini";
import { buildModerationPrompt, parseModerationResponse } from "@/prompts/moderation";
import { buildGeneratorPrompt, parseGeneratorResponse } from "@/prompts/generator";
import type { SiteFormData } from "@/lib/gemini";

// Puppeteer を使用する screenshot API と同様に Node.js ランタイムを指定
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { formData: SiteFormData; instruction?: string };
    const { formData, instruction } = body;

    if (!formData) {
      return NextResponse.json({ error: "formData is required" }, { status: 400 });
    }

    // email / subdomain を含む全フィールドの存在チェック
    const requiredFields: (keyof SiteFormData)[] = [
      "siteName",
      "catchphrase",
      "description",
      "contactInfo",
      "colorTheme",
      "email",
      "subdomain",
    ];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return NextResponse.json(
          { error: `formData.${field} is required` },
          { status: 400 }
        );
      }
    }

    // --- Step 1: コンテンツモデレーション ---
    console.log("[generate] Running moderation for:", formData.siteName);
    const moderationPrompt = buildModerationPrompt(formData);
    const moderationResult = await moderationModel.generateContent(moderationPrompt);
    const moderationText = moderationResult.response.text();
    const moderation = parseModerationResponse(moderationText);
    console.log("[generate] Moderation result:", moderation);

    if (!moderation.isSafe) {
      return NextResponse.json(
        { error: `コンテンツモデレーション: ${moderation.reason}` },
        { status: 422 }
      );
    }

    // --- Step 2: HTML生成 ---
    console.log("[generate] Generating HTML...");
    let generatorPrompt = buildGeneratorPrompt(formData);

    // 追加指示がある場合はプロンプトに付加
    if (instruction && instruction.trim()) {
      generatorPrompt += `\n\n## ユーザーからの追加指示（最優先で反映すること）\n${instruction.trim()}`;
    }

    const generationResult = await geminiModel.generateContent(generatorPrompt);
    const rawHtml = generationResult.response.text();
    const html = parseGeneratorResponse(rawHtml);
    console.log("[generate] HTML generated, length:", html.length);

    // html をレスポンスに含める（screenshot API に渡すため）
    return NextResponse.json({ html, moderation }, { status: 200 });
  } catch (error: unknown) {
    console.error("[generate] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
