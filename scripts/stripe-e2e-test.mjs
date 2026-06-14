/**
 * Stripe テストモード課金ライフサイクル E2E 検証
 *
 * 本番アプリ・本番決済には一切影響しない（test mode のみ）。
 * 検証内容:
 *   A. 初期費¥3,980 即時課金 + 月額¥480 サブスク（30日トライアル）
 *   A2. テストクロックを+31日進める → 月額¥480が自動引き落としされるか
 *   A3. さらに+62日 → 2回目の月額¥480も自動課金されるか（継続課金）
 *   B. カード失敗（引き落としエラー）→ サブスクが past_due になるか
 *   C. 解約（期末予約・即時解約）が機能するか
 *   D. Billing Portal セッション作成（顧客が自分で解約できる導線）
 *
 * 実行: onepage-flash ディレクトリ基準で `node scripts/stripe-e2e-test.mjs`
 */

import Stripe from "stripe";
import fs from "fs";

// --- .env.local から sk_test を読む（値は出力しない） ---
const envPath = new URL("../.env.local", import.meta.url);
const envText = fs.readFileSync(envPath, "utf8");
const skMatch = envText.match(/STRIPE_SECRET_KEY=(\S+)/);
if (!skMatch) {
  console.error("STRIPE_SECRET_KEY が .env.local に見つかりません");
  process.exit(1);
}
const sk = skMatch[1];
if (!sk.startsWith("sk_test")) {
  console.error("安全装置: テストキー(sk_test)ではないため中止しました");
  process.exit(1);
}

const stripe = new Stripe(sk, { apiVersion: "2026-01-28.clover" });
const JPY = "jpy";
const DAY = 24 * 60 * 60;

let pass = 0;
let fail = 0;
const results = [];
function check(cond, label, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ PASS: ${label} ${extra}`);
    results.push({ ok: true, label });
  } else {
    fail++;
    console.log(`  ❌ FAIL: ${label} ${extra}`);
    results.push({ ok: false, label });
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitClockReady(clockId, maxSec = 180) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxSec) {
    const c = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (c.status === "ready") return c;
    if (c.status === "internal_failure") throw new Error("test clock internal_failure");
    await sleep(2500);
  }
  throw new Error("test clock advance timeout");
}

async function makePM(token, customerId) {
  const pm = await stripe.paymentMethods.create({ type: "card", card: { token } });
  await stripe.paymentMethods.attach(pm.id, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: pm.id },
  });
  return pm;
}

const createdCustomers = [];

async function main() {
  console.log("=== Stripe テストモード課金 E2E 検証 開始 ===");
  console.log(`使用キー: ${sk.slice(0, 12)}... (test mode)\n`);

  // 共通: 月額¥480 / 初期¥3,980 の価格（アプリと同一構成）
  const monthlyPrice = await stripe.prices.create({
    currency: JPY,
    unit_amount: 480,
    recurring: { interval: "month" },
    product_data: { name: "OnePage-Flash 月額利用料 (E2Eテスト)" },
  });
  const nowSec = Math.floor(Date.now() / 1000);

  // =====================================================================
  // テストA: 正常系（初期費即時 + 月額トライアル + 自動引き落とし×2回）
  // =====================================================================
  console.log("\n[テストA] 正常系: 初期費¥3,980即時 + 月額¥480（30日トライアル後に自動課金）");
  const clockA = await stripe.testHelpers.testClocks.create({ frozen_time: nowSec });
  const custA = await stripe.customers.create({
    name: "E2E-A 正常系",
    email: "e2e-a@example.com",
    test_clock: clockA.id,
  });
  createdCustomers.push(custA.id);
  const pmA = await makePM("tok_visa", custA.id);

  // 初期費¥3,980を即時請求（アプリのcheckoutは初期費を即課金）
  await stripe.invoiceItems.create({
    customer: custA.id,
    currency: JPY,
    amount: 3980,
    description: "OnePage-Flash 初期制作費 (E2Eテスト)",
  });
  let initInv = await stripe.invoices.create({ customer: custA.id, auto_advance: false, pending_invoice_items_behavior: "include" });
  initInv = await stripe.invoices.finalizeInvoice(initInv.id);
  // デフォルト支払い方法があると finalize 時点で自動課金される場合がある → ガード
  if (initInv.status !== "paid") {
    try {
      initInv = await stripe.invoices.pay(initInv.id);
    } catch (e) {
      if (!/already paid/i.test(e.message)) throw e;
    }
    initInv = await stripe.invoices.retrieve(initInv.id);
  }
  check(initInv.status === "paid" && initInv.amount_paid === 3980,
    "初期費¥3,980が即時に引き落とされた", `(status=${initInv.status}, paid=${initInv.amount_paid})`);

  // 月額サブスク（30日トライアル）
  let subA = await stripe.subscriptions.create({
    customer: custA.id,
    items: [{ price: monthlyPrice.id }],
    trial_period_days: 30,
    default_payment_method: pmA.id,
  });
  check(subA.status === "trialing", "サブスク作成直後はトライアル中（初月無料・¥480未課金）", `(status=${subA.status})`);

  // トライアル中は¥480の支払い済み請求が無いこと
  let invA = await stripe.invoices.list({ customer: custA.id, limit: 10 });
  const paid480_before = invA.data.filter((i) => i.status === "paid" && i.amount_paid === 480).length;
  check(paid480_before === 0, "トライアル中は月額¥480がまだ課金されていない", `(¥480課金=${paid480_before}件)`);

  // +31日 → 1回目の月額¥480自動課金
  console.log("  ⏳ テストクロックを +31日 進行中...");
  await stripe.testHelpers.testClocks.advance(clockA.id, { frozen_time: nowSec + 31 * DAY });
  await waitClockReady(clockA.id);
  invA = await stripe.invoices.list({ customer: custA.id, limit: 10 });
  const paid480_1 = invA.data.filter((i) => i.status === "paid" && i.amount_paid === 480).length;
  subA = await stripe.subscriptions.retrieve(subA.id);
  check(paid480_1 >= 1, "★30日トライアル後、月額¥480が自動で引き落とされた", `(¥480課金=${paid480_1}件)`);
  check(subA.status === "active", "課金成功後サブスクが active になった", `(status=${subA.status})`);

  // +62日 → 2回目の月額¥480自動課金（継続課金の確認）
  console.log("  ⏳ テストクロックを +62日 進行中...");
  await stripe.testHelpers.testClocks.advance(clockA.id, { frozen_time: nowSec + 62 * DAY });
  await waitClockReady(clockA.id);
  invA = await stripe.invoices.list({ customer: custA.id, limit: 10 });
  const paid480_2 = invA.data.filter((i) => i.status === "paid" && i.amount_paid === 480).length;
  check(paid480_2 >= 2, "★翌月も月額¥480が自動で引き落とされた（継続課金OK）", `(¥480課金=${paid480_2}件）`);

  // =====================================================================
  // テストB: カード引き落としエラー（更新時に決済失敗）
  // =====================================================================
  console.log("\n[テストB] 異常系: カード決済失敗 → サブスクが past_due になるか");
  const clockB = await stripe.testHelpers.testClocks.create({ frozen_time: nowSec });
  const custB = await stripe.customers.create({
    name: "E2E-B カード失敗",
    email: "e2e-b@example.com",
    test_clock: clockB.id,
  });
  createdCustomers.push(custB.id);
  // tok_chargeCustomerFail: 登録はできるが課金時に必ず失敗するテストカード
  const pmB = await makePM("tok_chargeCustomerFail", custB.id);
  let subB = await stripe.subscriptions.create({
    customer: custB.id,
    items: [{ price: monthlyPrice.id }],
    trial_period_days: 30,
    default_payment_method: pmB.id,
  });
  check(subB.status === "trialing", "失敗カードでもトライアル中は作成できる", `(status=${subB.status})`);
  console.log("  ⏳ テストクロックを +31日 進行中（更新課金を発生させる）...");
  await stripe.testHelpers.testClocks.advance(clockB.id, { frozen_time: nowSec + 31 * DAY });
  await waitClockReady(clockB.id);
  subB = await stripe.subscriptions.retrieve(subB.id);
  const invB = await stripe.invoices.list({ customer: custB.id, limit: 5 });
  const failedInv = invB.data.find((i) => i.status === "open" || i.attempt_count > 0);
  check(["past_due", "unpaid", "incomplete"].includes(subB.status),
    "★引き落とし失敗でサブスクが past_due 等になった（=決済失敗を検知できる）", `(status=${subB.status})`);
  check(!!failedInv && failedInv.amount_paid === 0,
    "失敗した請求書が未払い(open)で残っている（請求リトライ対象）", failedInv ? `(status=${failedInv.status}, attempts=${failedInv.attempt_count})` : "(請求書なし)");

  // =====================================================================
  // テストC: 解約（期末予約 + 即時解約）
  // =====================================================================
  console.log("\n[テストC] 解約: 期末予約解約 と 即時解約");
  let subC = await stripe.subscriptions.update(subA.id, { cancel_at_period_end: true });
  const peTs = subC.current_period_end || subC.items?.data?.[0]?.current_period_end;
  const peLabel = peTs ? new Date(peTs * 1000).toISOString().slice(0, 10) : "n/a";
  check(subC.cancel_at_period_end === true, "期末解約の予約ができた（cancel_at_period_end）", `(period_end=${peLabel})`);
  const canceled = await stripe.subscriptions.cancel(subA.id);
  check(canceled.status === "canceled", "★サブスクの即時解約ができた", `(status=${canceled.status})`);

  // =====================================================================
  // テストD: Billing Portal（顧客セルフ解約導線）
  // =====================================================================
  console.log("\n[テストD] Billing Portal セッション作成（顧客が自分で解約・カード変更できる導線）");
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: custB.id,
      return_url: "https://oneflash.bantex.jp",
    });
    check(!!portal.url, "Billing Portal セッションを作成できた（顧客セルフ管理OK）");
  } catch (e) {
    check(false, "Billing Portal セッション作成", `(${e.message} ← テストモードでPortal設定が必要な場合あり)`);
  }

  // =====================================================================
  // クリーンアップ
  // =====================================================================
  console.log("\n[クリーンアップ] テスト顧客を削除...");
  for (const id of createdCustomers) {
    try { await stripe.customers.del(id); } catch (_) {}
  }
  console.log("  完了");

  // --- サマリ ---
  console.log("\n========================================");
  console.log(`  結果: ${pass} PASS / ${fail} FAIL`);
  console.log("========================================");
  if (fail > 0) {
    console.log("失敗項目:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.label}`));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\n致命的エラー:", e.message);
  console.error(e.stack);
  // ベストエフォートでクリーンアップ
  (async () => {
    for (const id of createdCustomers) {
      try { await stripe.customers.del(id); } catch (_) {}
    }
    process.exit(1);
  })();
});
