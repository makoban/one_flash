/**
 * Gemini API クライアント初期化モジュール
 *
 * 使用モデル:
 *   - 生成・修正の第一候補: gemini-2.5-flash
 *   - /api/generate のフォールバック候補: gemini-2.5-flash-lite
 *   - モデレーションの第一候補: gemini-2.5-flash-lite
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
  maxOutputTokens: 8192,
};

const MODERATION_MODEL_CONFIG = {
  temperature: 0.1,
  maxOutputTokens: 256,
  responseMimeType: "application/json",
};

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
  "gemini-2.5-flash",
  GENERATION_MODEL_CONFIG
);

/** コンテンツ生成・修正に使用するフォールバックモデル */
export const geminiFallbackModel: GenerativeModel = createGeminiModel(
  "gemini-2.5-flash-lite",
  GENERATION_MODEL_CONFIG
);

export const geminiGenerationModels: GeminiModelCandidate[] = [
  { modelName: "gemini-2.5-flash", model: geminiModel },
  { modelName: "gemini-2.5-flash-lite", model: geminiFallbackModel },
];

/** コンテンツモデレーション専用の第一候補モデル（低temperature・JSON出力）*/
export const moderationModel: GenerativeModel = createGeminiModel(
  "gemini-2.5-flash-lite",
  MODERATION_MODEL_CONFIG
);

/** コンテンツモデレーション専用のフォールバックモデル */
export const moderationFallbackModel: GenerativeModel = createGeminiModel(
  "gemini-2.5-flash",
  MODERATION_MODEL_CONFIG
);

export const geminiModerationModels: GeminiModelCandidate[] = [
  { modelName: "gemini-2.5-flash-lite", model: moderationModel },
  { modelName: "gemini-2.5-flash", model: moderationFallbackModel },
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
