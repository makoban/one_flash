/**
 * OnePage-Flash タブコンポーネント
 *
 * 既存の管理ダッシュボードから OPF 専用セクションを分離。
 * Props として OpfStatsData を受け取り、KPI・ファネル・
 * サブスクステータス・UTM・最近のイベント・最近のサイトを表示する。
 */

"use client";

import { KpiCard, StatusBadge, EventBadge, formatTime, formatYen } from "./AdminComponents";
import type { OpfStatsData } from "../api/admin/stats/route";

// ---------------------------------------------------------------------------
// ファネル設定
// ---------------------------------------------------------------------------

const FUNNEL_STEPS = [
  "page_view", "form_start",
  "form_step_2", "form_step_3", "form_step_4", "form_step_5", "form_step_6",
  "generate_start", "generate_complete",
  "checkout_start", "subscribed",
];
const FUNNEL_LABELS: Record<string, string> = {
  page_view: "LP訪問",
  form_start: "Q1 開始",
  form_step_2: "Q2 キャッチコピー",
  form_step_3: "Q3 説明文",
  form_step_4: "Q4 連絡先",
  form_step_5: "Q5 テーマ選択",
  form_step_6: "Q6 メール",
  generate_start: "生成開始",
  generate_complete: "生成完了",
  checkout_start: "決済開始",
  subscribed: "登録完了",
};

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

interface OpfTabProps {
  data: OpfStatsData;
}

export function OpfTab({ data }: OpfTabProps) {
  const { overview, subsByStatus, funnel, utmSources, xAd, xCampaigns, recentEvents, recentSites } = data;

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

      <div className="rounded-2xl border bg-white p-6">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              X広告成果（過去{xAd.periodDays}日）
            </h2>
            <p className="text-xs text-gray-400">
              utm_source=x / twitter、twclid、x.com・twitter.com・t.co流入を集計
            </p>
          </div>
          <p className="text-xs font-bold text-gray-500">
            広告費 {formatYen(xAd.spendYen)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="LP流入"
            value={xAd.visitors.toLocaleString("ja-JP")}
            sub={`PV ${xAd.pageViews.toLocaleString("ja-JP")} / CPV ${xAd.costPerVisitorYen ? formatYen(xAd.costPerVisitorYen) : "-"}`}
            color="blue"
          />
          <KpiCard
            label="試用開始"
            value={xAd.formStarts.toLocaleString("ja-JP")}
            sub={`訪問→開始 ${formatPercent(xAd.trialRate)} / CTA ${xAd.ctaClicks}`}
            color="purple"
          />
          <KpiCard
            label="決済開始"
            value={xAd.checkoutStarts.toLocaleString("ja-JP")}
            sub={`生成→決済 ${formatPercent(xAd.checkoutRate)}`}
            color="amber"
          />
          <KpiCard
            label="購入"
            value={xAd.purchases.toLocaleString("ja-JP")}
            sub={`CVR ${formatPercent(xAd.purchaseRate)} / CPA ${xAd.cpaYen ? formatYen(xAd.cpaYen) : "-"}`}
            color="green"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs text-gray-400">生成完了</p>
            <p className="mt-1 text-lg font-black text-gray-900">
              {xAd.generateCompletes.toLocaleString("ja-JP")}
            </p>
            <p className="text-xs text-gray-500">
              試用→生成 {formatPercent(xAd.generateRate)}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs text-gray-400">初期売上</p>
            <p className="mt-1 text-lg font-black text-gray-900">
              {formatYen(xAd.revenueYen)}
            </p>
            <p className="text-xs text-gray-500">
              ROAS {xAd.roas === null ? "-" : `${xAd.roas.toFixed(2)}x`}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-xs text-gray-400">広告メモ</p>
            <p className="mt-1 text-sm font-bold text-gray-900">
              X広告費 {formatYen(xAd.spendYen)}
            </p>
            <p className="text-xs text-gray-500">
              変更時は X_AD_SPEND_YEN または API の x_ad_spend_yen を更新
            </p>
          </div>
        </div>

        {xCampaigns.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-gray-400">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-medium">campaign</th>
                  <th className="py-2 pr-3 font-medium">content</th>
                  <th className="py-2 pr-3 text-right font-medium">流入</th>
                  <th className="py-2 pr-3 text-right font-medium">試用</th>
                  <th className="py-2 pr-3 text-right font-medium">生成</th>
                  <th className="py-2 pr-3 text-right font-medium">決済</th>
                  <th className="py-2 pr-3 text-right font-medium">購入</th>
                  <th className="py-2 text-right font-medium">CPA</th>
                </tr>
              </thead>
              <tbody>
                {xCampaigns.map((row) => (
                  <tr key={`${row.campaign}:${row.content}`} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium text-gray-700">{row.campaign}</td>
                    <td className="py-2 pr-3 text-gray-500">{row.content}</td>
                    <td className="py-2 pr-3 text-right font-bold text-gray-900">{row.visitors}</td>
                    <td className="py-2 pr-3 text-right text-gray-600">{row.formStarts}</td>
                    <td className="py-2 pr-3 text-right text-gray-600">{row.generateCompletes}</td>
                    <td className="py-2 pr-3 text-right text-gray-600">{row.checkoutStarts}</td>
                    <td className="py-2 pr-3 text-right font-bold text-green-700">{row.purchases}</td>
                    <td className="py-2 text-right text-gray-600">
                      {row.cpaYen ? formatYen(row.cpaYen) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                    {ev.utm_campaign && (
                      <span className="text-blue-500">
                        [{ev.utm_campaign}]{" "}
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
