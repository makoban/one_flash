/**
 * /admin 管理ダッシュボード
 *
 * MRR、ユーザー数、コンバージョンファネル、最近のイベントを1画面で確認。
 * パスワード認証付き（URL: /admin?pw=ADMIN_PASSWORD）。
 */

"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface StatsData {
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

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

function AdminContent() {
  const searchParams = useSearchParams();
  const pw = searchParams.get("pw") ?? "";

  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?pw=${encodeURIComponent(pw)}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError("認証に失敗しました。正しいパスワードをURLに含めてください。\n例: /admin?pw=your_password");
        } else {
          const body = (await res.json()) as { error?: string };
          setError(body.error ?? "データの取得に失敗しました");
        }
        return;
      }
      const json = (await res.json()) as StatsData;
      setData(json);
      setError(null);
    } catch {
      setError("通信エラー");
    } finally {
      setLoading(false);
    }
  }, [pw]);

  useEffect(() => {
    fetchStats();
    // 30秒ごとに自動更新
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
          <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
        </div>
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (!data) return null;

  const { overview, subsByStatus, funnel, utmSources, recentEvents, recentSites } = data;

  // ファネルの順序
  const funnelSteps = ["page_view", "form_start", "checkout_start", "subscribed"];
  const funnelLabels: Record<string, string> = {
    page_view: "LP訪問",
    form_start: "フォーム開始",
    checkout_start: "決済開始",
    subscribed: "登録完了",
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">OnePage-Flash Admin</h1>
          <button
            onClick={fetchStats}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            更新
          </button>
        </div>

        {/* KPI カード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <KpiCard label="MRR" value={`¥${overview.mrr.toLocaleString()}`} sub="月次経常収益" color="indigo" />
          <KpiCard label="アクティブサブスク" value={overview.activeSubs.toString()} sub={`全${overview.totalUsers}ユーザー`} color="green" />
          <KpiCard label="今月新規" value={`+${overview.newThisMonth}`} sub={`解約 -${overview.canceledThisMonth}`} color="blue" />
          <KpiCard label="公開サイト" value={overview.activeSites.toString()} sub={`全${overview.totalSites}サイト`} color="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* コンバージョンファネル */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">コンバージョンファネル（過去30日）</h2>
            <div className="space-y-3">
              {funnelSteps.map((step, i) => {
                const count = funnel[step] ?? 0;
                const prevCount = i > 0 ? (funnel[funnelSteps[i - 1]] ?? 0) : count;
                const rate = prevCount > 0 && i > 0 ? Math.round((count / prevCount) * 100) : 100;
                const maxCount = funnel[funnelSteps[0]] ?? 1;
                const barWidth = maxCount > 0 ? Math.max((count / maxCount) * 100, 2) : 2;

                return (
                  <div key={step}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium">{funnelLabels[step] ?? step}</span>
                      <span className="text-gray-900 font-bold">
                        {count}
                        {i > 0 && (
                          <span className={`ml-2 ${rate < 30 ? "text-red-500" : "text-gray-400"}`}>
                            ({rate}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* サブスクステータス */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">サブスクステータス</h2>
            <div className="space-y-2">
              {Object.entries(subsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">
                    <StatusBadge status={status} /> {status}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(subsByStatus).length === 0 && (
                <p className="text-xs text-gray-400">データなし</p>
              )}
            </div>

            <h2 className="text-sm font-bold text-gray-900 mt-6 mb-4">流入元（過去30日）</h2>
            <div className="space-y-2">
              {utmSources.map((s) => (
                <div key={s.source} className="flex items-center justify-between py-1">
                  <span className="text-xs text-gray-600">{s.source}</span>
                  <span className="text-xs font-bold text-gray-900">{s.count}</span>
                </div>
              ))}
              {utmSources.length === 0 && (
                <p className="text-xs text-gray-400">データなし</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 最近のイベント */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">最近のイベント</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentEvents.map((ev, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <EventBadge type={ev.event_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 truncate">
                      {ev.utm_source && <span className="text-indigo-500">[{ev.utm_source}] </span>}
                      {ev.page_url ?? "-"}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {formatTime(ev.created_at)}
                  </span>
                </div>
              ))}
              {recentEvents.length === 0 && (
                <p className="text-xs text-gray-400">イベントなし</p>
              )}
            </div>
          </div>

          {/* 最近のサイト */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-4">最近のサイト</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentSites.map((site, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{site.site_name ?? site.subdomain}</p>
                    <p className="text-xs text-gray-400">{site.subdomain}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${site.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {site.is_active ? "公開中" : "非公開"}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(site.created_at)}</p>
                  </div>
                </div>
              ))}
              {recentSites.length === 0 && (
                <p className="text-xs text-gray-400">サイトなし</p>
              )}
            </div>
          </div>
        </div>

        {/* コスト監視リマインダー */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-amber-800 mb-3">日次コスト監視チェックリスト</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-700">
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-amber-900 underline">Stripe Dashboard → 売上・チャーン確認</a>
            <a href="https://console.cloud.google.com/apis/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-amber-900 underline">Google Cloud → Gemini API使用量</a>
            <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-amber-900 underline">Cloudflare → Workers/R2使用量</a>
            <a href="https://dashboard.render.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-amber-900 underline">Render → CPU/Memory使用率</a>
            <a href="https://resend.com/overview" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-amber-900 underline">Resend → メール送信数</a>
            <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-amber-900 underline">GA4 → アクセス解析</a>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// UIパーツ
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 border-indigo-100",
    green: "bg-green-50 border-green-100",
    blue: "bg-blue-50 border-blue-100",
    amber: "bg-amber-50 border-amber-100",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color] ?? "bg-gray-50 border-gray-100"}`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500",
    past_due: "bg-yellow-500",
    canceled: "bg-red-500",
    trialing: "bg-blue-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? "bg-gray-400"} mr-1.5`} />;
}

function EventBadge({ type }: { type: string }) {
  const labels: Record<string, { text: string; bg: string }> = {
    page_view: { text: "PV", bg: "bg-gray-100 text-gray-600" },
    form_start: { text: "FS", bg: "bg-blue-100 text-blue-600" },
    checkout_start: { text: "CS", bg: "bg-amber-100 text-amber-600" },
    subscribed: { text: "CV", bg: "bg-green-100 text-green-700" },
  };
  const l = labels[type] ?? { text: type.substring(0, 2).toUpperCase(), bg: "bg-gray-100 text-gray-600" };
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${l.bg} flex-shrink-0`}>{l.text}</span>;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}日前`;
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AdminContent />
    </Suspense>
  );
}
