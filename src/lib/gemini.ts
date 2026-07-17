/**
 * Gemini API クライアント初期化モジュール
 *
 * 使用モデル:
 *   - 生成・修正の第一候補: GEMINI_MODEL（既定: gemini-flash-latest）
 *   - フォールバック候補: GEMINI_FALLBACK_MODEL（既定: gemini-pro-latest）
 *   - モデレーションも同じ2候補を軽量設定で使用
 * 用途:
 *   - コンテンツモデレーション (prompts/moderation.ts)
 *   - HTML/CSS生成 (prompts/generator.ts)
 *   - HTML修正 (prompts/refiner.ts)
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// ---------------------------------------------------------------------------
// Gemini クライアント（遅延初期化: 環境変数未設定でもビルドを通す）
// ---------------------------------------------------------------------------
let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (_genAI) return _genAI;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error("Missing Gemini environment variable: GEMINI_API_KEY");
  }
  _genAI = new GoogleGenerativeAI(geminiApiKey);
  return _genAI;
}

export interface GeminiModelCandidate {
  modelName: string;
  model: GenerativeModel;
}

const GENERATION_MODEL_CONFIG = {
  temperature: 0.7,
  // 8192 ではFlash系モデルのリッチなHTMLが </html> 到達前に打ち切られ、
  // 「Generated HTML does not contain closing </html> tag」で予備モデルに交代していた。
  // 現行Flash系の出力上限内で余裕を持たせて完走させる。
  maxOutputTokens: 32768,
};

const MODERATION_MODEL_CONFIG = {
  temperature: 0.1,
  maxOutputTokens: 256,
  responseMimeType: "application/json",
};

const GENERATION_MODEL_NAME =
  process.env.GEMINI_MODEL || "gemini-flash-latest";
const FALLBACK_MODEL_NAME =
  process.env.GEMINI_FALLBACK_MODEL || "gemini-pro-latest";

function createGeminiModel(
  modelName: string,
  generationConfig: Record<string, string | number>
): GenerativeModel {
  return new Proxy({} as GenerativeModel, {
    get(_, prop) {
      const model = getGenAI().getGenerativeModel({
        model: modelName,
        generationConfig,
      });
      return (model as unknown as Record<string | symbol, unknown>)[prop];
    },
  });
}

/** コンテンツ生成・修正に使用する第一候補モデル */
export const geminiModel: GenerativeModel = createGeminiModel(
  GENERATION_MODEL_NAME,
  GENERATION_MODEL_CONFIG
);

/** コンテンツ生成・修正に使用するフォールバックモデル */
export const geminiFallbackModel: GenerativeModel = createGeminiModel(
  FALLBACK_MODEL_NAME,
  GENERATION_MODEL_CONFIG
);

export const geminiGenerationModels: GeminiModelCandidate[] = [
  { modelName: GENERATION_MODEL_NAME, model: geminiModel },
  { modelName: FALLBACK_MODEL_NAME, model: geminiFallbackModel },
];

/** コンテンツモデレーション専用の第一候補モデル（低temperature・JSON出力）*/
export const moderationModel: GenerativeModel = createGeminiModel(
  GENERATION_MODEL_NAME,
  MODERATION_MODEL_CONFIG
);

/** コンテンツモデレーション専用のフォールバックモデル */
export const moderationFallbackModel: GenerativeModel = createGeminiModel(
  FALLBACK_MODEL_NAME,
  MODERATION_MODEL_CONFIG
);

export const geminiModerationModels: GeminiModelCandidate[] = [
  { modelName: GENERATION_MODEL_NAME, model: moderationModel },
  { modelName: FALLBACK_MODEL_NAME, model: moderationFallbackModel },
];

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** モデレーション結果の型 */
export interface ModerationResult {
  isSafe: boolean;
  reason: string;
}

/** サイト生成の入力パラメータ */
export interface SiteFormData {
  siteName: string;
  catchphrase: string;
  description: string;
  contactInfo: string;
  colorTheme: "clean-light" | "royal-navy" | "bloom-pink" | "soft-blossom" | "sunset-cafe" | "dark-dining" | "trust-blue" | "modern-minimal" | "pop-school" | "blueprint" | "free-wave" | "executive";
  email: string;
  subdomain: string;
}

// ---------------------------------------------------------------------------
// TODO: 本格実装時に追加するヘルパー関数
// ---------------------------------------------------------------------------
// export async function moderateContent(formData: SiteFormData): Promise<ModerationResult> { ... }
// export async function generateSiteHTML(formData: SiteFormData): Promise<string> { ... }
// export async function refineSiteHTML(currentHTML: string, instruction: string): Promise<string> { ... }
