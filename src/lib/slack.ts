/**
 * Slack Incoming Webhook 通知モジュール
 *
 * 環境変数 SLACK_WEBHOOK_URL が設定されている場合のみ通知を送信する。
 * 通知の失敗でアプリ本体を止めないよう、エラーは握りつぶす。
 */

import { insertErrorLog } from "./db";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SERVICE_NAME = "OnePage-Flash";

export async function notifySlack(title: string, detail = ""): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  let text = `*[${SERVICE_NAME}]*\n*${title}*`;
  if (detail) text += `\n\`\`\`${detail}\`\`\``;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // 通知失敗でもアプリは止めない
  }
}

/**
 * 顧客影響のあるエラーをSlack通知する。
 * apiName: エラー発生API（例: "webhook/stripe", "generate"）
 * message: エラー概要
 * context: 追加情報（subdomain, email, session_id 等）
 */
export async function notifyCustomerError(
  apiName: string,
  message: string,
  context: Record<string, string | number | undefined> = {}
): Promise<void> {
  const contextLines = Object.entries(context)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const title = `:warning: 顧客影響エラー [${apiName}]`;
  const detail = `${message}${contextLines ? "\n---\n" + contextLines : ""}`;
  await Promise.all([
    notifySlack(title, detail),
    insertErrorLog({ apiName, message, context }),
  ]);
}
