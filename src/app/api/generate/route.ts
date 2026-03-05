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
import { buildFeasibilityPrompt, parseFeasibilityResponse } from "@/prompts/feasibility";
import { notifyCustomerError } from "@/lib/slack";
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

    // --- Step 1: コンテンツモデレーション + 実行可能性チェック（並列実行） ---
    console.log("[generate] Running moderation & feasibility check for:", formData.siteName);
    const moderationPrompt = buildModerationPrompt(formData);
    const feasibilityPrompt = buildFeasibilityPrompt(
      `サイト名: ${formData.siteName}\nキャッチコピー: ${formData.catchphrase}\n説明: ${formData.description}\n連絡先: ${formData.contactInfo}`
    );

    const [moderationResult, feasibilityResult] = await Promise.all([
      moderationModel.generateContent(moderationPrompt),
      moderationModel.generateContent(feasibilityPrompt),
    ]);

    const moderationText = moderationResult.response.text();
    const moderation = parseModerationResponse(moderationText);
    console.log("[generate] Moderation result:", moderation);

    let warnings: string[] = [];
    try {
      const feasibility = parseFeasibilityResponse(feasibilityResult.response.text());
      warnings = feasibility.warnings;
      if (warnings.length > 0) {
        console.log("[generate] Feasibility warnings:", warnings);
      }
    } catch (e) {
      console.warn("[generate] Feasibility check parse error, continuing:", e);
    }

    if (!moderation.isSafe) {
      return NextResponse.json(
        { error: `コンテンツモデレーション: ${moderation.reason}` },
        { status: 422 }
      );
    }

    // --- Step 2: HTML生成（リトライ最大3回 + フォールバック） ---
    console.log("[generate] Generating HTML...");
    let generatorPrompt = buildGeneratorPrompt(formData);

    // 追加指示がある場合はプロンプトに付加
    if (instruction && instruction.trim()) {
      generatorPrompt += `\n\n## ユーザーからの追加指示（最優先で反映すること）\n${instruction.trim()}`;
    }

    let html = "";
    let usedFallback = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const generationResult = await geminiModel.generateContent(generatorPrompt);
        const rawHtml = generationResult.response.text();
        html = parseGeneratorResponse(rawHtml);
        break;
      } catch (error) {
        console.warn(`[generate] Attempt ${attempt} failed:`, error);
        if (attempt === 3) {
          console.error("[generate] All 3 attempts failed, using fallback template");
          await notifyCustomerError("generate", "Gemini全リトライ失敗→フォールバック使用", {
            siteName: formData.siteName, subdomain: formData.subdomain,
            error: error instanceof Error ? error.message : String(error),
          });
          html = buildFallbackHtml(formData);
          usedFallback = true;
          warnings.push("AI生成に一時的な問題が発生したため、シンプルなテンプレートで生成しました。修正機能で調整できます。");
        }
      }
    }

    // --- Step 3: 日本語テキスト品質チェック＆修正 ---
    if (!usedFallback) {
      html = postProcessHtml(html);
    }
    console.log(`[generate] HTML ${usedFallback ? "fallback" : "generated"}, length:`, html.length);

    // html をレスポンスに含める（screenshot API に渡すため）
    return NextResponse.json({ html, moderation, warnings }, { status: 200 });
  } catch (error: unknown) {
    console.error("[generate] Error:", error);
    await notifyCustomerError("generate", "生成API致命的エラー", {
      error: error instanceof Error ? error.message : String(error),
    });
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

// ---------------------------------------------------------------------------
// フォールバックHTMLテンプレート（Gemini 全リトライ失敗時）
// ---------------------------------------------------------------------------

function buildFallbackHtml(formData: SiteFormData): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const theme = formData.colorTheme ?? "simple";
  const colors = theme === "colorful"
    ? { bg: "#FFF8F0", accent: "#FF6B35", text: "#333" }
    : theme === "business"
    ? { bg: "#F8FAFC", accent: "#1E40AF", text: "#1E293B" }
    : { bg: "#FFFFFF", accent: "#6366F1", text: "#374151" };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(formData.siteName)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;color:${colors.text};background:${colors.bg};overflow-wrap:break-word;overflow-x:hidden}
.hero{text-align:center;padding:80px 20px;background:linear-gradient(135deg,${colors.accent}11,${colors.accent}05)}
.hero h1{font-size:2rem;margin-bottom:16px}
.hero p{font-size:1.1rem;opacity:0.8;max-width:600px;margin:0 auto}
.section{padding:60px 20px;max-width:800px;margin:0 auto}
.section h2{font-size:1.5rem;margin-bottom:20px;color:${colors.accent};border-bottom:2px solid ${colors.accent};padding-bottom:8px}
.section p{line-height:1.8;white-space:pre-line}
.contact{background:${colors.accent}08;padding:60px 20px;text-align:center}
.contact h2{font-size:1.5rem;margin-bottom:20px;color:${colors.accent}}
.contact p{line-height:1.8;white-space:pre-line}
footer{text-align:center;padding:30px 20px;font-size:0.85rem;opacity:0.6}
</style>
</head>
<body>
<div class="hero">
<h1>${esc(formData.siteName)}</h1>
<p>${esc(formData.catchphrase)}</p>
</div>
<div class="section">
<h2>${esc(formData.siteName)}について</h2>
<p>${esc(formData.description)}</p>
</div>
<div class="contact">
<h2>お問い合わせ</h2>
<p>${esc(formData.contactInfo)}</p>
</div>
<footer>&copy; ${new Date().getFullYear()} ${esc(formData.siteName)}</footer>
</body>
</html>`;
}
