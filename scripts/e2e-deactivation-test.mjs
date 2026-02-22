#!/usr/bin/env node
/**
 * E2E 解約→非公開テスト（Puppeteer ブラウザ自動操作）
 *
 * 1. サンプルサイトをR2に公開し、DBにサブスク情報を登録
 * 2. ブラウザでサイトが見えることを確認
 * 3. 解約をシミュレーション（DB更新 + R2非公開ページ差替え）
 * 4. ブラウザでサイトが「非公開」になったことを確認
 * 5. 再開をシミュレーション（バックアップ復元）
 * 6. ブラウザでサイトが再び見えることを確認
 * 7. テストデータをクリーンアップ
 *
 * 使い方:
 *   DATABASE_URL=... WORKER_URL=... UPLOAD_SECRET=... node scripts/e2e-deactivation-test.mjs
 *
 * ルール: E2Eテストは常にPuppeteerブラウザ自動操作で本番環境でユーザー同様にテストする
 */

import puppeteer from "puppeteer-core";
import pg from "pg";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------
const WORKER_URL = process.env.WORKER_URL || "https://onepage-flash-router.ai-fudosan.workers.dev";
const UPLOAD_SECRET = process.env.UPLOAD_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const SCREENSHOT_DIR = "C:\\Users\\banma\\Pictures\\Screenshots";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const TEST_SUBDOMAIN = `deact-test-${Date.now().toString(36)}`;
const TEST_EMAIL = "deactivation-test@example.com";
const TEST_SITE_NAME = "解約テスト整体院";

if (!UPLOAD_SECRET) { console.error("ERROR: UPLOAD_SECRET 環境変数が未設定"); process.exit(1); }
if (!DATABASE_URL) { console.error("ERROR: DATABASE_URL 環境変数が未設定"); process.exit(1); }

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const screenshots = [];

function log(phase, msg) {
  const ts = new Date().toLocaleTimeString("ja-JP");
  console.log(`[${ts}] [${phase}] ${msg}`);
}

async function snap(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `e2e-deact-${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  screenshots.push(filePath);
  log("-", `Screenshot: ${path.basename(filePath)}`);
  return filePath;
}

// テストHTML
const TEST_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${TEST_SITE_NAME}</title>
  <style>
    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
    .container { text-align: center; padding: 40px; max-width: 600px; }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    p { font-size: 1.2rem; opacity: 0.9; }
    .badge { display: inline-block; padding: 8px 20px; background: rgba(255,255,255,0.2); border-radius: 999px; font-size: 0.9rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${TEST_SITE_NAME}</h1>
    <p>このページはE2E解約テスト用の公開サイトです。</p>
    <p>あなたの体の悩みを根本から改善します。</p>
    <div class="badge">E2E-DEACTIVATION-TEST-ACTIVE</div>
  </div>
</body>
</html>`;

// ---------------------------------------------------------------------------
// DB操作
// ---------------------------------------------------------------------------
async function getPool() {
  return new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}

async function setupTestData(pool) {
  log("DB", "テストデータ作成中...");

  // opf_users
  const userRes = await pool.query(
    `INSERT INTO opf_users (email, stripe_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = NOW()
     RETURNING id`,
    [TEST_EMAIL, "cus_test_deact_" + Date.now()]
  );
  const userId = userRes.rows[0].id;
  log("DB", `opf_users: id=${userId}`);

  // opf_subscriptions
  const fakeSubId = "sub_test_deact_" + Date.now();
  const subRes = await pool.query(
    `INSERT INTO opf_subscriptions (user_id, stripe_subscription_id, status, current_period_start, current_period_end)
     VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '30 days')
     RETURNING id`,
    [userId, fakeSubId]
  );
  const subscriptionId = subRes.rows[0].id;
  log("DB", `opf_subscriptions: id=${subscriptionId}, stripe_sub=${fakeSubId}`);

  // opf_sites
  const siteRes = await pool.query(
    `INSERT INTO opf_sites (user_id, subscription_id, subdomain, site_name, is_active, is_published, input_snapshot)
     VALUES ($1, $2, $3, $4, true, true, $5)
     RETURNING id`,
    [userId, subscriptionId, TEST_SUBDOMAIN, TEST_SITE_NAME, JSON.stringify({ email: TEST_EMAIL })]
  );
  const siteId = siteRes.rows[0].id;
  log("DB", `opf_sites: id=${siteId}, subdomain=${TEST_SUBDOMAIN}, is_active=true`);

  return { userId, subscriptionId, siteId, fakeSubId };
}

async function simulateDeactivation(pool, testData) {
  log("DB", "解約シミュレーション: DB更新中...");

  // opf_subscriptions: status → canceled
  await pool.query(
    `UPDATE opf_subscriptions SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [testData.subscriptionId]
  );
  log("DB", `opf_subscriptions: status → canceled`);

  // opf_sites: is_active → false
  await pool.query(
    `UPDATE opf_sites SET is_active = false, updated_at = NOW()
     WHERE subdomain = $1`,
    [TEST_SUBDOMAIN]
  );
  log("DB", `opf_sites: is_active → false`);
}

async function simulateReactivation(pool, testData) {
  log("DB", "再開シミュレーション: DB更新中...");

  // opf_subscriptions: status → active
  await pool.query(
    `UPDATE opf_subscriptions SET status = 'active', canceled_at = NULL, updated_at = NOW()
     WHERE id = $1`,
    [testData.subscriptionId]
  );
  log("DB", `opf_subscriptions: status → active`);

  // opf_sites: is_active → true
  await pool.query(
    `UPDATE opf_sites SET is_active = true, updated_at = NOW()
     WHERE subdomain = $1`,
    [TEST_SUBDOMAIN]
  );
  log("DB", `opf_sites: is_active → true`);
}

async function cleanupTestData(pool, testData) {
  log("CLEANUP", "テストデータ削除中...");
  await pool.query(`DELETE FROM opf_sites WHERE id = $1`, [testData.siteId]).catch(() => {});
  await pool.query(`DELETE FROM opf_subscriptions WHERE id = $1`, [testData.subscriptionId]).catch(() => {});
  await pool.query(`DELETE FROM opf_html_backups WHERE subdomain = $1`, [TEST_SUBDOMAIN]).catch(() => {});
  await pool.query(`DELETE FROM opf_users WHERE id = $1`, [testData.userId]).catch(() => {});
  log("CLEANUP", "DBレコード削除完了");
}

// ---------------------------------------------------------------------------
// R2操作（Worker API経由）
// ---------------------------------------------------------------------------
async function publishToR2(subdomain, html) {
  log("R2", `HTMLをR2に公開中: ${subdomain}`);
  const res = await fetch(`${WORKER_URL}/_api/update-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subdomain, html, secret: UPLOAD_SECRET }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`R2 publish failed: ${res.status} ${err}`);
  }
  log("R2", `公開完了: ${WORKER_URL}/s/${subdomain}`);
}

async function deactivateInR2(subdomain, siteName) {
  log("R2", `非公開化中: ${subdomain}`);

  // 1. 現在のHTMLをバックアップ
  const getRes = await fetch(`${WORKER_URL}/_api/get-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subdomain, secret: UPLOAD_SECRET }),
  });
  if (getRes.ok) {
    const { html } = await getRes.json();
    // DBにバックアップ
    const pool = await getPool();
    await pool.query(
      `INSERT INTO opf_html_backups (subdomain, html)
       VALUES ($1, $2)
       ON CONFLICT (subdomain) DO UPDATE SET html = EXCLUDED.html, created_at = NOW()`,
      [subdomain, html]
    );
    await pool.end();
    log("R2", `HTMLバックアップ保存済み (${html.length} bytes)`);
  }

  // 2. 非公開ページに差し替え
  const unavailableHtml = `<!DOCTYPE html>
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

  await publishToR2(subdomain, unavailableHtml);
  log("R2", `非公開ページに差替え完了`);
}

async function reactivateInR2(subdomain) {
  log("R2", `再公開中: ${subdomain}`);

  // DBからバックアップ取得
  const pool = await getPool();
  const result = await pool.query(
    `SELECT html FROM opf_html_backups WHERE subdomain = $1`,
    [subdomain]
  );
  await pool.end();

  if (result.rows.length === 0 || !result.rows[0].html) {
    log("R2", "ERROR: バックアップが見つかりません");
    return false;
  }

  const backupHtml = result.rows[0].html;
  await publishToR2(subdomain, backupHtml);
  log("R2", `バックアップHTML復元完了 (${backupHtml.length} bytes)`);
  return true;
}

async function cleanupR2(subdomain) {
  log("CLEANUP", `R2テストデータ削除: ${subdomain}`);
  // 空ページで上書き
  await fetch(`${WORKER_URL}/_api/update-html`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subdomain, html: "<!-- deleted -->", secret: UPLOAD_SECRET }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// メインテスト
// ---------------------------------------------------------------------------
async function main() {
  console.log("============================================================");
  console.log("  E2E 解約→非公開 テスト（Puppeteer + DB + R2）");
  console.log(`  Worker: ${WORKER_URL}`);
  console.log(`  Test subdomain: ${TEST_SUBDOMAIN}`);
  console.log("============================================================\n");

  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const pool = await getPool();
  let testData = null;
  let browser = null;

  const results = {
    setup: false,
    siteVisible: false,
    deactivation: false,
    siteHidden: false,
    reactivation: false,
    siteVisibleAgain: false,
    cleanup: false,
  };

  try {
    // ==========================================================
    // PHASE 1: セットアップ（DB + R2にテストデータ作成）
    // ==========================================================
    log("PHASE1", "=== セットアップ ===");

    // R2にHTML公開
    await publishToR2(TEST_SUBDOMAIN, TEST_HTML);

    // DBにレコード作成
    testData = await setupTestData(pool);
    results.setup = true;
    log("PHASE1", "セットアップ完了");

    // 少し待機（R2反映）
    await delay(2000);

    // ==========================================================
    // PHASE 2: ブラウザでサイト公開を確認
    // ==========================================================
    log("PHASE2", "=== ブラウザでサイト公開確認 ===");

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false,
      defaultViewport: { width: 1280, height: 900 },
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
    });

    const page = await browser.newPage();

    const siteUrl = `${WORKER_URL}/s/${TEST_SUBDOMAIN}`;
    log("PHASE2", `Opening: ${siteUrl}`);
    await page.goto(siteUrl, { waitUntil: "networkidle2", timeout: 30000 });

    const pageContent1 = await page.evaluate(() => document.body.innerText);
    const hasActiveContent = pageContent1.includes("E2E-DEACTIVATION-TEST-ACTIVE")
      || pageContent1.includes(TEST_SITE_NAME)
      || pageContent1.includes("解約テスト");
    const isNotUnavailable1 = !pageContent1.includes("現在非公開");

    log("PHASE2", `Content includes active marker: ${hasActiveContent}`);
    log("PHASE2", `Not showing unavailable: ${isNotUnavailable1}`);
    results.siteVisible = hasActiveContent && isNotUnavailable1;
    await snap(page, "01-site-active");

    if (!results.siteVisible) {
      log("PHASE2", "FAIL: サイトが公開状態で表示されていません");
      log("PHASE2", `Page text: ${pageContent1.substring(0, 200)}`);
    } else {
      log("PHASE2", "PASS: サイトが公開状態で正常に表示されています");
    }

    // ==========================================================
    // PHASE 3: 解約シミュレーション（DB + R2）
    // ==========================================================
    log("PHASE3", "=== 解約シミュレーション ===");

    // DB: ステータスを canceled に
    await simulateDeactivation(pool, testData);

    // R2: HTMLをバックアップして非公開ページに差替え
    await deactivateInR2(TEST_SUBDOMAIN, TEST_SITE_NAME);

    results.deactivation = true;
    log("PHASE3", "解約処理完了");

    await delay(2000);

    // ==========================================================
    // PHASE 4: ブラウザでサイト非公開を確認
    // ==========================================================
    log("PHASE4", "=== ブラウザでサイト非公開確認 ===");

    await page.reload({ waitUntil: "networkidle2" });

    const pageContent2 = await page.evaluate(() => document.body.innerText);
    const showsUnavailable = pageContent2.includes("現在非公開") || pageContent2.includes("ご利用いただけません");
    const noActiveContent = !pageContent2.includes("E2E-DEACTIVATION-TEST-ACTIVE");

    log("PHASE4", `Shows unavailable: ${showsUnavailable}`);
    log("PHASE4", `Active content gone: ${noActiveContent}`);
    results.siteHidden = showsUnavailable && noActiveContent;
    await snap(page, "02-site-deactivated");

    if (!results.siteHidden) {
      log("PHASE4", "FAIL: サイトが非公開になっていません");
      log("PHASE4", `Page text: ${pageContent2.substring(0, 200)}`);
    } else {
      log("PHASE4", "PASS: サイトが「現在非公開」と正しく表示されています");
    }

    // ==========================================================
    // PHASE 5: 再開シミュレーション（DB + R2）
    // ==========================================================
    log("PHASE5", "=== 再開シミュレーション ===");

    // DB: ステータスを active に戻す
    await simulateReactivation(pool, testData);

    // R2: バックアップから復元
    const restored = await reactivateInR2(TEST_SUBDOMAIN);
    results.reactivation = restored;
    log("PHASE5", `バックアップ復元: ${restored ? "成功" : "失敗"}`);

    await delay(2000);

    // ==========================================================
    // PHASE 6: ブラウザでサイト再公開を確認
    // ==========================================================
    log("PHASE6", "=== ブラウザでサイト再公開確認 ===");

    await page.reload({ waitUntil: "networkidle2" });

    const pageContent3 = await page.evaluate(() => document.body.innerText);
    const hasActiveAgain = pageContent3.includes("E2E-DEACTIVATION-TEST-ACTIVE")
      || pageContent3.includes("解約テスト");
    const notUnavailableAgain = !pageContent3.includes("現在非公開");

    log("PHASE6", `Active content restored: ${hasActiveAgain}`);
    log("PHASE6", `Not showing unavailable: ${notUnavailableAgain}`);
    results.siteVisibleAgain = hasActiveAgain && notUnavailableAgain;
    await snap(page, "03-site-reactivated");

    if (!results.siteVisibleAgain) {
      log("PHASE6", "FAIL: サイトが再公開されていません");
      log("PHASE6", `Page text: ${pageContent3.substring(0, 200)}`);
    } else {
      log("PHASE6", "PASS: サイトが再公開され正常に表示されています");
    }

    // ==========================================================
    // PHASE 7: クリーンアップ
    // ==========================================================
    log("PHASE7", "=== クリーンアップ ===");

    await cleanupR2(TEST_SUBDOMAIN);
    await cleanupTestData(pool, testData);
    results.cleanup = true;
    log("PHASE7", "クリーンアップ完了");

    // ==========================================================
    // 結果サマリー
    // ==========================================================
    console.log("\n============================================================");
    console.log("  E2E DEACTIVATION TEST RESULTS");
    console.log("============================================================");
    console.log(`  Setup (DB+R2):        ${results.setup ? "PASS" : "FAIL"}`);
    console.log(`  Site Visible:         ${results.siteVisible ? "PASS" : "FAIL"}`);
    console.log(`  Deactivation:         ${results.deactivation ? "PASS" : "FAIL"}`);
    console.log(`  Site Hidden:          ${results.siteHidden ? "PASS" : "FAIL"}`);
    console.log(`  Reactivation:         ${results.reactivation ? "PASS" : "FAIL"}`);
    console.log(`  Site Visible Again:   ${results.siteVisibleAgain ? "PASS" : "FAIL"}`);
    console.log(`  Cleanup:              ${results.cleanup ? "PASS" : "FAIL"}`);
    console.log("------------------------------------------------------------");
    console.log(`  Screenshots: ${screenshots.length} files`);
    for (const s of screenshots) console.log(`    ${path.basename(s)}`);
    console.log("============================================================");

    const allPass = Object.values(results).every(Boolean);
    if (allPass) {
      console.log("\n  >>> ALL TESTS PASSED <<<");
      console.log("  Verified: Active -> Deactivated -> Reactivated flow works correctly");
    } else {
      console.log("\n  >>> SOME TESTS FAILED <<<");
    }

    log("-", "Browser stays open for 10s...");
    await delay(10000);

  } catch (err) {
    console.error(`\nFATAL: ${err.message}`);
    console.error(err.stack);

    // クリーンアップ（可能な範囲で）
    if (testData) {
      try {
        await cleanupR2(TEST_SUBDOMAIN);
        await cleanupTestData(pool, testData);
      } catch {}
    }
  } finally {
    if (browser) await browser.close();
    await pool.end();
    log("-", "Done.");
  }
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
