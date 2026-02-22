/**
 * API Route: POST /api/cron/check-subscriptions
 *
 * サブスクリプション確認バッチ（日次実行推奨）
 *
 * 処理内容:
 *   1. DB上の全アクティブサイトを取得
 *   2. 紐付くサブスクリプションの状態を Stripe API で最新確認
 *   3. 未払い（past_due / canceled / unpaid）→ サイト非公開化
 *   4. 復活（active / trialing で is_active=false）→ サイト再公開
 *   5. DB の subscription ステータスを Stripe の実態に同期
 *
 * 認証: CRON_SECRET または ADMIN_PASSWORD ヘッダー
 *
 * 呼び出し方法:
 *   curl -X POST https://onepage-flash.onrender.com/api/cron/check-subscriptions \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 *
 * Render Cron Job / 外部CronサービスからHTTP POSTで呼び出す
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  query,
  ensureTablesExist,
  updateSubscriptionStatus,
  updateSiteIsActive,
} from "@/lib/db";
import { deactivateSite, reactivateSite } from "@/lib/r2";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const maxDuration = 60; // 最大60秒

// ---------------------------------------------------------------------------
// 認証
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  // Bearer トークン認証
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const cronSecret = process.env.CRON_SECRET;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (cronSecret && token === cronSecret) return true;
    if (adminPassword && token === adminPassword) return true;
  }

  // クエリパラメータ認証（簡易）
  const pw = request.nextUrl.searchParams.get("pw");
  const adminPw = process.env.ADMIN_PASSWORD;
  if (adminPw && pw === adminPw) return true;

  return false;
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface SiteWithSubscription {
  site_id: string;
  subdomain: string;
  site_name: string | null;
  is_active: boolean;
  subscription_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  user_email: string;
}

interface BatchResult {
  checked: number;
  deactivated: string[];
  reactivated: string[];
  statusUpdated: string[];
  errors: string[];
  skipped: number;
}

// ---------------------------------------------------------------------------
// ハンドラー
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron/check-subscriptions] Batch started");
  const startTime = Date.now();

  try {
    await ensureTablesExist();
  } catch (err) {
    console.error("[cron/check-subscriptions] Failed to ensure tables:", err);
  }

  const result: BatchResult = {
    checked: 0,
    deactivated: [],
    reactivated: [],
    statusUpdated: [],
    errors: [],
    skipped: 0,
  };

  try {
    // --- 全サイト + サブスクリプション情報を取得 ---
    const sitesResult = await query<SiteWithSubscription>(
      `SELECT
         s.id as site_id,
         s.subdomain,
         s.site_name,
         s.is_active,
         s.subscription_id,
         sub.stripe_subscription_id,
         sub.status as subscription_status,
         u.email as user_email
       FROM opf_sites s
       LEFT JOIN opf_subscriptions sub ON s.subscription_id = sub.id
       LEFT JOIN opf_users u ON s.user_id = u.id
       ORDER BY s.created_at ASC`
    );

    const sites = sitesResult.rows;
    console.log(`[cron/check-subscriptions] Found ${sites.length} sites to check`);

    for (const site of sites) {
      result.checked++;

      // サブスクリプションIDがない場合はスキップ（デモサイト等）
      if (!site.stripe_subscription_id) {
        result.skipped++;
        continue;
      }

      try {
        // --- Stripe API で最新のサブスクリプション状態を取得 ---
        let stripeSub: Stripe.Subscription;
        try {
          stripeSub = await stripe.subscriptions.retrieve(site.stripe_subscription_id);
        } catch (stripeErr: unknown) {
          const err = stripeErr as { statusCode?: number; message?: string };
          if (err.statusCode === 404) {
            // Stripe上に存在しない → 解約済みとみなす
            console.warn(
              `[cron/check-subscriptions] Subscription not found in Stripe: ${site.stripe_subscription_id} (site: ${site.subdomain})`
            );
            if (site.is_active) {
              await deactivateAndUpdate(site, "canceled", result);
            }
            continue;
          }
          throw stripeErr;
        }

        const stripeStatus = stripeSub.status;

        // --- DB のステータスと Stripe の実態が異なる場合は同期 ---
        if (site.subscription_status !== stripeStatus) {
          await updateSubscriptionStatus(
            site.stripe_subscription_id,
            stripeStatus,
            stripeStatus === "canceled" ? new Date() : undefined
          );

          // period情報も同期
          const subData = stripeSub as unknown as Record<string, unknown>;
          const periodStart = typeof subData.current_period_start === "number"
            ? new Date((subData.current_period_start as number) * 1000)
            : null;
          const periodEnd = typeof subData.current_period_end === "number"
            ? new Date((subData.current_period_end as number) * 1000)
            : null;

          if (periodStart && periodEnd) {
            await query(
              `UPDATE opf_subscriptions SET
                 current_period_start = $2,
                 current_period_end = $3,
                 cancel_at_period_end = $4,
                 updated_at = NOW()
               WHERE stripe_subscription_id = $1`,
              [
                site.stripe_subscription_id,
                periodStart,
                periodEnd,
                stripeSub.cancel_at_period_end,
              ]
            );
          }

          result.statusUpdated.push(
            `${site.subdomain}: ${site.subscription_status} -> ${stripeStatus}`
          );
          console.log(
            `[cron/check-subscriptions] Status synced: ${site.subdomain} ${site.subscription_status} -> ${stripeStatus}`
          );
        }

        // --- サイトの公開/非公開を判定 ---
        const shouldBeActive = stripeStatus === "active" || stripeStatus === "trialing";

        if (site.is_active && !shouldBeActive) {
          // アクティブだが支払い停止 → 非公開化
          await deactivateAndUpdate(site, stripeStatus, result);
        } else if (!site.is_active && shouldBeActive) {
          // 非公開だが支払い再開 → 再公開
          await reactivateAndUpdate(site, result);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`${site.subdomain}: ${message}`);
        console.error(
          `[cron/check-subscriptions] Error processing ${site.subdomain}:`,
          err
        );
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[cron/check-subscriptions] Batch completed in ${elapsed}s: ` +
        `checked=${result.checked}, deactivated=${result.deactivated.length}, ` +
        `reactivated=${result.reactivated.length}, updated=${result.statusUpdated.length}, ` +
        `errors=${result.errors.length}, skipped=${result.skipped}`
    );

    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}s`,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[cron/check-subscriptions] Fatal error:", error);
    return NextResponse.json({ error: message, ...result }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// ヘルパー: サイト非公開化
// ---------------------------------------------------------------------------

async function deactivateAndUpdate(
  site: SiteWithSubscription,
  stripeStatus: string,
  result: BatchResult
): Promise<void> {
  // DB: is_active = false
  await updateSiteIsActive(site.subdomain, false);

  // R2: HTMLバックアップ → 非公開ページ差替え
  await deactivateSite(site.subdomain, site.site_name ?? "").catch((err: unknown) =>
    console.error(`[cron/check-subscriptions] deactivateSite error for ${site.subdomain}:`, err)
  );

  result.deactivated.push(`${site.subdomain} (${stripeStatus})`);
  console.log(
    `[cron/check-subscriptions] Deactivated: ${site.subdomain} (stripe: ${stripeStatus})`
  );
}

// ---------------------------------------------------------------------------
// ヘルパー: サイト再公開
// ---------------------------------------------------------------------------

async function reactivateAndUpdate(
  site: SiteWithSubscription,
  result: BatchResult
): Promise<void> {
  // R2: バックアップから復元
  const restored = await reactivateSite(site.subdomain);

  if (restored) {
    // DB: is_active = true
    await updateSiteIsActive(site.subdomain, true);
    result.reactivated.push(site.subdomain);
    console.log(`[cron/check-subscriptions] Reactivated: ${site.subdomain}`);
  } else {
    result.errors.push(`${site.subdomain}: backup HTML not found for reactivation`);
    console.warn(
      `[cron/check-subscriptions] Cannot reactivate ${site.subdomain}: no backup HTML`
    );
  }
}

// ---------------------------------------------------------------------------
// GET は情報表示のみ（手動確認用）
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sitesResult = await query<{
      subdomain: string;
      is_active: boolean;
      subscription_status: string | null;
      stripe_subscription_id: string | null;
    }>(
      `SELECT
         s.subdomain,
         s.is_active,
         sub.status as subscription_status,
         sub.stripe_subscription_id
       FROM opf_sites s
       LEFT JOIN opf_subscriptions sub ON s.subscription_id = sub.id
       ORDER BY s.created_at ASC`
    );

    return NextResponse.json({
      total: sitesResult.rows.length,
      sites: sitesResult.rows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
