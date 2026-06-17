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

    // フィールドの存在チェック（email/subdomainはadminモードでは空の場合がある）
    const requiredFields: (keyof SiteFormData)[] = [
      "siteName",
      "catchphrase",
      "description",
      "contactInfo",
      "colorTheme",
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
    html = postProcessHtml(html, formData);
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

function postProcessHtml(html: string, formData: SiteFormData): string {
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

  // 7. Q4（連絡先）に予約サイトなどのURLがある場合は、AI生成結果のブレに関係なくCTAとして残す
  result = ensureContactUrlCta(result, formData.contactInfo);

  return result;
}

// ---------------------------------------------------------------------------
// 連絡先URLの確実なCTA化
// ---------------------------------------------------------------------------

const CONTACT_URL_CTA_MARKER = "<!-- OPF_CONTACT_URL_CTA -->";

function ensureContactUrlCta(html: string, contactInfo: string): string {
  const urls = extractContactUrls(contactInfo);
  if (urls.length === 0 || html.includes(CONTACT_URL_CTA_MARKER)) {
    return html;
  }

  const allUrlsAlreadyLinked = urls.every((url) =>
    html.includes(`href="${url}"`) || html.includes(`href='${url}'`)
  );
  if (allUrlsAlreadyLinked) {
    return html;
  }

  const isReservation = /予約|reserve|reservation|booking/i.test(contactInfo);
  const label = isReservation ? "予約サイトはこちら" : "お問い合わせはこちら";
  const links = urls
    .map((url, index) => {
      const displayLabel = urls.length === 1 ? label : `${label} ${index + 1}`;
      return `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;min-height:44px;padding:0.875rem 1.25rem;border-radius:9999px;background:#2563eb;color:#fff;font-weight:700;text-decoration:none;box-shadow:0 10px 24px rgba(37,99,235,0.22);">${escapeHtml(displayLabel)} <span aria-hidden="true">&#8599;</span></a>`;
    })
    .join("\n");

  const ctaBlock = `
${CONTACT_URL_CTA_MARKER}
<div data-opf-contact-url-cta="true" style="margin-top:1.5rem;text-align:center;">
${links}
</div>`;

  const contactSectionPattern = /(<section\b(?=[^>]*\bid=["'][^"']*contact[^"']*["'])[^>]*>[\s\S]*?)(<\/section>)/i;
  if (contactSectionPattern.test(html)) {
    return html.replace(contactSectionPattern, `$1${ctaBlock}\n$2`);
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${ctaBlock}\n</body>`);
  }

  return `${html}${ctaBlock}`;
}

function extractContactUrls(text: string): string[] {
  const candidates: string[] = [];
  const urlMatches = text.match(/https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+/gi) ?? [];
  candidates.push(...urlMatches);

  const bareDomainPattern = /(^|[\s（(])((?:[a-z0-9-]+\.)+(?:co\.jp|or\.jp|ne\.jp|com|net|jp|org|info|shop|site|tokyo|clinic)(?:\/[^\s<>"'`）)]*)?)/gi;
  for (const match of text.matchAll(bareDomainPattern)) {
    if (match[2]) candidates.push(match[2]);
  }

  const normalized = candidates
    .map(normalizeContactUrl)
    .filter((url): url is string => Boolean(url));

  return Array.from(new Set(normalized));
}

function normalizeContactUrl(candidate: string): string | null {
  const stripped = candidate
    .trim()
    .replace(/[、。，．,.;:!?！？）)\]】」』>]+$/g, "");
  if (!stripped) return null;

  const withScheme = /^https?:\/\//i.test(stripped) ? stripped : `https://${stripped}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// フォールバックHTMLテンプレート（Gemini 全リトライ失敗時）
// ---------------------------------------------------------------------------

function getBaseThemeCategory(theme: string): "light" | "colorful" | "dark" {
  if (["royal-navy", "dark-dining", "trust-blue", "executive"].includes(theme)) return "dark";
  if (["bloom-pink", "sunset-cafe", "pop-school", "free-wave"].includes(theme)) return "colorful";
  return "light"; // clean-light, soft-blossom, modern-minimal, blueprint
}

function buildFallbackHtml(formData: SiteFormData): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const theme = formData.colorTheme ?? "clean-light";
  const category = getBaseThemeCategory(theme);
  const colors = category === "dark"
    ? { bg: "#F8FAFC", accent: "#1E40AF", text: "#1E293B" }
    : category === "colorful"
    ? { bg: "#FFF8F0", accent: "#FF6B35", text: "#333" }
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
