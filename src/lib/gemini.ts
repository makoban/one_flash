/**
 * Gemini API クライアント初期化モジュール
 *
 * 使用モデル: gemini-2.0-flash（高速・低コスト）
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

/** コンテンツ生成・修正に使用するモデル */
export const geminiModel: GenerativeModel = new Proxy({} as GenerativeModel, {
  get(_, prop) {
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });
    return (model as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/** コンテンツモデレーション専用モデル（低temperature・JSON出力）*/
export const moderationModel: GenerativeModel = new Proxy({} as GenerativeModel, {
  get(_, prop) {
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });
    return (model as unknown as Record<string | symbol, unknown>)[prop];
  },
});

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
  colorTheme: "simple" | "colorful" | "business";
  email: string;
  subdomain: string;
}

// ---------------------------------------------------------------------------
// TODO: 本格実装時に追加するヘルパー関数
// ---------------------------------------------------------------------------
// export async function moderateContent(formData: SiteFormData): Promise<ModerationResult> { ... }
// export async function generateSiteHTML(formData: SiteFormData): Promise<string> { ... }
// export async function refineSiteHTML(currentHTML: string, instruction: string): Promise<string> { ... }
