/**
 * API Route: POST /api/moderate
 *
 * ステップ遷移時のコンテンツモデレーション専用エンドポイント。
 * Q2（キャッチコピー）・Q3（説明文）の「次へ」ボタン押下時にフロントから呼ばれる。
 *
 * Request:  { text: string, field: string }
 * Response: { isSafe: boolean, reason: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { moderationModel } from "@/lib/gemini";
import { parseModerationResponse } from "@/prompts/moderation";

export const runtime = "nodejs";

function buildFieldModerationPrompt(field: string, text: string): string {
  return `
あなたはWebサービスのコンテンツモデレーターです。
ユーザーがホームページ作成フォームの「${field}」欄に入力したテキストを審査してください。

## 審査対象テキスト

${text}

## 審査基準

以下のいずれかに該当する場合のみ安全ではないと判定してください:
- 違法行為（詐欺、薬物売買、著作権侵害など）の宣伝・助長
- 成人向けコンテンツ・性的表現
- 差別的・ヘイト的な表現（人種、性別、宗教などに基づく）
- 暴力的・脅迫的な表現
- 個人情報の不正収集を目的とした内容
- フィッシングやマルウェア配布を目的とした内容
- 反社会的勢力に関連する内容

## 安全と判定すべき表現（ブロックしないこと）
- ビジネスの実績・経験年数のアピール（例: 「10年以上の実績」「創業30年」）
- サービスの効果・改善を提案する表現（例: 「痛みを改善」「売上アップをサポート」）
- 顧客満足度・お客様の声に関する表現
- 一般的なマーケティング表現・キャッチコピー
- 医療・健康分野でも、効果を「断言」ではなく「提案・サポート」する表現はOK

## 出力形式

必ず以下のJSON形式のみで回答してください。説明文は不要です。

{"isSafe": true, "reason": "判定理由を日本語で50文字以内"}
  `.trim();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { text?: string; field?: string };

    if (!body.text || !body.field) {
      return NextResponse.json(
        { error: "text と field は必須です" },
        { status: 400 }
      );
    }

    const prompt = buildFieldModerationPrompt(body.field, body.text);
    const result = await moderationModel.generateContent(prompt);
    const moderation = parseModerationResponse(result.response.text());

    return NextResponse.json(moderation);
  } catch (error: unknown) {
    console.error("[moderate] Error:", error);
    return NextResponse.json({ isSafe: true, reason: "チェックをスキップしました" });
  }
}
