/**
 * API Route: GET /api/admin/stats
 *
 * 管理ダッシュボード用の統計情報を返す。
 * ADMIN_PASSWORD 環境変数で保護。
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // パスワード認証
  const password = request.nextUrl.searchParams.get("pw");
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw || password !== adminPw) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // --- MRR & ユーザー数 ---
    const activeSubsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM opf_subscriptions WHERE status = 'active'`
    );
    const activeSubs = parseInt(activeSubsResult.rows[0]?.count ?? "0", 10);
    const mrr = activeSubs * 380;

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

    // --- サブスクステータス別 ---
    const statusResult = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count FROM opf_subscriptions GROUP BY status`
    );
    const subsByStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      subsByStatus[row.status] = parseInt(row.count, 10);
    }

    // --- 今月の新規・解約 ---
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
    const canceledThisMonth = parseInt(canceledThisMonthResult.rows[0]?.count ?? "0", 10);

    // --- コンバージョンファネル（過去30日） ---
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

    // --- UTM別の流入（過去30日） ---
    const utmResult = await query<{ utm_source: string; count: string }>(
      `SELECT COALESCE(utm_source, '(direct)') as utm_source, COUNT(*) as count FROM opf_ad_events WHERE event_type = 'page_view' AND created_at >= $1 GROUP BY utm_source ORDER BY count DESC LIMIT 10`,
      [thirtyDaysAgo]
    );
    const utmSources: Array<{ source: string; count: number }> = utmResult.rows.map((r) => ({
      source: r.utm_source,
      count: parseInt(r.count, 10),
    }));

    // --- 最近のイベント ---
    const recentEventsResult = await query<{
      event_type: string;
      utm_source: string | null;
      session_id: string | null;
      page_url: string | null;
      created_at: Date;
    }>(
      `SELECT event_type, utm_source, session_id, page_url, created_at FROM opf_ad_events ORDER BY created_at DESC LIMIT 20`
    );

    // --- 最近のサイト ---
    const recentSitesResult = await query<{
      subdomain: string;
      site_name: string | null;
      is_active: boolean;
      created_at: Date;
    }>(
      `SELECT subdomain, site_name, is_active, created_at FROM opf_sites ORDER BY created_at DESC LIMIT 10`
    );

    return NextResponse.json({
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
      recentEvents: recentEventsResult.rows,
      recentSites: recentSitesResult.rows,
    });
  } catch (error: unknown) {
    console.error("[admin/stats] Error:", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
