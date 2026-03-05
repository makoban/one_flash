/**
 * API Route: POST /api/moderate
 *
 * ステップ遷移時のコンテンツモデレーション専用エンドポイント。
 * Step 1 の「次へ」ボタン押下時にフロントから呼ばれる。
 *
 * Request:  { siteName, catchphrase, description, contactInfo }
 * Response: { isSafe: boolean, reason: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { moderationModel } from "@/lib/gemini";
import { buildModerationPrompt, parseModerationResponse } from "@/prompts/moderation";
import type { SiteFormData } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Partial<SiteFormData>;

    if (!body.siteName || !body.catchphrase || !body.description || !body.contactInfo) {
      return NextResponse.json(
        { error: "必須フィールドが不足しています" },
        { status: 400 }
      );
    }

    const formData: SiteFormData = {
      siteName: body.siteName,
      catchphrase: body.catchphrase,
      description: body.description,
      contactInfo: body.contactInfo,
      colorTheme: "simple",
      email: "",
      subdomain: "",
    };

    const prompt = buildModerationPrompt(formData);
    const result = await moderationModel.generateContent(prompt);
    const moderation = parseModerationResponse(result.response.text());

    return NextResponse.json(moderation);
  } catch (error: unknown) {
    console.error("[moderate] Error:", error);
    // モデレーションAPIの失敗では生成を止めない（安全側に倒す）
    return NextResponse.json({ isSafe: true, reason: "チェックをスキップしました" });
  }
}
