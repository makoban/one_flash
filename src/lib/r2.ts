/**
 * Cloudflare R2 クライアント初期化モジュール
 *
 * R2 は S3互換API を提供しているため @aws-sdk/client-s3 を使用。
 * エンドポイントURL形式: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *
 * 保存キー形式: <site-slug>/index.html
 * 例: abc123/index.html → https://abc123.info-page.jp でアクセス可能
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// ---------------------------------------------------------------------------
// R2 S3クライアント（遅延初期化）
// ---------------------------------------------------------------------------

let _r2Client: S3Client | null = null;
let _bucketName: string | null = null;

function getR2Config() {
  if (_r2Client && _bucketName) return { client: _r2Client, bucket: _bucketName };

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "Missing R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
    );
  }

  _r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  _bucketName = bucketName;

  return { client: _r2Client, bucket: _bucketName };
}

// ---------------------------------------------------------------------------
// ヘルパー関数
// ---------------------------------------------------------------------------

/**
 * R2 にHTMLファイルを保存する
 * @param slug - サイトのスラッグ（サブドメインと同一）
 * @param htmlContent - 保存するHTML文字列
 */
export async function uploadSiteHTML(slug: string, htmlContent: string): Promise<void> {
  const { client, bucket } = getR2Config();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: `${slug}/index.html`,
    Body: htmlContent,
    ContentType: "text/html; charset=utf-8",
    CacheControl: "public, max-age=3600",
  });

  await client.send(command);
}

/**
 * R2 からHTMLファイルを取得する
 * @param slug - サイトのスラッグ
 * @returns HTML文字列
 */
export async function getSiteHTML(slug: string): Promise<string | null> {
  try {
    const { client, bucket } = getR2Config();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: `${slug}/index.html`,
    });

    const response = await client.send(command);
    const bodyContents = await response.Body?.transformToString("utf-8");
    return bodyContents ?? null;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "name" in error &&
      error.name === "NoSuchKey"
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * R2 からHTMLファイルを削除する（管理用）
 * @param slug - サイトのスラッグ
 */
export async function deleteSiteHTML(slug: string): Promise<void> {
  const { client, bucket } = getR2Config();
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: `${slug}/index.html`,
  });

  await client.send(command);
}

/**
 * サイトの公開URLを生成する
 * @param slug - サイトのスラッグ
 * @returns 公開URL文字列（例: https://abc123.info-page.jp）
 */
export function getSitePublicUrl(slug: string): string {
  const siteDomain = process.env.SITE_DOMAIN ?? "info-page.jp";
  return `https://${slug}.${siteDomain}`;
}

// ---------------------------------------------------------------------------
// ドラフト HTML 管理（決済完了前の一時保存）
// ---------------------------------------------------------------------------

/**
 * 決済完了前のHTMLをドラフトとして R2 に一時保存する
 * @param draftId - UUID形式のドラフトID
 * @param htmlContent - 保存するHTML文字列
 */
export async function uploadDraftHTML(draftId: string, htmlContent: string): Promise<void> {
  const { client, bucket } = getR2Config();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: `_drafts/${draftId}/index.html`,
    Body: htmlContent,
    ContentType: "text/html; charset=utf-8",
  });
  await client.send(command);
}

/**
 * ドラフトHTMLを取得する
 * @param draftId - UUID形式のドラフトID
 * @returns HTML文字列 or null
 */
export async function getDraftHTML(draftId: string): Promise<string | null> {
  try {
    const { client, bucket } = getR2Config();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: `_drafts/${draftId}/index.html`,
    });
    const response = await client.send(command);
    return (await response.Body?.transformToString("utf-8")) ?? null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "NoSuchKey") return null;
    throw error;
  }
}

/**
 * ドラフトHTMLを削除する
 * @param draftId - UUID形式のドラフトID
 */
export async function deleteDraftHTML(draftId: string): Promise<void> {
  const { client, bucket } = getR2Config();
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: `_drafts/${draftId}/index.html`,
  });
  await client.send(command);
}

// ---------------------------------------------------------------------------
// サブスク解約時のサイト非公開化
// ---------------------------------------------------------------------------

/**
 * サイトを非公開にする（HTMLをバックアップし「非公開」ページに差し替え）
 * @param slug - サイトのスラッグ
 * @param siteName - サイト名（非公開ページに表示）
 */
export async function deactivateSite(slug: string, siteName: string): Promise<void> {
  const { client, bucket } = getR2Config();

  // 現在のHTMLをバックアップ
  const currentHtml = await getSiteHTML(slug);
  if (currentHtml) {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${slug}/index.html.bak`,
      Body: currentHtml,
      ContentType: "text/html; charset=utf-8",
    }));
  }

  // 非公開ページに差し替え
  const unavailableHtml = buildUnavailablePage(siteName);
  await uploadSiteHTML(slug, unavailableHtml);
}

/**
 * サイトを再公開する（バックアップからHTMLを復元）
 * @param slug - サイトのスラッグ
 * @returns 復元成功したか
 */
export async function reactivateSite(slug: string): Promise<boolean> {
  try {
    const { client, bucket } = getR2Config();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: `${slug}/index.html.bak`,
    });
    const response = await client.send(command);
    const backupHtml = await response.Body?.transformToString("utf-8");
    if (!backupHtml) return false;

    await uploadSiteHTML(slug, backupHtml);
    return true;
  } catch {
    return false;
  }
}

function buildUnavailablePage(siteName: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName} - 現在非公開</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8f9fa; color: #333; }
    .container { text-align: center; padding: 40px; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>このサイトは現在非公開です</h1>
    <p>「${siteName}」は現在ご利用いただけません。</p>
    <p style="margin-top:2rem;font-size:0.75rem;color:#999;">Powered by OnePage-Flash</p>
  </div>
</body>
</html>`;
}
