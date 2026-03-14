#!/usr/bin/env node
/**
 * E2E テスト: ココナラ連携機能
 *
 * 10個のテストケースを順番に実行する。
 * 本番環境（Render）に対して実行。
 *
 * 使い方:
 *   ADMIN_PASSWORD=xxx DATABASE_URL=postgresql://... node scripts/e2e-coconala.mjs
 *
 * オプション:
 *   APP_URL=https://oneflash.bantex.jp  (デフォルト)
 *   WORKER_URL=https://onepage-flash-router.ai-fudosan.workers.dev  (デフォルト)
 */

import pg from "pg";

const APP_URL = process.env.APP_URL || "https://oneflash.bantex.jp";
const WORKER_URL = process.env.WORKER_URL || "https://onepage-flash-router.ai-fudosan.workers.dev";
const ADMIN_PW = process.env.ADMIN_PASSWORD;
const DB_URL = process.env.DATABASE_URL;

if (!ADMIN_PW) { console.error("ERROR: ADMIN_PASSWORD 未設定"); process.exit(1); }
if (!DB_URL) { console.error("ERROR: DATABASE_URL 未設定"); process.exit(1); }

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

let passed = 0;
let failed = 0;
const testSubdomain = `e2e-coconala-${Date.now()}`;
let createdSubscriptionId = null;

function log(label, msg) { console.log(`  [${label}] ${msg}`); }

async function runTest(name, fn) {
  process.stdout.write(`\nTest ${passed + failed + 1}: ${name} ... `);
  try {
    await fn();
    console.log("PASS ✓");
    passed++;
  } catch (err) {
    console.log("FAIL ✗");
    console.error(`  → ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// =========================================================================
// テストケース
// =========================================================================

async function main() {
  console.log("==========================================");
  console.log("  E2E テスト: ココナラ連携機能（10件）");
  console.log("==========================================");
  console.log(`  APP_URL: ${APP_URL}`);
  console.log(`  Subdomain: ${testSubdomain}`);

  // -----------------------------------------------------------------------
  // Test 1: adminモードでサイト公開（正しいパスワード）
  // -----------------------------------------------------------------------
  await runTest("adminモードでサイト直接公開", async () => {
    const res = await fetch(`${APP_URL}/api/admin/publish-site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pw: ADMIN_PW,
        formData: {
          siteName: "E2Eテスト美容室",
          catchphrase: "あなたの美しさを引き出す",
          description: "カット・カラー・パーマの専門サロン",
          contactInfo: "090-1234-5678",
          colorTheme: "bloom-pink",
          email: "e2e-test@example.com",
          subdomain: testSubdomain,
        },
        html: "<html><body><h1>E2E Test</h1></body></html>",
        coconalaOrderId: "coconala-e2e-001",
        sendEmail: false,
      }),
    });
    const data = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(data)}`);
    assert(data.success === true, "success should be true");
    assert(data.site.subdomain === testSubdomain, "subdomain mismatch");
    assert(data.site.revisionToken, "revisionToken should exist");
    assert(data.subscription.paymentSource === "coconala", "paymentSource should be coconala");
    assert(data.subscription.expiresAt, "expiresAt should exist");
    createdSubscriptionId = data.subscription.id;
    log("OK", `公開URL: ${data.site.publicUrl}`);
    log("OK", `有効期限: ${data.subscription.expiresAt}`);
  });

  // -----------------------------------------------------------------------
  // Test 2: 公開されたサイトにアクセスできる
  // -----------------------------------------------------------------------
  await runTest("公開サイトへのアクセス確認", async () => {
    const res = await fetch(`${WORKER_URL}/s/${testSubdomain}`);
    assert(res.ok, `Site access failed: ${res.status}`);
    const html = await res.text();
    assert(html.includes("E2E Test"), "HTML content mismatch");
    log("OK", "サイトが正常に表示されています");
  });

  // -----------------------------------------------------------------------
  // Test 3: DB確認 - payment_source=coconala, expires_at設定済み
  // -----------------------------------------------------------------------
  await runTest("DB: サブスクリプションがcoconalaで登録", async () => {
    const result = await pool.query(
      `SELECT sub.payment_source, sub.coconala_order_id, sub.expires_at, sub.status, s.is_active
       FROM opf_sites s
       JOIN opf_subscriptions sub ON s.subscription_id = sub.id
       WHERE s.subdomain = $1`,
      [testSubdomain]
    );
    assert(result.rows.length === 1, "Site not found in DB");
    const row = result.rows[0];
    assert(row.payment_source === "coconala", `payment_source=${row.payment_source}`);
    assert(row.coconala_order_id === "coconala-e2e-001", `order_id=${row.coconala_order_id}`);
    assert(row.expires_at !== null, "expires_at is null");
    assert(row.status === "active", `status=${row.status}`);
    assert(row.is_active === true, "is_active should be true");
    log("OK", `payment_source=${row.payment_source}, expires=${new Date(row.expires_at).toISOString()}`);
  });

  // -----------------------------------------------------------------------
  // Test 4: パスワード不正 → 401エラー
  // -----------------------------------------------------------------------
  await runTest("不正パスワードで401エラー", async () => {
    const res = await fetch(`${APP_URL}/api/admin/publish-site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pw: "wrong-password", formData: {}, html: "<html></html>" }),
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    log("OK", "不正パスワードで正しく拒否");
  });

  // -----------------------------------------------------------------------
  // Test 5: サブドメイン重複 → 409エラー
  // -----------------------------------------------------------------------
  await runTest("サブドメイン重複で409エラー", async () => {
    const res = await fetch(`${APP_URL}/api/admin/publish-site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pw: ADMIN_PW,
        formData: {
          siteName: "重複テスト",
          catchphrase: "test",
          description: "test",
          contactInfo: "test",
          colorTheme: "clean-light",
          email: "dup@example.com",
          subdomain: testSubdomain,
        },
        html: "<html><body>dup</body></html>",
        sendEmail: false,
      }),
    });
    assert(res.status === 409, `Expected 409, got ${res.status}`);
    log("OK", "サブドメイン重複で正しく拒否");
  });

  // -----------------------------------------------------------------------
  // Test 6: 顧客一覧APIでココナラ顧客が表示される
  // -----------------------------------------------------------------------
  await runTest("顧客一覧APIにココナラ顧客表示", async () => {
    const res = await fetch(`${APP_URL}/api/admin/customers?pw=${encodeURIComponent(ADMIN_PW)}&filter=all`);
    assert(res.ok, `Status ${res.status}`);
    const data = await res.json();
    assert(data.customers.length > 0, "No customers returned");
    const coconalaCustomer = data.customers.find(c => c.subdomain === testSubdomain);
    assert(coconalaCustomer, "E2E test customer not found in list");
    assert(coconalaCustomer.paymentSource === "coconala", "paymentSource mismatch");
    assert(coconalaCustomer.expiresAt !== null, "expiresAt should exist");
    assert(data.summary.coconalaCount > 0, "coconalaCount should be > 0");
    log("OK", `顧客数: ${data.summary.total}件（Stripe: ${data.summary.stripeCount}, ココナラ: ${data.summary.coconalaCount}）`);
  });

  // -----------------------------------------------------------------------
  // Test 7: 課金確認 → 有効期限35日延長
  // -----------------------------------------------------------------------
  await runTest("課金確認で有効期限35日延長", async () => {
    assert(createdSubscriptionId, "subscriptionId not available");

    // 延長前のexpires_atを取得
    const before = await pool.query(
      `SELECT expires_at FROM opf_subscriptions WHERE id = $1`,
      [createdSubscriptionId]
    );
    const beforeExpiry = new Date(before.rows[0].expires_at);

    const res = await fetch(`${APP_URL}/api/admin/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pw: ADMIN_PW,
        subscriptionId: createdSubscriptionId,
        amount: 1000,
        memo: "E2Eテスト課金確認",
      }),
    });
    const data = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(data)}`);
    assert(data.success === true, "success should be true");

    const newExpiry = new Date(data.subscription.newExpiresAt);
    const diffDays = (newExpiry - beforeExpiry) / (1000 * 60 * 60 * 24);
    assert(diffDays >= 34 && diffDays <= 36, `Expected ~35 days extension, got ${diffDays.toFixed(1)} days`);
    log("OK", `延長: ${beforeExpiry.toISOString()} → ${newExpiry.toISOString()} (+${diffDays.toFixed(1)}日)`);
  });

  // -----------------------------------------------------------------------
  // Test 8: 課金ログがopf_payment_logsに記録される
  // -----------------------------------------------------------------------
  await runTest("課金ログがDBに記録", async () => {
    const result = await pool.query(
      `SELECT * FROM opf_payment_logs WHERE subscription_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [createdSubscriptionId]
    );
    assert(result.rows.length === 1, "Payment log not found");
    const log_row = result.rows[0];
    assert(log_row.amount === 1000, `amount=${log_row.amount}`);
    assert(log_row.source === "coconala", `source=${log_row.source}`);
    assert(log_row.memo === "E2Eテスト課金確認", `memo=${log_row.memo}`);
    log("OK", `ログID: ${log_row.id}, 金額: ${log_row.amount}円`);
  });

  // -----------------------------------------------------------------------
  // Test 9: サイト停止 → 非公開化
  // -----------------------------------------------------------------------
  await runTest("サイト停止（非公開化）", async () => {
    const res = await fetch(`${APP_URL}/api/admin/update-site-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pw: ADMIN_PW, subdomain: testSubdomain, action: "deactivate" }),
    });
    const data = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(data)}`);
    assert(data.action === "deactivated", "action should be deactivated");

    // DB確認
    const dbResult = await pool.query(
      `SELECT is_active FROM opf_sites WHERE subdomain = $1`,
      [testSubdomain]
    );
    assert(dbResult.rows[0].is_active === false, "is_active should be false");

    // サイトが非公開ページになっている
    const siteRes = await fetch(`${WORKER_URL}/s/${testSubdomain}`);
    const html = await siteRes.text();
    assert(html.includes("非公開"), "Site should show unavailable page");
    log("OK", "サイト非公開化完了");
  });

  // -----------------------------------------------------------------------
  // Test 10: サイト再公開 → バックアップから復元
  // -----------------------------------------------------------------------
  await runTest("サイト再公開（バックアップ復元）", async () => {
    const res = await fetch(`${APP_URL}/api/admin/update-site-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pw: ADMIN_PW, subdomain: testSubdomain, action: "reactivate" }),
    });
    const data = await res.json();
    assert(res.ok, `Status ${res.status}: ${JSON.stringify(data)}`);
    assert(data.action === "reactivated", "action should be reactivated");

    // DB確認
    const dbResult = await pool.query(
      `SELECT is_active FROM opf_sites WHERE subdomain = $1`,
      [testSubdomain]
    );
    assert(dbResult.rows[0].is_active === true, "is_active should be true");

    // サイトが復元されている
    const siteRes = await fetch(`${WORKER_URL}/s/${testSubdomain}`);
    const html = await siteRes.text();
    assert(html.includes("E2E Test"), "Site should be restored with original content");
    log("OK", "サイト再公開完了");
  });

  // =========================================================================
  // クリーンアップ
  // =========================================================================
  console.log("\n--- クリーンアップ ---");
  try {
    // テストデータ削除
    await pool.query(`DELETE FROM opf_payment_logs WHERE subscription_id = $1`, [createdSubscriptionId]);
    const siteResult = await pool.query(`SELECT id, subscription_id FROM opf_sites WHERE subdomain = $1`, [testSubdomain]);
    if (siteResult.rows[0]) {
      await pool.query(`DELETE FROM opf_revisions WHERE site_id = $1`, [siteResult.rows[0].id]);
      await pool.query(`DELETE FROM opf_sites WHERE id = $1`, [siteResult.rows[0].id]);
      await pool.query(`DELETE FROM opf_subscriptions WHERE id = $1`, [siteResult.rows[0].subscription_id]);
    }
    await pool.query(`DELETE FROM opf_html_backups WHERE subdomain = $1`, [testSubdomain]);
    await pool.query(`DELETE FROM opf_users WHERE email = 'e2e-test@example.com'`);
    log("Cleanup", "テストデータ削除完了");
  } catch (err) {
    log("Cleanup", `WARNING: クリーンアップ失敗: ${err.message}`);
  }

  // =========================================================================
  // 結果
  // =========================================================================
  console.log("\n==========================================");
  console.log(`  結果: ${passed} PASS / ${failed} FAIL / ${passed + failed} TOTAL`);
  console.log("==========================================\n");

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  pool.end();
  process.exit(1);
});
