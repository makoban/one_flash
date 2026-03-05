/**
 * Slack Incoming Webhook 通知モジュール
 *
 * 環境変数 SLACK_WEBHOOK_URL が設定されている場合のみ通知を送信する。
 * 通知の失敗でバッチ本体を止めないよう、エラーは握りつぶす。
 */

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
    // 通知失敗でもバッチは止めない
  }
}
