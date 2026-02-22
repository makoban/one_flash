#!/usr/bin/env node
/**
 * E2E テストスクリプト: Stripe テスト決済 → サイト公開確認
 *
 * 使い方:
 *   node scripts/e2e-test-stripe.mjs [step]
 *
 * ステップ:
 *   1 (default) - HTML生成 → Checkout URL取得 → ブラウザで決済
 *   2           - 決済後の検証（DB・サイトアクセス確認）
 *   all         - ステップ1実行後、手動決済を待ってステップ2を実行
 *
 * テストカード: 4242 4242 4242 4242 / 有効期限: 任意の未来日 / CVC: 任意3桁
 */

import Stripe from "stripe";

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------
// 環境変数から読み込む（.env ファイルまたはシェルで設定）
// 使い方: STRIPE_SECRET_KEY=sk_test_... node scripts/e2e-test-stripe.mjs
const BASE_URL = process.env.BASE_URL || "https://onepage-flash.onrender.com";
const WORKER_URL = process.env.WORKER_URL || "https://onepage-flash-router.ai-fudosan.workers.dev";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!STRIPE_SECRET_KEY) {
  console.error("ERROR: STRIPE_SECRET_KEY 環境変数が未設定です");
  console.error("  使い方: STRIPE_SECRET_KEY=sk_test_xxx node scripts/e2e-test-stripe.mjs");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const TEST_FORM_DATA = {
  siteName: "E2Eテスト整体院",
  catchphrase: "あなたの体の悩みを根本から改善します",
  description: "当院は10年以上の実績を持つ整体院です。肩こり・腰痛・頭痛でお悩みの方はお気軽にご相談ください。丁寧なカウンセリングで一人ひとりに合った施術を提供します。",
  contactInfo: "電話: 052-000-1234 / 住所: 名古屋市中区栄1-1-1 / 営業時間: 9:00-20:00",
  colorTheme: "simple",
  email: "test-e2e@example.com",
  subdomain: `e2e-test-${Date.now().toString(36)}`,
};

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function logSection(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}\n`);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, data: json };
}

// ---------------------------------------------------------------------------
// Step 1: HTML生成 → Checkout Session作成
// ---------------------------------------------------------------------------
async function step1_generateAndCheckout() {
  logSection("Step 1: HTML生成 + Stripe Checkout Session作成");

  // --- 1a: HTML生成 ---
  log(">>", `HTML生成中... (${BASE_URL}/api/generate)`);
  const genStart = Date.now();
  const genRes = await fetchJson(`${BASE_URL}/api/generate`, {
    method: "POST",
    body: JSON.stringify({ formData: TEST_FORM_DATA }),
  });

  if (!genRes.ok) {
    log("!!", `HTML生成失敗: ${genRes.status} ${JSON.stringify(genRes.data)}`);
    process.exit(1);
  }

  const html = genRes.data.html;
  const genTime = ((Date.now() - genStart) / 1000).toFixed(1);
  log("OK", `HTML生成成功 (${genTime}s, ${html.length} bytes)`);

  // --- 1b: Checkout Session作成 ---
  log(">>", `Checkout Session作成中... (${BASE_URL}/api/create-checkout-session)`);
  const checkoutRes = await fetchJson(`${BASE_URL}/api/create-checkout-session`, {
    method: "POST",
    body: JSON.stringify({
      formData: TEST_FORM_DATA,
      html,
    }),
  });

  if (!checkoutRes.ok) {
    log("!!", `Checkout Session作成失敗: ${checkoutRes.status} ${JSON.stringify(checkoutRes.data)}`);
    process.exit(1);
  }

  const checkoutUrl = checkoutRes.data.url;
  log("OK", `Checkout Session作成成功`);

  // --- 結果表示 ---
  logSection("テスト決済手順");
  console.log(`  1. 以下のURLをブラウザで開いてください:`);
  console.log(`     ${checkoutUrl}`);
  console.log();
  console.log(`  2. テストカード情報を入力:`);
  console.log(`     カード番号: 4242 4242 4242 4242`);
  console.log(`     有効期限:   12/30（任意の未来日）`);
  console.log(`     CVC:        123（任意の3桁）`);
  console.log(`     名前:       Test User`);
  console.log();
  console.log(`  3. 決済完了後、以下のコマンドで検証:`);
  console.log(`     node scripts/e2e-test-stripe.mjs 2`);
  console.log();
  console.log(`  テスト用サブドメイン: ${TEST_FORM_DATA.subdomain}`);
  console.log(`  テスト用メール: ${TEST_FORM_DATA.email}`);

  // テスト情報をファイルに保存（Step 2で参照）
  const testInfo = {
    subdomain: TEST_FORM_DATA.subdomain,
    email: TEST_FORM_DATA.email,
    checkoutUrl,
    createdAt: new Date().toISOString(),
    htmlLength: html.length,
  };

  const fs = await import("fs");
  fs.writeFileSync("scripts/.e2e-test-info.json", JSON.stringify(testInfo, null, 2));
  log("OK", `テスト情報を scripts/.e2e-test-info.json に保存`);

  return testInfo;
}

// ---------------------------------------------------------------------------
// Step 2: 決済後の検証
// ---------------------------------------------------------------------------
async function step2_verify(subdomainOverride) {
  logSection("Step 2: 決済後の検証");

  let testInfo;
  try {
    const fs = await import("fs");
    testInfo = JSON.parse(fs.readFileSync("scripts/.e2e-test-info.json", "utf-8"));
  } catch {
    testInfo = null;
  }

  const subdomain = subdomainOverride || testInfo?.subdomain;
  const email = testInfo?.email || TEST_FORM_DATA.email;

  if (!subdomain) {
    log("!!", "テスト情報が見つかりません。先に step 1 を実行してください。");
    process.exit(1);
  }

  log(">>", `検証対象: subdomain=${subdomain}, email=${email}`);

  let allPassed = true;

  // --- 2a: DB確認（Stripe API経由で顧客検索） ---
  log(">>", "Stripe顧客検索中...");
  try {
    const customers = await stripe.customers.list({ email, limit: 5 });
    if (customers.data.length > 0) {
      const customer = customers.data[0];
      log("OK", `Stripe顧客: ${customer.id} (${customer.email})`);

      // サブスクリプション確認
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 5,
      });

      if (subs.data.length > 0) {
        const sub = subs.data[0];
        log("OK", `サブスクリプション: ${sub.id} (status: ${sub.status})`);
        log("  ", `  trial_end: ${sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : "none"}`);
        log("  ", `  current_period_end: ${new Date(sub.current_period_end * 1000).toISOString()}`);

        if (sub.status === "trialing" || sub.status === "active") {
          log("OK", `サブスクステータス正常: ${sub.status}`);
        } else {
          log("!!", `サブスクステータス異常: ${sub.status}`);
          allPassed = false;
        }
      } else {
        log("!!", "サブスクリプションが見つかりません");
        allPassed = false;
      }
    } else {
      log("!!", `Stripe顧客が見つかりません (email: ${email})`);
      allPassed = false;
    }
  } catch (err) {
    log("!!", `Stripe API エラー: ${err.message}`);
    allPassed = false;
  }

  // --- 2b: Worker経由でサイトアクセス確認 ---
  log(">>", `Worker サイトアクセス確認: ${WORKER_URL}/s/${subdomain}`);
  try {
    const siteRes = await fetch(`${WORKER_URL}/s/${subdomain}`);
    if (siteRes.ok) {
      const siteHtml = await siteRes.text();
      log("OK", `サイトアクセス成功 (${siteRes.status}, ${siteHtml.length} bytes)`);

      // 非公開ページでないことを確認
      if (siteHtml.includes("現在非公開") || siteHtml.includes("<!-- deleted -->")) {
        log("!!", "サイトが非公開状態です");
        allPassed = false;
      } else if (siteHtml.includes("ページが見つかりません")) {
        log("!!", "サイトが404です（HTMLがR2に未保存）");
        allPassed = false;
      } else {
        log("OK", "サイトHTMLは有効（公開状態）");
      }
    } else {
      log("!!", `サイトアクセス失敗: ${siteRes.status}`);
      allPassed = false;
    }
  } catch (err) {
    log("!!", `サイトアクセスエラー: ${err.message}`);
    allPassed = false;
  }

  // --- 2c: DB直接確認（PostgreSQL接続可能な場合） ---
  log(">>", "PostgreSQL DB確認中...");
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    // opf_users
    const userRes = await pool.query("SELECT * FROM opf_users WHERE email = $1", [email]);
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      log("OK", `opf_users: id=${user.id}, stripe_customer_id=${user.stripe_customer_id}`);

      // opf_subscriptions
      const subRes = await pool.query(
        "SELECT * FROM opf_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [user.id]
      );
      if (subRes.rows.length > 0) {
        const sub = subRes.rows[0];
        log("OK", `opf_subscriptions: id=${sub.id}, status=${sub.status}, stripe_sub=${sub.stripe_subscription_id}`);
      } else {
        log("!!", "opf_subscriptions レコードなし");
        allPassed = false;
      }

      // opf_sites
      const siteRes = await pool.query(
        "SELECT * FROM opf_sites WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [user.id]
      );
      if (siteRes.rows.length > 0) {
        const site = siteRes.rows[0];
        log("OK", `opf_sites: subdomain=${site.subdomain}, is_active=${site.is_active}, is_published=${site.is_published}`);
        if (!site.is_active) {
          log("!!", "is_active が false です");
          allPassed = false;
        }
      } else {
        log("!!", "opf_sites レコードなし");
        allPassed = false;
      }
    } else {
      log("!!", `opf_users にレコードなし (email: ${email})`);
      allPassed = false;
    }

    await pool.end();
  } catch (err) {
    log("--", `DB接続スキップ: ${err.message}`);
  }

  // --- 結果サマリー ---
  logSection("検証結果");
  if (allPassed) {
    log("OK", "全テスト合格! E2Eフロー正常動作確認済み");
    console.log(`\n  公開URL: ${WORKER_URL}/s/${subdomain}`);
  } else {
    log("!!", "一部テストが失敗しました。上記のログを確認してください。");
    console.log("\n  考えられる原因:");
    console.log("    - Stripe Checkoutがまだ完了していない");
    console.log("    - Webhookがまだ発火していない（数秒待ってリトライ）");
    console.log("    - Webhookエンドポイントにエラーが発生した");
  }

  return allPassed;
}

// ---------------------------------------------------------------------------
// Step 3: クリーンアップ（テストデータ削除）
// ---------------------------------------------------------------------------
async function step3_cleanup() {
  logSection("Step 3: テストデータクリーンアップ");

  let testInfo;
  try {
    const fs = await import("fs");
    testInfo = JSON.parse(fs.readFileSync("scripts/.e2e-test-info.json", "utf-8"));
  } catch {
    log("--", "テスト情報ファイルがありません。スキップします。");
    return;
  }

  const email = testInfo.email;

  // Stripe顧客のサブスク解約
  log(">>", "Stripeサブスクリプション解約中...");
  try {
    const customers = await stripe.customers.list({ email, limit: 5 });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 10 });
      for (const sub of subs.data) {
        if (sub.status !== "canceled") {
          await stripe.subscriptions.cancel(sub.id);
          log("OK", `サブスクリプション解約: ${sub.id}`);
        }
      }
    }
  } catch (err) {
    log("!!", `Stripe解約エラー: ${err.message}`);
  }

  // DBレコード削除
  log(">>", "DBレコード削除中...");
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    const userRes = await pool.query("SELECT id FROM opf_users WHERE email = $1", [email]);
    if (userRes.rows.length > 0) {
      const userId = userRes.rows[0].id;
      await pool.query("DELETE FROM opf_revisions WHERE site_id IN (SELECT id FROM opf_sites WHERE user_id = $1)", [userId]);
      await pool.query("DELETE FROM opf_sites WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM opf_subscriptions WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM opf_ad_events WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM opf_users WHERE id = $1", [userId]);
      log("OK", "DBレコード削除完了");
    }

    await pool.end();
  } catch (err) {
    log("--", `DB削除スキップ: ${err.message}`);
  }

  // テスト情報ファイル削除
  const fs = await import("fs");
  try {
    fs.unlinkSync("scripts/.e2e-test-info.json");
  } catch {}
  log("OK", "クリーンアップ完了");
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------
const step = process.argv[2] || "1";

switch (step) {
  case "1":
    await step1_generateAndCheckout();
    break;
  case "2":
    await step2_verify(process.argv[3]);
    break;
  case "3":
  case "cleanup":
    await step3_cleanup();
    break;
  case "all":
    await step1_generateAndCheckout();
    console.log("\n---");
    console.log("ブラウザでテスト決済を完了してから Enter を押してください...");
    await new Promise((resolve) => {
      process.stdin.once("data", resolve);
    });
    await step2_verify();
    break;
  default:
    console.log("Usage: node scripts/e2e-test-stripe.mjs [1|2|3|all]");
    console.log("  1     - HTML生成 + Checkout URL取得");
    console.log("  2     - 決済後の検証");
    console.log("  3     - テストデータクリーンアップ");
    console.log("  all   - 全ステップ（手動決済を挟む）");
}
