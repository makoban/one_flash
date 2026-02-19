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
// 環境変数のバリデーション
// ---------------------------------------------------------------------------
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  throw new Error("Missing Gemini environment variable: GEMINI_API_KEY");
}

// ---------------------------------------------------------------------------
// Gemini クライアント初期化
// ---------------------------------------------------------------------------
const genAI = new GoogleGenerativeAI(geminiApiKey);

/** コンテンツ生成・修正に使用するモデル */
export const geminiModel: GenerativeModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    // JSON出力が必要なモデレーションプロンプトで使用
    // 個別呼び出し時に上書き可能
    temperature: 0.7,
    maxOutputTokens: 8192,
  },
});

/** コンテンツモデレーション専用モデル（低temperature・JSON出力）*/
export const moderationModel: GenerativeModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    temperature: 0.1, // モデレーションは判定の一貫性を重視
    maxOutputTokens: 256,
    responseMimeType: "application/json",
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
  colorTheme: "minimal" | "business" | "casual";
  email: string;
  subdomain: string;
}

// ---------------------------------------------------------------------------
// TODO: 本格実装時に追加するヘルパー関数
// ---------------------------------------------------------------------------
// export async function moderateContent(formData: SiteFormData): Promise<ModerationResult> { ... }
// export async function generateSiteHTML(formData: SiteFormData): Promise<string> { ... }
// export async function refineSiteHTML(currentHTML: string, instruction: string): Promise<string> { ... }
