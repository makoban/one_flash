/**
 * OnePage-Flash タブコンポーネント
 *
 * 既存の管理ダッシュボードから OPF 専用セクションを分離。
 * Props として OpfStatsData を受け取り、KPI・ファネル・
 * サブスクステータス・UTM・最近のイベント・最近のサイトを表示する。
 */

"use client";

import { KpiCard, StatusBadge, EventBadge, formatTime } from "./AdminComponents";
import type { OpfStatsData } from "../api/admin/stats/route";

// ---------------------------------------------------------------------------
// ファネル設定
// ---------------------------------------------------------------------------

const FUNNEL_STEPS = ["page_view", "form_start", "checkout_start", "subscribed"];
const FUNNEL_LABELS: Record<string, string> = {
  page_view: "LP訪問",
  form_start: "フォーム開始",
  checkout_start: "決済開始",
  subscribed: "登録完了",
};

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

interface OpfTabProps {
  data: OpfStatsData;
}

export function OpfTab({ data }: OpfTabProps) {
  const { overview, subsByStatus, funnel, utmSources, recentEvents, recentSites } = data;

  return (
    <div className="space-y-6">
      {/* KPI カード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="MRR"
          value={`¥${overview.mrr.toLocaleString()}`}
          sub="月次経常収益"
          color="indigo"
        />
        <KpiCard
          label="アクティブサブスク"
          value={overview.activeSubs.toString()}
          sub={`全${overview.totalUsers}ユーザー`}
          color="green"
        />
        <KpiCard
          label="今月新規"
          value={`+${overview.newThisMonth}`}
          sub={`解約 -${overview.canceledThisMonth}`}
          color="blue"
        />
        <KpiCard
          label="公開サイト"
          value={overview.activeSites.toString()}
          sub={`全${overview.totalSites}サイト`}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* コンバージョンファネル */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">
            コンバージョンファネル（過去30日）
          </h2>
          <div className="space-y-3">
            {FUNNEL_STEPS.map((step, i) => {
              const count = funnel[step] ?? 0;
              const prevCount = i > 0 ? (funnel[FUNNEL_STEPS[i - 1]] ?? 0) : count;
              const rate =
                prevCount > 0 && i > 0
                  ? Math.round((count / prevCount) * 100)
                  : 100;
              const maxCount = funnel[FUNNEL_STEPS[0]] ?? 1;
              const barWidth =
                maxCount > 0 ? Math.max((count / maxCount) * 100, 2) : 2;

              return (
                <div key={step}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">
                      {FUNNEL_LABELS[step] ?? step}
                    </span>
                    <span className="text-gray-900 font-bold">
                      {count}
                      {i > 0 && (
                        <span
                          className={`ml-2 ${
                            rate < 30 ? "text-red-500" : "text-gray-400"
                          }`}
                        >
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

        {/* サブスクステータス & UTM */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">
            サブスクステータス
          </h2>
          <div className="space-y-2">
            {Object.entries(subsByStatus).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <span className="text-sm text-gray-600">
                  <StatusBadge status={status} />
                  {status}
                </span>
                <span className="text-sm font-bold text-gray-900">{count}</span>
              </div>
            ))}
            {Object.keys(subsByStatus).length === 0 && (
              <p className="text-xs text-gray-400">データなし</p>
            )}
          </div>

          <h2 className="text-sm font-bold text-gray-900 mt-6 mb-4">
            流入元（過去30日）
          </h2>
          <div className="space-y-2">
            {utmSources.map((s) => (
              <div
                key={s.source}
                className="flex items-center justify-between py-1"
              >
                <span className="text-xs text-gray-600">{s.source}</span>
                <span className="text-xs font-bold text-gray-900">
                  {s.count}
                </span>
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
          <h2 className="text-sm font-bold text-gray-900 mb-4">
            最近のイベント
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentEvents.map((ev, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0"
              >
                <EventBadge type={ev.event_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 truncate">
                    {ev.utm_source && (
                      <span className="text-indigo-500">
                        [{ev.utm_source}]{" "}
                      </span>
                    )}
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
          <h2 className="text-sm font-bold text-gray-900 mb-4">
            最近のサイト
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentSites.map((site, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {site.site_name ?? site.subdomain}
                  </p>
                  <p className="text-xs text-gray-400">{site.subdomain}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      site.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {site.is_active ? "公開中" : "非公開"}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {formatTime(site.created_at)}
                  </p>
                </div>
              </div>
            ))}
            {recentSites.length === 0 && (
              <p className="text-xs text-gray-400">サイトなし</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
