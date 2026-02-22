/**
 * 購入サービスタブコンポーネント（ai-fudosan / ai-shoken 共通）
 *
 * Layout:
 *   Row 1: 4 KPI cards（累計売上 / 今月売上 / 今日の売上 / ユニーク購入者）
 *   Row 2: 2カラム（日別売上テーブル30日 / 人気エリアTOP10）
 *   Row 3: 最近の購入テーブル
 */

"use client";

import { KpiCard, formatYen, formatTime } from "./AdminComponents";
import type { PurchaseStats } from "../api/admin/stats/route";

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

interface PurchaseTabProps {
  data: PurchaseStats | null;
  loading: boolean;
  serviceName: string;
  serviceLabel: string;
}

export function PurchaseTab({
  data,
  loading,
  serviceName,
  serviceLabel,
}: PurchaseTabProps) {
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400 text-sm">
          {serviceLabel} のデータを取得できませんでした。
          <br />
          SUPABASE_DATABASE_URL が設定されているか確認してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: KPI カード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="累計売上"
          value={formatYen(data.totalRevenue)}
          sub={`累計${data.totalPurchases}件`}
          color="indigo"
        />
        <KpiCard
          label="今月売上"
          value={formatYen(data.thisMonthRevenue)}
          sub={`${data.thisMonthCount}件`}
          color="green"
        />
        <KpiCard
          label="今日の売上"
          value={formatYen(data.todayRevenue)}
          sub={serviceName}
          color="blue"
        />
        <KpiCard
          label="ユニーク購入者"
          value={data.uniqueUsers.toLocaleString()}
          sub="累計"
          color="amber"
        />
      </div>

      {/* Row 2: 日別売上 & 人気エリア */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 日別売上テーブル（過去30日） */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">
            日別売上（過去30日）
          </h2>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left py-1.5 font-medium">日付</th>
                  <th className="text-right py-1.5 font-medium">件数</th>
                  <th className="text-right py-1.5 font-medium">売上</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.dailyRevenue.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50">
                    <td className="py-1.5 text-gray-600">{row.date}</td>
                    <td className="py-1.5 text-right text-gray-700">
                      {row.count}
                    </td>
                    <td className="py-1.5 text-right font-medium text-gray-900">
                      {formatYen(row.revenue)}
                    </td>
                  </tr>
                ))}
                {data.dailyRevenue.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-4 text-center text-gray-400"
                    >
                      データなし
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 人気エリアTOP10 */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">
            人気エリア TOP10
          </h2>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left py-1.5 font-medium">エリア</th>
                  <th className="text-left py-1.5 font-medium">コード</th>
                  <th className="text-right py-1.5 font-medium">件数</th>
                  <th className="text-right py-1.5 font-medium">売上</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.topAreas.map((area, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-1.5 text-gray-700">
                      {area.area_name ?? "-"}
                    </td>
                    <td className="py-1.5 text-gray-400">
                      {area.area_code ?? "-"}
                    </td>
                    <td className="py-1.5 text-right text-gray-700">
                      {area.count}
                    </td>
                    <td className="py-1.5 text-right font-medium text-gray-900">
                      {formatYen(area.revenue)}
                    </td>
                  </tr>
                ))}
                {data.topAreas.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-center text-gray-400"
                    >
                      データなし
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: 最近の購入 */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4">
          最近の購入（直近20件）
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-2 font-medium">メールアドレス</th>
                <th className="text-left py-2 font-medium">エリア名</th>
                <th className="text-left py-2 font-medium">エリアコード</th>
                <th className="text-right py-2 font-medium">金額</th>
                <th className="text-right py-2 font-medium">購入日時</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.recentPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-gray-50">
                  <td className="py-2 text-gray-700 max-w-[180px] truncate">
                    {purchase.email ?? (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="py-2 text-gray-600">
                    {purchase.area_name ?? "-"}
                  </td>
                  <td className="py-2 text-gray-400">
                    {purchase.area_code ?? "-"}
                  </td>
                  <td className="py-2 text-right font-medium text-gray-900">
                    {formatYen(purchase.amount)}
                  </td>
                  <td className="py-2 text-right text-gray-400">
                    {formatTime(purchase.purchased_at)}
                  </td>
                </tr>
              ))}
              {data.recentPurchases.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-gray-400"
                  >
                    購入なし
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
