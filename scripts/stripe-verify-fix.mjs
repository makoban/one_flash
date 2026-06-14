/**
 * webhook修正の検証: 実際の invoice.payment_failed / payment_succeeded イベントに
 * 修正後の extractSubscriptionId ロジックを当て、subIdが取れることを確認する。
 * （修正前は invoice.subscription=undefined で null になり handler が即return していた）
 */
import Stripe from "stripe";
import fs from "fs";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const sk = envText.match(/STRIPE_SECRET_KEY=(\S+)/)[1];
const stripe = new Stripe(sk, { apiVersion: "2026-01-28.clover" });

// route.ts の extractSubscriptionId と同一ロジック
function extractSubscriptionId(invoice) {
  const data = invoice;
  const parent = data.parent;
  const raw = parent?.subscription_details?.subscription ?? data.subscription;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw?.id ?? null;
}

// 旧ロジック（修正前）
function oldExtract(invoice) {
  const subRaw = invoice.subscription;
  return typeof subRaw === "string" ? subRaw : subRaw?.id ?? null;
}

let pass = 0, fail = 0;
for (const type of ["invoice.payment_failed", "invoice.payment_succeeded"]) {
  const events = await stripe.events.list({ type, limit: 1 });
  if (events.data.length === 0) { console.log(`[${type}] イベントなし（スキップ）`); continue; }
  const inv = events.data[0].data.object;
  const before = oldExtract(inv);
  const after = extractSubscriptionId(inv);
  const ok = after && after.startsWith("sub_");
  console.log(`[${type}] 修正前=${before ?? "null(=即return)"} → 修正後=${after ?? "null"} ${ok ? "✅" : "❌"}`);
  if (ok) pass++; else fail++;
}
console.log(`\n結果: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
