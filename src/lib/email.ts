/**
 * Resend メール送信モジュール
 *
 * 送信するメール種別:
 *   1. サイト完成通知メール（公開URL + 修正用URL）
 *   2. 修正完了通知メール
 *   3. 修正有料決済後の完了通知メール
 */

import { Resend } from "resend";

// ---------------------------------------------------------------------------
// 環境変数のバリデーション
// ---------------------------------------------------------------------------
const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error("Missing environment variable: RESEND_API_KEY");
}

// ---------------------------------------------------------------------------
// Resend クライアント初期化
// ---------------------------------------------------------------------------
export const resend = new Resend(resendApiKey);

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** 送信元メールアドレス（Resendで認証済みドメインのアドレスを設定） */
const FROM_EMAIL = "OnePage-Flash <noreply@info-page.jp>";

/** サービス名 */
const SERVICE_NAME = "OnePage-Flash";

// ---------------------------------------------------------------------------
// メール送信関数
// ---------------------------------------------------------------------------

/**
 * サイト完成通知メールを送信する
 *
 * @param params.to - 送信先メールアドレス
 * @param params.siteName - 生成されたサイト名
 * @param params.publicUrl - 生成サイトの公開URL
 * @param params.revisionUrl - 修正用URL（トークン付き）
 * @param params.freeRevisionsRemaining - 残り無料修正回数
 */
export async function sendSiteCompletionEmail(params: {
  to: string;
  siteName: string;
  publicUrl: string;
  revisionUrl: string;
  freeRevisionsRemaining: number;
}): Promise<void> {
  const { to, siteName, publicUrl, revisionUrl, freeRevisionsRemaining } =
    params;

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `【${SERVICE_NAME}】「${siteName}」が完成しました`,
    html: buildSiteCompletionEmailHtml({
      siteName,
      publicUrl,
      revisionUrl,
      freeRevisionsRemaining,
    }),
  });
}

/**
 * 修正完了通知メールを送信する
 *
 * @param params.to - 送信先メールアドレス
 * @param params.siteName - サイト名
 * @param params.publicUrl - 公開URL
 * @param params.revisionUrl - 修正用URL
 * @param params.freeRevisionsRemaining - 残り無料修正回数
 */
export async function sendRevisionCompletionEmail(params: {
  to: string;
  siteName: string;
  publicUrl: string;
  revisionUrl: string;
  freeRevisionsRemaining: number;
}): Promise<void> {
  const { to, siteName, publicUrl, revisionUrl, freeRevisionsRemaining } =
    params;

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `【${SERVICE_NAME}】「${siteName}」の修正が完了しました`,
    html: buildRevisionCompletionEmailHtml({
      siteName,
      publicUrl,
      revisionUrl,
      freeRevisionsRemaining,
    }),
  });
}

// ---------------------------------------------------------------------------
// メールHTML生成関数（プライベート）
// ---------------------------------------------------------------------------

function buildSiteCompletionEmailHtml(params: {
  siteName: string;
  publicUrl: string;
  revisionUrl: string;
  freeRevisionsRemaining: number;
}): string {
  const { siteName, publicUrl, revisionUrl, freeRevisionsRemaining } = params;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>サイト完成のお知らせ</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${SERVICE_NAME}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">ホームページ完成のお知らせ</p>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e8e8e8; border-top: none;">
    <p>この度は ${SERVICE_NAME} をご利用いただきありがとうございます。</p>
    <p>「<strong>${siteName}</strong>」のホームページが完成しました！</p>

    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 12px; font-size: 14px; color: #666;">公開URL</p>
      <a href="${publicUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
        サイトを確認する
      </a>
      <p style="margin: 12px 0 0; font-size: 12px; color: #999;">${publicUrl}</p>
    </div>

    <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 24px 0;">

    <h3 style="font-size: 16px; margin: 0 0 12px;">修正について</h3>
    <p style="margin: 0 0 8px;">無料修正が <strong>${freeRevisionsRemaining}回</strong> 残っています。</p>
    <p style="margin: 0 0 16px; font-size: 14px; color: #666;">修正希望の場合は以下のURLからご依頼ください（3回目以降は500円/回）。</p>

    <a href="${revisionUrl}" style="display: inline-block; border: 2px solid #667eea; color: #667eea; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
      修正を依頼する
    </a>

    <p style="margin: 16px 0 0; font-size: 11px; color: #bbb;">このURLは修正用の専用URLです。第三者と共有しないようご注意ください。</p>
  </div>

  <div style="background: #f8f9fa; padding: 16px; border-radius: 0 0 12px 12px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #999;">© ${SERVICE_NAME} | ご不明な点はメールにてお問い合わせください。</p>
  </div>
</body>
</html>
  `.trim();
}

function buildRevisionCompletionEmailHtml(params: {
  siteName: string;
  publicUrl: string;
  revisionUrl: string;
  freeRevisionsRemaining: number;
}): string {
  const { siteName, publicUrl, revisionUrl, freeRevisionsRemaining } = params;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>修正完了のお知らせ</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${SERVICE_NAME}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">修正完了のお知らせ</p>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e8e8e8; border-top: none;">
    <p>「<strong>${siteName}</strong>」の修正が完了しました。</p>

    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 12px; font-size: 14px; color: #666;">更新されたサイトを確認する</p>
      <a href="${publicUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
        サイトを確認する
      </a>
    </div>

    <p style="font-size: 14px; color: #666;">
      無料修正の残り回数: <strong>${freeRevisionsRemaining}回</strong>
      ${freeRevisionsRemaining === 0 ? "（3回目以降は500円/回となります）" : ""}
    </p>

    <a href="${revisionUrl}" style="display: inline-block; border: 2px solid #667eea; color: #667eea; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
      さらに修正を依頼する
    </a>
  </div>

  <div style="background: #f8f9fa; padding: 16px; border-radius: 0 0 12px 12px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #999;">© ${SERVICE_NAME} | ご不明な点はメールにてお問い合わせください。</p>
  </div>
</body>
</html>
  `.trim();
}

// ---------------------------------------------------------------------------
// TODO: 本格実装時に追加する機能
// ---------------------------------------------------------------------------
// export async function sendPaymentFailureEmail(...) { ... }
// export async function sendAdminAlertEmail(...) { ... }
