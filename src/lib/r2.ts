/**
 * R2 操作モジュール（Worker API + DB 経由）
 *
 * R2 への直接アクセス（S3 API）は使用せず、
 * Cloudflare Worker の API エンドポイント経由で R2 を操作する。
 * ドラフト HTML と HTML バックアップは PostgreSQL に保存する。
 *
 * これにより R2_ACCOUNT_ID 等の環境変数が不要になる。
 */

import { query } from "./db";

// ---------------------------------------------------------------------------
// Worker API ヘルパー
// ---------------------------------------------------------------------------

function getWorkerConfig() {
  const workerUrl = process.env.WORKER_URL;
  const uploadSecret = process.env.UPLOAD_SECRET;
  if (!workerUrl || !uploadSecret) {
    throw new Error("Missing environment variables: WORKER_URL, UPLOAD_SECRET");
  }
  return { workerUrl, uploadSecret };
}

async function workerFetch(endpoint: string, body: Record<string, unknown>): Promise<Response> {
  const { workerUrl, uploadSecret } = getWorkerConfig();
  return fetch(`${workerUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, secret: uploadSecret }),
  });
}

// ---------------------------------------------------------------------------
// サイト HTML 操作（Worker 経由）
// ---------------------------------------------------------------------------

/**
 * R2 に HTML ファイルを保存する（Worker /_api/update-html 経由）
 */
export async function uploadSiteHTML(slug: string, htmlContent: string): Promise<void> {
  const res = await workerFetch("/_api/update-html", { subdomain: slug, html: htmlContent });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`uploadSiteHTML failed: ${JSON.stringify(err)}`);
  }
}

/**
 * R2 から HTML ファイルを取得する（Worker /_api/get-html 経由）
 */
export async function getSiteHTML(slug: string): Promise<string | null> {
  const res = await workerFetch("/_api/get-html", { subdomain: slug });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`getSiteHTML failed: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as { html: string };
  return data.html;
}

/**
 * R2 から HTML ファイルを削除する（update-html で空ページに差し替え）
 */
export async function deleteSiteHTML(slug: string): Promise<void> {
  // Worker に delete エンドポイントがないため、空ページで上書き
  await uploadSiteHTML(slug, "<!-- deleted -->");
}

/**
 * サイトの公開URLを生成する
 */
export function getSitePublicUrl(slug: string): string {
  const siteDomain = process.env.SITE_DOMAIN ?? "oneflash.net";
  return `https://${slug}.${siteDomain}`;
}

// ---------------------------------------------------------------------------
// ドラフト HTML 管理（PostgreSQL に保存）
// ---------------------------------------------------------------------------

/**
 * 決済完了前の HTML をドラフトとして DB に一時保存する
 */
export async function uploadDraftHTML(draftId: string, htmlContent: string): Promise<void> {
  await query(
    `INSERT INTO opf_drafts (draft_id, html)
     VALUES ($1, $2)
     ON CONFLICT (draft_id) DO UPDATE SET html = EXCLUDED.html, created_at = NOW()`,
    [draftId, htmlContent]
  );
}

/**
 * ドラフト HTML を取得する
 */
export async function getDraftHTML(draftId: string): Promise<string | null> {
  const result = await query<{ html: string }>(
    `SELECT html FROM opf_drafts WHERE draft_id = $1`,
    [draftId]
  );
  return result.rows[0]?.html ?? null;
}

/**
 * ドラフト HTML を削除する
 */
export async function deleteDraftHTML(draftId: string): Promise<void> {
  await query(`DELETE FROM opf_drafts WHERE draft_id = $1`, [draftId]);
}

// ---------------------------------------------------------------------------
// サブスク解約時のサイト非公開化
// ---------------------------------------------------------------------------

/**
 * サイトを非公開にする（HTML を DB にバックアップし「非公開」ページに差し替え）
 */
export async function deactivateSite(slug: string, siteName: string): Promise<void> {
  // 現在の HTML を取得してバックアップ
  const currentHtml = await getSiteHTML(slug);
  if (currentHtml) {
    await query(
      `INSERT INTO opf_html_backups (subdomain, html)
       VALUES ($1, $2)
       ON CONFLICT (subdomain) DO UPDATE SET html = EXCLUDED.html, created_at = NOW()`,
      [slug, currentHtml]
    );
  }

  // 非公開ページに差し替え
  const unavailableHtml = buildUnavailablePage(siteName);
  await uploadSiteHTML(slug, unavailableHtml);
}

/**
 * サイトを再公開する（DB のバックアップから HTML を復元）
 */
export async function reactivateSite(slug: string): Promise<boolean> {
  const result = await query<{ html: string }>(
    `SELECT html FROM opf_html_backups WHERE subdomain = $1`,
    [slug]
  );
  const backupHtml = result.rows[0]?.html;
  if (!backupHtml) return false;

  await uploadSiteHTML(slug, backupHtml);
  // バックアップは残しておく（再度非公開→再公開に備えて）
  return true;
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
