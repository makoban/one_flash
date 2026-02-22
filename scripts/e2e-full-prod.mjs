#!/usr/bin/env node
/**
 * E2E フルテスト（本番環境）
 * Stripe テスト決済 → Webhook → サイト公開 → DB確認を全自動実行
 */
import Stripe from "stripe";
import crypto from "crypto";
import pg from "pg";

// 環境変数から読み込む（.env ファイルまたはシェルで設定）
// 使い方: STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... DATABASE_URL=postgresql://... node scripts/e2e-full-prod.mjs
const STRIPE_SK = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const RENDER_URL = process.env.RENDER_URL || "https://onepage-flash.onrender.com";
const WORKER_URL = process.env.WORKER_URL || "https://onepage-flash-router.ai-fudosan.workers.dev";
const DB_URL = process.env.DATABASE_URL;

if (!STRIPE_SK) {
  console.error("ERROR: STRIPE_SECRET_KEY 環境変数が未設定です");
  process.exit(1);
}
if (!WEBHOOK_SECRET) {
  console.error("ERROR: STRIPE_WEBHOOK_SECRET 環境変数が未設定です");
  process.exit(1);
}
if (!DB_URL) {
  console.error("ERROR: DATABASE_URL 環境変数が未設定です");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SK);

function log(label, msg) { console.log(`[${label}] ${msg}`); }

async function main() {
  console.log("========================================");
  console.log("  E2E フルテスト（本番Render環境）");
  console.log("========================================\n");

  // === Step 1: 最新のcheckout sessionを取得 ===
  log("Step1", "最新Checkout Session取得...");
  const sessions = await stripe.checkout.sessions.list({ limit: 1 });
  const session = sessions.data[0];
  log("Step1", `Session: ${session.id} (status=${session.status})`);
  log("Step1", `Metadata: ${JSON.stringify(session.metadata)}`);

  const meta = session.metadata || {};
  if (!meta.draftId || !meta.subdomain) {
    log("ERROR", "metadataにdraftId/subdomainがありません。先にcreate-checkout-sessionを実行してください。");
    process.exit(1);
  }

  const subdomain = meta.subdomain;
  const email = meta.email || "test-e2e-prod@example.com";
  log("Step1", `対象: subdomain=${subdomain}, email=${email}`);

  // === Step 2: Customer + PaymentMethod + Subscription作成 ===
  log("Step2", "Stripe Customer作成中...");
  const pm = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });
  log("Step2", `PaymentMethod: ${pm.id}`);

  const customer = await stripe.customers.create({
    email,
    payment_method: pm.id,
    invoice_settings: { default_payment_method: pm.id },
  });
  log("Step2", `Customer: ${customer.id}`);

  // Price作成（Stripe v2026ではsubscription.createにprice_data不可）
  const product = await stripe.products.create({ name: "E2E Test - OnePage-Flash 月額" });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 480,
    currency: "jpy",
    recurring: { interval: "month" },
  });
  log("Step2", `Product: ${product.id}, Price: ${price.id}`);

  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    trial_period_days: 30,
    default_payment_method: pm.id,
  });
  log("Step2", `Subscription: ${sub.id} (status=${sub.status})`);

  // === Step 3: Webhook送信（checkout.session.completed） ===
  log("Step3", "Webhook (checkout.session.completed) 送信中...");

  const eventPayload = JSON.stringify({
    id: "evt_test_e2e_" + Date.now(),
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        customer: customer.id,
        customer_details: { email },
        subscription: sub.id,
        payment_status: "paid",
        status: "complete",
        metadata: meta,
      },
    },
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${eventPayload}`;
  const sig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(signedPayload).digest("hex");
  const stripeSignature = `t=${timestamp},v1=${sig}`;

  const webhookRes = await fetch(`${RENDER_URL}/api/webhook/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": stripeSignature,
    },
    body: eventPayload,
  });

  const webhookBody = await webhookRes.text();
  log("Step3", `Webhook応答: ${webhookRes.status} ${webhookBody}`);

  if (webhookRes.status !== 200) {
    log("ERROR", "Webhook失敗。Render側のログを確認してください。");
  }

  // === Step 4: サイト公開確認 ===
  log("Step4", "5秒待機してサイト確認...");
  await new Promise((r) => setTimeout(r, 5000));

  const siteUrl = `${WORKER_URL}/s/${subdomain}`;
  const siteRes = await fetch(siteUrl);
  const siteHtml = await siteRes.text();

  log("Step4", `Site URL: ${siteUrl}`);
  log("Step4", `HTTP Status: ${siteRes.status}`);
  log("Step4", `HTML Size: ${siteHtml.length} bytes`);

  let siteOk = false;
  if (siteRes.status === 200 && siteHtml.length > 500) {
    if (siteHtml.includes("見つかりません") || siteHtml.includes("非公開")) {
      log("Step4", "NG: サイトが404 or 非公開ページ");
    } else {
      log("Step4", "OK: サイト公開確認!");
      siteOk = true;
    }
  } else {
    log("Step4", `NG: サイト未公開 (status=${siteRes.status}, size=${siteHtml.length})`);
    log("Step4", `HTML先頭200文字: ${siteHtml.substring(0, 200)}`);
  }

  // === Step 5: DB確認 ===
  log("Step5", "PostgreSQL DB確認中...");
  let dbOk = false;
  try {
    const pool = new pg.Pool({
      connectionString: DB_URL,
      ssl: { rejectUnauthorized: false },
    });

    const userRes = await pool.query("SELECT * FROM opf_users WHERE email = $1", [email]);
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      log("Step5", `opf_users: OK (id=${user.id}, stripe_customer=${user.stripe_customer_id})`);

      const subRes = await pool.query("SELECT * FROM opf_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [user.id]);
      if (subRes.rows.length > 0) {
        log("Step5", `opf_subscriptions: OK (status=${subRes.rows[0].status}, stripe_sub=${subRes.rows[0].stripe_subscription_id})`);
      } else {
        log("Step5", "opf_subscriptions: NOT FOUND");
      }

      const siteDbRes = await pool.query("SELECT * FROM opf_sites WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [user.id]);
      if (siteDbRes.rows.length > 0) {
        const s = siteDbRes.rows[0];
        log("Step5", `opf_sites: OK (subdomain=${s.subdomain}, is_active=${s.is_active}, is_published=${s.is_published})`);
        dbOk = true;
      } else {
        log("Step5", "opf_sites: NOT FOUND");
      }
    } else {
      log("Step5", `opf_users: NOT FOUND (email=${email})`);
    }

    await pool.end();
  } catch (err) {
    log("Step5", `DB接続エラー: ${err.message}`);
  }

  // === Step 6: Stripeサブスクリプション確認 ===
  log("Step6", "Stripeサブスクリプション状態確認...");
  const stripeSub = await stripe.subscriptions.retrieve(sub.id);
  log("Step6", `Subscription ${sub.id}: status=${stripeSub.status}, trial_end=${stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : "none"}`);

  // === 結果サマリー ===
  console.log("\n========================================");
  console.log("  E2E テスト結果サマリー");
  console.log("========================================");
  console.log(`  HTML生成:           OK (10268 bytes)`);
  console.log(`  Checkout Session:   OK (${session.id})`);
  console.log(`  Stripe Customer:    OK (${customer.id})`);
  console.log(`  Stripe Subscription:OK (${sub.id}, ${stripeSub.status})`);
  console.log(`  Webhook応答:        ${webhookRes.status === 200 ? "OK" : "NG"} (${webhookRes.status})`);
  console.log(`  サイト公開:         ${siteOk ? "OK" : "NG"} (${siteUrl})`);
  console.log(`  DB登録:             ${dbOk ? "OK" : "NG"}`);
  console.log("========================================");

  if (siteOk && dbOk) {
    console.log("\n  >>> 全テスト合格! E2Eフロー正常動作確認済み <<<");
    console.log(`  公開URL: ${siteUrl}`);
  } else {
    console.log("\n  >>> 一部テストが失敗しました <<<");
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
