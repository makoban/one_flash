/**
 * API Route: GET /api/admin/stats
 *
 * 管理ダッシュボード用の統計情報を返す。
 * ADMIN_PASSWORD 環境変数で保護。
 *
 * クエリパラメータ:
 *   pw      - 管理パスワード（必須）
 *   service - "overview" (default) | "opf" | "fudosan" | "shoken"
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { fetchPurchases, fetchUserEmails, PurchaseRow } from "@/lib/supabase-db";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export interface OpfStatsData {
  overview: {
    mrr: number;
    activeSubs: number;
    totalUsers: number;
    totalSites: number;
    activeSites: number;
    newThisMonth: number;
    canceledThisMonth: number;
  };
  subsByStatus: Record<string, number>;
  funnel: Record<string, number>;
  utmSources: Array<{ source: string; count: number }>;
  recentEvents: Array<{
    event_type: string;
    utm_source: string | null;
    session_id: string | null;
    page_url: string | null;
    created_at: string;
  }>;
  recentSites: Array<{
    subdomain: string;
    site_name: string | null;
    is_active: boolean;
    created_at: string;
  }>;
}

export interface PurchaseStats {
  totalPurchases: number;
  totalRevenue: number;
  uniqueUsers: number;
  thisMonthCount: number;
  thisMonthRevenue: number;
  todayRevenue: number;
  recentPurchases: Array<{
    id: string;
    email: string | null;
    area_name: string | null;
    area_code: string | null;
    amount: number;
    purchased_at: string;
  }>;
  dailyRevenue: Array<{
    date: string;
    revenue: number;
    count: number;
  }>;
  topAreas: Array<{
    area_name: string | null;
    area_code: string | null;
    count: number;
    revenue: number;
  }>;
}

export interface OverviewData {
  opf: {
    thisMonthRevenue: number;
    totalRevenue: number;
    totalUsers: number;
    activeSubs: number;
    mrr: number;
  } | null;
  fudosan: {
    thisMonthRevenue: number;
    totalRevenue: number;
    uniqueUsers: number;
    totalPurchases: number;
  } | null;
  shoken: {
    thisMonthRevenue: number;
    totalRevenue: number;
    uniqueUsers: number;
    totalPurchases: number;
  } | null;
  grandTotal: {
    thisMonthRevenue: number;
    totalRevenue: number;
    totalUsers: number;
  };
}

// ---------------------------------------------------------------------------
// OnePage-Flash 統計取得
// ---------------------------------------------------------------------------

async function getOpfStats(): Promise<OpfStatsData> {
  const activeSubsResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM opf_subscriptions WHERE status = 'active'`
  );
  const activeSubs = parseInt(activeSubsResult.rows[0]?.count ?? "0", 10);
  const mrr = activeSubs * 480;

  const totalUsersResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM opf_users`
  );
  const totalUsers = parseInt(totalUsersResult.rows[0]?.count ?? "0", 10);

  const totalSitesResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM opf_sites`
  );
  const totalSites = parseInt(totalSitesResult.rows[0]?.count ?? "0", 10);

  const activeSitesResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM opf_sites WHERE is_active = true`
  );
  const activeSites = parseInt(activeSitesResult.rows[0]?.count ?? "0", 10);

  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM opf_subscriptions GROUP BY status`
  );
  const subsByStatus: Record<string, number> = {};
  for (const row of statusResult.rows) {
    subsByStatus[row.status] = parseInt(row.count, 10);
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const newThisMonthResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM opf_subscriptions WHERE created_at >= $1`,
    [monthStart]
  );
  const newThisMonth = parseInt(newThisMonthResult.rows[0]?.count ?? "0", 10);

  const canceledThisMonthResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM opf_subscriptions WHERE canceled_at >= $1`,
    [monthStart]
  );
  const canceledThisMonth = parseInt(
    canceledThisMonthResult.rows[0]?.count ?? "0",
    10
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const funnelResult = await query<{ event_type: string; count: string }>(
    `SELECT event_type, COUNT(*) as count FROM opf_ad_events WHERE created_at >= $1 GROUP BY event_type ORDER BY count DESC`,
    [thirtyDaysAgo]
  );
  const funnel: Record<string, number> = {};
  for (const row of funnelResult.rows) {
    funnel[row.event_type] = parseInt(row.count, 10);
  }

  const utmResult = await query<{ utm_source: string; count: string }>(
    `SELECT COALESCE(utm_source, '(direct)') as utm_source, COUNT(*) as count FROM opf_ad_events WHERE event_type = 'page_view' AND created_at >= $1 GROUP BY utm_source ORDER BY count DESC LIMIT 10`,
    [thirtyDaysAgo]
  );
  const utmSources = utmResult.rows.map((r) => ({
    source: r.utm_source,
    count: parseInt(r.count, 10),
  }));

  const recentEventsResult = await query<{
    event_type: string;
    utm_source: string | null;
    session_id: string | null;
    page_url: string | null;
    created_at: Date;
  }>(
    `SELECT event_type, utm_source, session_id, page_url, created_at FROM opf_ad_events ORDER BY created_at DESC LIMIT 20`
  );

  const recentSitesResult = await query<{
    subdomain: string;
    site_name: string | null;
    is_active: boolean;
    created_at: Date;
  }>(
    `SELECT subdomain, site_name, is_active, created_at FROM opf_sites ORDER BY created_at DESC LIMIT 10`
  );

  return {
    overview: {
      mrr,
      activeSubs,
      totalUsers,
      totalSites,
      activeSites,
      newThisMonth,
      canceledThisMonth,
    },
    subsByStatus,
    funnel,
    utmSources,
    recentEvents: recentEventsResult.rows.map((r) => ({
      ...r,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    })),
    recentSites: recentSitesResult.rows.map((r) => ({
      ...r,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Supabase サービス統計取得（ai-fudosan / ai-shoken 共通）
// ---------------------------------------------------------------------------

async function getSupabasePurchaseStats(
  serviceName: string
): Promise<PurchaseStats> {
  // Supabase JS SDK 経由で purchases を取得し、JS側で集計する
  const rows: PurchaseRow[] = await fetchPurchases(serviceName);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 累計
  const totalRevenue = rows.reduce((s, r) => s + (r.amount ?? 0), 0);
  const uniqueUserIds = [...new Set(rows.map((r) => r.user_id))];

  // 今月
  const monthRows = rows.filter(
    (r) => new Date(r.purchased_at) >= monthStart
  );
  const thisMonthRevenue = monthRows.reduce((s, r) => s + (r.amount ?? 0), 0);

  // 今日
  const todayRows = rows.filter(
    (r) => new Date(r.purchased_at) >= todayStart
  );
  const todayRevenue = todayRows.reduce((s, r) => s + (r.amount ?? 0), 0);

  // メールアドレス取得（最近20件のユーザー分）
  const recent20 = rows.slice(0, 20);
  const recent20UserIds = [...new Set(recent20.map((r) => r.user_id))];
  let emailMap = new Map<string, string>();
  try {
    emailMap = await fetchUserEmails(recent20UserIds);
  } catch {
    // auth.admin アクセスに失敗しても続行
  }

  // 日別売上（過去30日）
  const dailyMap = new Map<string, { revenue: number; count: number }>();
  for (const r of rows) {
    const d = new Date(r.purchased_at);
    if (d < thirtyDaysAgo) continue;
    const dateKey = d.toISOString().slice(0, 10);
    const existing = dailyMap.get(dateKey) || { revenue: 0, count: 0 };
    existing.revenue += r.amount ?? 0;
    existing.count += 1;
    dailyMap.set(dateKey, existing);
  }
  const dailyRevenue = [...dailyMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, v]) => ({ date, revenue: v.revenue, count: v.count }));

  // 人気エリアTOP10
  const areaMap = new Map<
    string,
    { area_name: string | null; area_code: string | null; count: number; revenue: number }
  >();
  for (const r of rows) {
    const key = r.area_name ?? "(unknown)";
    const existing = areaMap.get(key) || {
      area_name: r.area_name,
      area_code: r.area_code,
      count: 0,
      revenue: 0,
    };
    existing.count += 1;
    existing.revenue += r.amount ?? 0;
    areaMap.set(key, existing);
  }
  const topAreas = [...areaMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalPurchases: rows.length,
    totalRevenue,
    uniqueUsers: uniqueUserIds.length,
    thisMonthCount: monthRows.length,
    thisMonthRevenue,
    todayRevenue,
    recentPurchases: recent20.map((r) => ({
      id: r.id,
      email: emailMap.get(r.user_id) ?? null,
      area_name: r.area_name,
      area_code: r.area_code,
      amount: r.amount ?? 0,
      purchased_at: r.purchased_at,
    })),
    dailyRevenue,
    topAreas,
  };
}

// ---------------------------------------------------------------------------
// Overview（全サービスサマリー）
// ---------------------------------------------------------------------------

async function getOverviewData(): Promise<OverviewData> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Promise.allSettled で一部失敗してもほかのデータを返せるようにする
  const [opfResult, fudosanResult, shokenResult] = await Promise.allSettled([
    getOpfStats(),
    getSupabasePurchaseStats("ai-fudosan"),
    getSupabasePurchaseStats("ai-shoken"),
  ]);

  const opf =
    opfResult.status === "fulfilled"
      ? {
          thisMonthRevenue:
            opfResult.value.overview.newThisMonth * 3980 +
            opfResult.value.overview.activeSubs * 480,
          totalRevenue:
            opfResult.value.overview.totalUsers * 3980 +
            opfResult.value.overview.activeSubs * 480,
          totalUsers: opfResult.value.overview.totalUsers,
          activeSubs: opfResult.value.overview.activeSubs,
          mrr: opfResult.value.overview.mrr,
        }
      : null;

  const fudosan =
    fudosanResult.status === "fulfilled"
      ? {
          thisMonthRevenue: fudosanResult.value.thisMonthRevenue,
          totalRevenue: fudosanResult.value.totalRevenue,
          uniqueUsers: fudosanResult.value.uniqueUsers,
          totalPurchases: fudosanResult.value.totalPurchases,
        }
      : null;

  const shoken =
    shokenResult.status === "fulfilled"
      ? {
          thisMonthRevenue: shokenResult.value.thisMonthRevenue,
          totalRevenue: shokenResult.value.totalRevenue,
          uniqueUsers: shokenResult.value.uniqueUsers,
          totalPurchases: shokenResult.value.totalPurchases,
        }
      : null;

  const grandTotalThisMonth =
    (opf?.thisMonthRevenue ?? 0) +
    (fudosan?.thisMonthRevenue ?? 0) +
    (shoken?.thisMonthRevenue ?? 0);

  const grandTotalRevenue =
    (opf?.totalRevenue ?? 0) +
    (fudosan?.totalRevenue ?? 0) +
    (shoken?.totalRevenue ?? 0);

  const grandTotalUsers =
    (opf?.totalUsers ?? 0) +
    (fudosan?.uniqueUsers ?? 0) +
    (shoken?.uniqueUsers ?? 0);

  return {
    opf,
    fudosan,
    shoken,
    grandTotal: {
      thisMonthRevenue: grandTotalThisMonth,
      totalRevenue: grandTotalRevenue,
      totalUsers: grandTotalUsers,
    },
  };
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  // パスワード認証
  const password = request.nextUrl.searchParams.get("pw");
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw || password !== adminPw) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = request.nextUrl.searchParams.get("service") ?? "overview";

  try {
    switch (service) {
      case "opf": {
        const data = await getOpfStats();
        return NextResponse.json(data);
      }

      case "fudosan": {
        const data = await getSupabasePurchaseStats("ai-fudosan");
        return NextResponse.json(data);
      }

      case "shoken": {
        const data = await getSupabasePurchaseStats("ai-shoken");
        return NextResponse.json(data);
      }

      case "overview":
      default: {
        const data = await getOverviewData();
        return NextResponse.json(data);
      }
    }
  } catch (error: unknown) {
    console.error(`[admin/stats] service=${service} Error:`, error);
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
