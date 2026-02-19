/**
 * プロンプトC: コード・リファイナー（修正用）
 *
 * 既存のHTMLに対してユーザーの修正指示を適用する。
 *
 * 制約:
 *   - HTML全体の構造は変更しない（セクションの追加・削除は行わない）
 *   - テキスト内容・色・フォントサイズなどの細部のみ変更する
 *   - 外部画像URLは引き続き使用しない
 *   - Tailwind / Google Fonts / Lucide の CDN 参照は維持する
 *   - 修正指示は200文字以内（呼び出し元でバリデーション済み）
 *
 * 使用モデル: geminiModel（temperature: 0.3 でブレを最小化）
 */

// ---------------------------------------------------------------------------
// プロンプト生成関数
// ---------------------------------------------------------------------------

/**
 * リファイナープロンプトを生成する
 *
 * @param currentHtml - 現在のHTMLコード
 * @param instruction - ユーザーの修正指示（200文字以内）
 * @returns Gemini に送信するプロンプト文字列
 */
export function buildRefinerPrompt(
  currentHtml: string,
  instruction: string
): string {
  return `
あなたはプロのWebエンジニアです。
既存のHTMLコードに対して、ユーザーの修正指示を適用してください。

## 修正指示

${instruction}

## 重要な制約（必ず守ること）

1. HTMLの全体構造（セクション構成）は変更しない
2. テキスト内容・色・サイズ・余白などの細部のみ変更する
3. 外部画像URL（http/httpsから始まるimg srcのURL）は追加しない
4. Tailwind CSS / Google Fonts / Lucide Icons の CDN 参照は削除しない
5. JavaScriptは既存のもの以外は追加しない
6. 完全なHTMLファイルを出力する（<!DOCTYPE html>から</html>まで）

## 既存のHTMLコード

${currentHtml}

## 出力形式

修正済みのHTMLコードのみを出力してください。
コードブロック記法（\`\`\`html ... \`\`\`）は不要です。
説明文や変更点の解説も不要です。
<!DOCTYPE html> から始まり </html> で終わる完全なHTMLのみを返してください。
  `.trim();
}

// ---------------------------------------------------------------------------
// レスポンスパース関数
// ---------------------------------------------------------------------------

/**
 * Gemini のレスポンスから修正済みHTML文字列を抽出する
 *
 * @param rawResponse - Gemini が返した文字列
 * @returns クリーンなHTML文字列
 * @throws 有効なHTMLが見つからない場合
 */
export function parseRefinerResponse(rawResponse: string): string {
  // コードブロック記法を除去
  let html = rawResponse
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // DOCTYPE から始まることを確認
  if (!html.toLowerCase().startsWith("<!doctype html")) {
    const doctypeIndex = html.toLowerCase().indexOf("<!doctype html");
    if (doctypeIndex === -1) {
      throw new Error("Refined HTML does not contain DOCTYPE declaration");
    }
    html = html.substring(doctypeIndex);
  }

  // </html> で終わることを確認
  if (!html.toLowerCase().endsWith("</html>")) {
    const htmlEndIndex = html.toLowerCase().lastIndexOf("</html>");
    if (htmlEndIndex === -1) {
      throw new Error("Refined HTML does not contain closing </html> tag");
    }
    html = html.substring(0, htmlEndIndex + 7);
  }

  return html;
}

// ---------------------------------------------------------------------------
// バリデーション関数
// ---------------------------------------------------------------------------

/**
 * 修正指示のバリデーション
 *
 * @param instruction - ユーザーの修正指示
 * @returns バリデーション結果
 */
export function validateRevisionInstruction(instruction: string): {
  isValid: boolean;
  error?: string;
} {
  const trimmed = instruction.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: "修正指示を入力してください" };
  }

  if (trimmed.length > 200) {
    return {
      isValid: false,
      error: `修正指示は200文字以内で入力してください（現在: ${trimmed.length}文字）`,
    };
  }

  return { isValid: true };
}
