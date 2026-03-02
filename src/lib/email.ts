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
// Resend クライアント（遅延初期化: 環境変数未設定でもビルドを通す）
// ---------------------------------------------------------------------------
let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("Missing environment variable: RESEND_API_KEY");
  }
  _resend = new Resend(resendApiKey);
  return _resend;
}

export const resend = new Proxy({} as Resend, {
  get(_, prop) {
    return (getResend() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** 送信元メールアドレス（Resendで認証済みドメインのアドレスを設定） */
const FROM_EMAIL = "OnePage-Flash <noreply@bantex.jp>";

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
 * @param params.billingPortalUrl - Stripe Billing Portal URL（オプション）
 */
export async function sendSiteCompletionEmail(params: {
  to: string;
  siteName: string;
  publicUrl: string;
  revisionUrl: string;
  billingPortalUrl?: string;
}): Promise<void> {
  const { to, siteName, publicUrl, revisionUrl, billingPortalUrl } = params;

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `【${SERVICE_NAME}】「${siteName}」が完成しました`,
    html: buildSiteCompletionEmailHtml({
      siteName,
      publicUrl,
      revisionUrl,
      billingPortalUrl,
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
 */
export async function sendRevisionCompletionEmail(params: {
  to: string;
  siteName: string;
  publicUrl: string;
  revisionUrl: string;
}): Promise<void> {
  const { to, siteName, publicUrl, revisionUrl } = params;

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `【${SERVICE_NAME}】「${siteName}」の修正が完了しました`,
    html: buildRevisionCompletionEmailHtml({
      siteName,
      publicUrl,
      revisionUrl,
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
  billingPortalUrl?: string;
}): string {
  const { siteName, publicUrl, revisionUrl, billingPortalUrl } = params;

  const billingSection = billingPortalUrl
    ? `
    <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 24px 0;">

    <h3 style="font-size: 16px; margin: 0 0 12px;">お支払い・契約管理</h3>
    <p style="margin: 0 0 16px; font-size: 14px; color: #666;">請求履歴の確認、お支払い方法の変更、ご契約の管理は以下からお手続きいただけます。</p>

    <a href="${billingPortalUrl}" style="display: inline-block; border: 2px solid #667eea; color: #667eea; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
      お支払い管理ページ
    </a>`
    : "";

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
    <p style="margin: 0 0 16px; font-size: 14px; color: #666;">修正が必要な場合は以下のURLからご依頼ください。サブスクリプション期間中は修正が可能です。</p>

    <a href="${revisionUrl}" style="display: inline-block; border: 2px solid #667eea; color: #667eea; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
      修正を依頼する
    </a>

    <p style="margin: 16px 0 0; font-size: 11px; color: #bbb;">このURLは修正用の専用URLです。第三者と共有しないようご注意ください。</p>
    ${billingSection}
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
}): string {
  const { siteName, publicUrl, revisionUrl } = params;

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
// 決済失敗通知メール
// ---------------------------------------------------------------------------

/**
 * 決済失敗通知メールを送信する
 *
 * Stripeのリトライ期間中（past_due）にユーザーへ支払い方法の更新を促す。
 */
export async function sendPaymentFailureEmail(params: {
  to: string;
  siteName: string;
  billingPortalUrl?: string;
}): Promise<void> {
  const { to, siteName, billingPortalUrl } = params;

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `【${SERVICE_NAME}】お支払いに失敗しました - 「${siteName}」`,
    html: buildPaymentFailureEmailHtml({ siteName, billingPortalUrl }),
  });
}

function buildPaymentFailureEmailHtml(params: {
  siteName: string;
  billingPortalUrl?: string;
}): string {
  const { siteName, billingPortalUrl } = params;

  const actionSection = billingPortalUrl
    ? `<a href="${billingPortalUrl}" style="display: inline-block; background: #e74c3c; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
        お支払い方法を更新する
      </a>`
    : `<p style="font-size: 14px; color: #666;">お支払い方法の更新については、メールにてお問い合わせください。</p>`;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>お支払い失敗のお知らせ</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${SERVICE_NAME}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">お支払いに関するお知らせ</p>
  </div>

  <div style="background: #fff; padding: 30px; border: 1px solid #e8e8e8; border-top: none;">
    <p>「<strong>${siteName}</strong>」のお支払いが正常に処理されませんでした。</p>

    <div style="background: #fef5f5; border-left: 4px solid #e74c3c; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>現在のサイトは引き続き公開されています。</strong></p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #666;">自動でお支払いを再試行いたしますが、お支払い方法に問題がある場合は更新をお願いいたします。</p>
    </div>

    <p style="font-size: 14px; color: #666;">お支払いが確認できない状態が続くと、サイトが非公開になる場合がございます。</p>

    <div style="text-align: center; margin: 24px 0;">
      ${actionSection}
    </div>
  </div>

  <div style="background: #f8f9fa; padding: 16px; border-radius: 0 0 12px 12px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #999;">© ${SERVICE_NAME} | ご不明な点はメールにてお問い合わせください。</p>
  </div>
</body>
</html>
  `.trim();
}
