/**
 * サイトHTML生成サービス
 *
 * /api/generate（同期）と /api/generate-job（非同期ジョブ）の両方から
 * 呼ばれる共通の生成ロジック。元は /api/generate ルート内にあったものを
 * ほぼそのまま移設したもの（挙動は同一）。
 *
 * 流れ: モデレーション + 実行可能性チェック（並列）→ HTML生成
 *       （Flash優先 + Liteフォールバック + テンプレート最終フォールバック）
 *       → 日本語テキスト品質チェック＆修正
 */

import { geminiGenerationModels, geminiModerationModels } from "@/lib/gemini";
import { buildModerationPrompt, parseModerationResponse } from "@/prompts/moderation";
import { buildGeneratorPrompt, parseGeneratorResponse } from "@/prompts/generator";
import { buildFeasibilityPrompt, parseFeasibilityResponse } from "@/prompts/feasibility";
import { notifyCustomerError } from "@/lib/slack";
import type { GeminiModelCandidate, SiteFormData } from "@/lib/gemini";
import type { ModerationResponse } from "@/prompts/moderation";

const GEMINI_RETRY_DELAYS_MS = [1200, 3200, 6500];

/** リトライしても回復しない失敗時にユーザーへ返す汎用メッセージ（詳細はログ/Slack通知に残る） */
export const GENERATION_FATAL_MESSAGE =
  "生成処理でエラーが発生しました。お手数ですが、少し時間を置いてもう一度お試しください。";

/** 混雑等のリトライ可能な失敗時にユーザーへ返すメッセージ */
export const GENERATION_BUSY_MESSAGE =
  "AI生成サービスが混み合っています。自動再試行しても完了できませんでした。入力内容は保持されていますので、少し時間を置いて再試行してください。";

export interface GenerationResult {
  html: string;
  moderation: ModerationResponse;
  warnings: string[];
  meta: {
    generationModel: string;
    templateFallback: boolean;
    fallbackReason?: string;
  };
}

/** モデレーション却下など、リトライ不要でユーザーに理由を伝えるべき失敗 */
export class GenerationRejectedError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GenerationRejectedError";
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isRetryableGeminiError(error: unknown): boolean {
  const message = getErrorMessage(error);
  if (/missing gemini|api key/i.test(message)) return false;
  return /503|502|504|429|high demand|service unavailable|overloaded|temporarily|timeout|fetch failed|googlegenerativeai|generated html does not contain/i.test(
    message
  );
}

/** formData の必須フィールドを検証し、問題があればエラーメッセージを返す */
export function validateGenerationInput(formData: SiteFormData | undefined): string | null {
  if (!formData) {
    return "formData is required";
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
      return `formData.${field} is required`;
    }
  }
  return null;
}

async function withGeminiModelFallback<T>(
  label: string,
  candidates: GeminiModelCandidate[],
  operation: (candidate: GeminiModelCandidate) => Promise<T>
): Promise<{ result: T; modelName: string; attempts: number; firstErrorMessage?: string }> {
  let lastError: unknown;
  let firstErrorMessage: string | undefined;
  for (let attempt = 1; attempt <= GEMINI_RETRY_DELAYS_MS.length + 1; attempt++) {
    const candidate = candidates[(attempt - 1) % candidates.length];
    try {
      const result = await operation(candidate);
      return { result, modelName: candidate.modelName, attempts: attempt, firstErrorMessage };
    } catch (error) {
      lastError = error;
      if (firstErrorMessage === undefined) {
        firstErrorMessage = `${candidate.modelName}: ${getErrorMessage(error)}`.slice(0, 300);
      }
      const retryable = isRetryableGeminiError(error);
      console.warn(`[generate] ${label} attempt ${attempt} failed with ${candidate.modelName}:`, error);
      if (!retryable || attempt > GEMINI_RETRY_DELAYS_MS.length) {
        break;
      }
      await sleep(GEMINI_RETRY_DELAYS_MS[attempt - 1]);
    }
  }
  throw lastError;
}

/**
 * サイトHTMLを生成する。
 *
 * @throws GenerationRejectedError モデレーション却下（ユーザーにそのまま見せる日本語メッセージ）
 * @throws Error その他の失敗（isRetryableGeminiError で分類する）
 */
export async function runGeneration(
  formData: SiteFormData,
  instruction?: string
): Promise<GenerationResult> {
  // --- Step 1: コンテンツモデレーション + 実行可能性チェック（並列実行） ---
  console.log("[generate] Running moderation & feasibility check for:", formData.siteName);
  const moderationPrompt = buildModerationPrompt(formData);
  const feasibilityPrompt = buildFeasibilityPrompt(
    `サイト名: ${formData.siteName}\nキャッチコピー: ${formData.catchphrase}\n説明: ${formData.description}\n連絡先: ${formData.contactInfo}`
  );

  const [moderationAttempt, feasibilityAttempt] = await Promise.all([
    withGeminiModelFallback("moderation", geminiModerationModels, (candidate) =>
      candidate.model.generateContent(moderationPrompt)
    ),
    withGeminiModelFallback("feasibility", geminiModerationModels, (candidate) =>
      candidate.model.generateContent(feasibilityPrompt)
    ).catch((error) => {
      console.warn("[generate] Feasibility check failed after retries, continuing:", error);
      return null;
    }),
  ]);

  const moderationResult = moderationAttempt.result;
  const moderationText = moderationResult.response.text();
  const moderation = parseModerationResponse(moderationText);
  console.log("[generate] Moderation result:", moderation, "model:", moderationAttempt.modelName);

  let warnings: string[] = [];
  if (feasibilityAttempt) {
    try {
      const feasibilityResult = feasibilityAttempt.result;
      const feasibility = parseFeasibilityResponse(feasibilityResult.response.text());
      warnings = feasibility.warnings;
      if (warnings.length > 0) {
        console.log("[generate] Feasibility warnings:", warnings, "model:", feasibilityAttempt.modelName);
      }
    } catch (e) {
      console.warn("[generate] Feasibility check parse error, continuing:", e);
    }
  }

  if (!moderation.isSafe) {
    throw new GenerationRejectedError(`コンテンツモデレーション: ${moderation.reason}`, 422);
  }

  // --- Step 2: HTML生成（Flash優先 + Liteフォールバック + テンプレート最終フォールバック） ---
  console.log("[generate] Generating HTML...");
  let generatorPrompt = buildGeneratorPrompt(formData);

  // 追加指示がある場合はプロンプトに付加
  if (instruction && instruction.trim()) {
    generatorPrompt += `\n\n## ユーザーからの追加指示（最優先で反映すること）\n${instruction.trim()}`;
  }

  let html = "";
  let usedTemplateFallback = false;
  let generationModelName = "";
  let generationFallbackReason: string | undefined;

  try {
    const generationAttempt = await withGeminiModelFallback(
      "generation",
      geminiGenerationModels,
      async (candidate) => {
        const generationResult = await candidate.model.generateContent(generatorPrompt);
        const rawHtml = generationResult.response.text();
        return parseGeneratorResponse(rawHtml);
      }
    );
    html = generationAttempt.result;
    generationModelName = generationAttempt.modelName;
    // 第一候補以外で成功した場合、切替の原因（初回失敗理由）を診断用に記録
    if (generationAttempt.modelName !== geminiGenerationModels[0].modelName) {
      generationFallbackReason = generationAttempt.firstErrorMessage;
    }
  } catch (error) {
    console.error("[generate] All model attempts failed, using fallback template");
    await notifyCustomerError("generate", "Gemini全モデル失敗→フォールバック使用", {
      siteName: formData.siteName, subdomain: formData.subdomain,
      error: getErrorMessage(error),
    });
    html = buildFallbackHtml(formData);
    usedTemplateFallback = true;
    warnings.push("AI生成に一時的な問題が発生したため、シンプルなテンプレートで生成しました。修正機能で調整できます。");
  }

  // --- Step 3: 日本語テキスト品質チェック＆修正 ---
  html = postProcessHtml(html, formData);
  console.log(
    `[generate] HTML ${usedTemplateFallback ? "template fallback" : "generated"}, model: ${generationModelName || "template"}, length:`,
    html.length
  );

  return {
    html,
    moderation,
    warnings,
    meta: {
      generationModel: generationModelName || "template",
      templateFallback: usedTemplateFallback,
      fallbackReason: generationFallbackReason,
    },
  };
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
