/**
 * プロンプトD: 実行可能性チェック（Feasibility Check）
 *
 * ユーザーの入力テキストから、静的HTML（Tailwind + Lucide Icons）では
 * 実現不可能な要求を検出し、警告メッセージを返す。
 *
 * 使用モデル: moderationModel（低temperature, responseMimeType: application/json）
 */

// ---------------------------------------------------------------------------
// プロンプト生成関数
// ---------------------------------------------------------------------------

/**
 * 実行可能性チェックプロンプトを生成する
 *
 * @param userText - ユーザーが入力したテキスト（説明文 or 修正指示）
 * @returns Gemini に送信するプロンプト文字列
 */
export function buildFeasibilityPrompt(userText: string): string {
  return `
あなたはWebサービスの技術審査担当です。
ユーザーが入力したテキストを分析し、「静的な1ページHTML」では実現不可能な要求が含まれているかチェックしてください。

## ユーザー入力テキスト

${userText}

## このサービスで出来ること（HTML + Tailwind CSS + Lucide Icons のみ）

- テキスト・見出し・段落の表示
- 電話番号リンク（tel:）、メールリンク（mailto:）
- Google Maps埋め込み（iframe）
- 色・フォント・レイアウトの変更
- CSSアニメーション
- Lucideアイコンの表示
- レスポンシブデザイン
- アクセス情報・営業時間の表示

## 実現不可能な要求の例

以下のカテゴリに該当する要求を検出してください:

1. **画像関連**: 「写真を入れたい」「画像を生成して」「ロゴを作って」「イラストを追加」「バナー画像」等
2. **予約・フォーム系**: 「予約システム」「予約フォーム」「問い合わせフォーム（送信機能付き）」「申込フォーム」「カレンダー予約」等
3. **EC・決済系**: 「ショッピングカート」「商品購入」「オンライン決済」「ECサイト」等
4. **ログイン・会員系**: 「ログイン機能」「会員登録」「マイページ」「パスワード」等
5. **動的コンテンツ**: 「ブログ機能」「お知らせ更新」「SNSフィード連携」「チャット」「リアルタイム更新」等
6. **バックエンド系**: 「データベース」「検索機能」「フィルター機能」「自動返信メール」等
7. **外部サービス連携**: 「LINE連携」「Instagram連携」「YouTube動画の自動取得」等（ただしiframe埋め込みやリンク設置は可能）
8. **多ページ**: 「複数ページ」「別ページへのリンク」「サブページ」等

## 判定ルール

- 上記に該当する要求が1つでもあれば、その要求ごとにwarningsに追加する
- 該当する要求がなければ warnings は空配列にする
- warningsの各メッセージは、ユーザーに分かりやすい日本語で「何ができないか」と「代替案」を簡潔に書く（50文字以内/件）
- 実現可能な部分はそのまま生成されるので、canProceedは常にtrueにする

## 出力形式

必ず以下のJSON形式のみで回答してください。

{
  "canProceed": true,
  "warnings": [
    "画像の挿入には対応していません。アイコンやCSSデザインで代替します",
    "予約システムは対応外です。電話番号やメールでの予約案内を掲載します"
  ]
}

警告がない場合:
{"canProceed": true, "warnings": []}
  `.trim();
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** 実行可能性チェック結果 */
export interface FeasibilityResponse {
  canProceed: boolean;
  warnings: string[];
}

/**
 * Gemini のレスポンスをパースして実行可能性チェック結果を返す
 *
 * @param rawResponse - Gemini が返したJSON文字列
 * @returns パース済みの実行可能性チェック結果
 */
export function parseFeasibilityResponse(rawResponse: string): FeasibilityResponse {
  const cleaned = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as unknown;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).canProceed !== "boolean" ||
    !Array.isArray((parsed as Record<string, unknown>).warnings)
  ) {
    // パース失敗時はwarnings空で続行（生成を止めない）
    return { canProceed: true, warnings: [] };
  }

  return parsed as FeasibilityResponse;
}
