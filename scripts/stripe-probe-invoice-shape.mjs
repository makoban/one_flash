/**
 * 実イベント probe: invoice.payment_failed / payment_succeeded のペイロード形状を確認。
 * webhook が読む `invoice.subscription`（旧）が存在するか、
 * 新形状 `invoice.parent.subscription_details.subscription` かを判定する。
 * test mode のイベントを読むだけ（副作用なし）。
 */
import Stripe from "stripe";
import fs from "fs";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const sk = envText.match(/STRIPE_SECRET_KEY=(\S+)/)[1];
const stripe = new Stripe(sk, { apiVersion: "2026-01-28.clover" });

function inspect(obj) {
  const topLevel = obj.subscription ?? null;
  const nested = obj.parent?.subscription_details?.subscription ?? null;
  return { topLevel, nested };
}

for (const type of ["invoice.payment_failed", "invoice.payment_succeeded"]) {
  const events = await stripe.events.list({ type, limit: 1 });
  if (events.data.length === 0) {
    console.log(`[${type}] イベントなし`);
    continue;
  }
  const ev = events.data[0];
  const inv = ev.data.object;
  const r = inspect(inv);
  console.log(`[${type}] event=${ev.id} api_version=${ev.api_version}`);
  console.log(`   invoice.subscription (webhookが読む旧パス) = ${r.topLevel ?? "❌ undefined（=handlerは即returnしてしまう）"}`);
  console.log(`   invoice.parent.subscription_details.subscription (新パス) = ${r.nested ?? "なし"}`);
}
process.exit(0);
