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
    let html = parseGeneratorResponse(rawHtml);

    // --- Step 3: 日本語テキスト品質チェック＆修正 ---
    html = postProcessHtml(html);
    console.log("[generate] HTML generated and post-processed, length:", html.length);

    // html をレスポンスに含める（screenshot API に渡すため）
    return NextResponse.json({ html, moderation }, { status: 200 });
  } catch (error: unknown) {
    console.error("[generate] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// 日本語テキスト品質チェック＆自動修正
// ---------------------------------------------------------------------------

function postProcessHtml(html: string): string {
  let result = html;

  // 1. lang="ja" が設定されていなければ追加
  if (/<html(?:\s[^>]*)?>/.test(result) && !result.includes('lang="ja"')) {
    result = result.replace(/<html(\s?)/, '<html lang="ja"$1');
  }

  // 2. overflow-wrap: break-word が body に設定されていなければ style に追加
  if (!result.includes("overflow-wrap") && !result.includes("word-wrap")) {
    result = result.replace(
      "</head>",
      `<style>body{overflow-wrap:break-word;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}</style>\n</head>`
    );
  }

  // 3. body に overflow-x: hidden が設定されていなければ追加
  if (!result.includes("overflow-x")) {
    result = result.replace(
      "</head>",
      `<style>body{overflow-x:hidden}</style>\n</head>`
    );
  }

  // 4. word-break: break-all を overflow-wrap: break-word に置換（日本語テキスト破壊を防止）
  result = result.replace(/word-break\s*:\s*break-all/g, "overflow-wrap: break-word");

  // 5. lucide.createIcons() が呼ばれていなければ body 閉じタグ前に追加
  if (!result.includes("lucide.createIcons") && result.includes("data-lucide")) {
    result = result.replace(
      "</body>",
      `<script>lucide.createIcons();</script>\n</body>`
    );
  }

  // 6. 不正な HTML エンティティの修正（日本語テキストで発生しやすい）
  result = result.replace(/&amp;(?=#|[a-zA-Z])/g, "&");

  return result;
}
