/**
 * プロンプトA: コンテンツモデレーション
 *
 * 公序良俗・法令に反するコンテンツを検出する。
 * Gemini に JSON 形式（isSafe / reason）で返答させる。
 *
 * 使用モデル: moderationModel（低temperature, responseMimeType: application/json）
 */

import type { SiteFormData } from "@/lib/gemini";

// ---------------------------------------------------------------------------
// プロンプト生成関数
// ---------------------------------------------------------------------------

/**
 * モデレーションプロンプトを生成する
 *
 * @param formData - ユーザーが入力したサイト情報
 * @returns Gemini に送信するプロンプト文字列
 */
export function buildModerationPrompt(formData: SiteFormData): string {
  return `
あなたはWebサービスのコンテンツモデレーターです。
ユーザーが送信したホームページ作成用のテキストコンテンツを審査してください。

## 審査対象コンテンツ

サイト名: ${formData.siteName}
キャッチコピー: ${formData.catchphrase}
本文・説明: ${formData.description}
連絡先情報: ${formData.contactInfo}

## 審査基準

以下のいずれかに該当する場合は安全ではないと判定してください:
- 違法行為（詐欺、薬物売買、著作権侵害など）の宣伝・助長
- 成人向けコンテンツ・性的表現
- 差別的・ヘイト的な表現（人種、性別、宗教などに基づく）
- 暴力的・脅迫的な表現
- 個人情報の不正収集を目的とした内容
- フィッシングやマルウェア配布を目的とした内容
- 医薬品・健康食品の誇大広告（効果を保証するような表現）
- 反社会的勢力に関連する内容

## 出力形式

必ず以下のJSON形式のみで回答してください。説明文は不要です。

{
  "isSafe": true または false,
  "reason": "判定理由を日本語で50文字以内で記述"
}

安全な場合の例:
{"isSafe": true, "reason": "問題のある表現は検出されませんでした"}

安全でない場合の例:
{"isSafe": false, "reason": "医薬品の効果を断言する誇大広告的な表現が含まれています"}
  `.trim();
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** モデレーション結果の期待するJSON構造 */
export interface ModerationResponse {
  isSafe: boolean;
  reason: string;
}

/**
 * Gemini のレスポンスをパースしてモデレーション結果を返す
 *
 * @param rawResponse - Gemini が返したJSON文字列
 * @returns パース済みのモデレーション結果
 * @throws パースに失敗した場合
 */
export function parseModerationResponse(rawResponse: string): ModerationResponse {
  // コードブロック記法（```json ... ```）を除去
  const cleaned = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as unknown;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).isSafe !== "boolean" ||
    typeof (parsed as Record<string, unknown>).reason !== "string"
  ) {
    throw new Error(`Invalid moderation response format: ${rawResponse}`);
  }

  return parsed as ModerationResponse;
}
