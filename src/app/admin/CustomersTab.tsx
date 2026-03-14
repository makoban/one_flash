/**
 * 顧客管理タブ
 *
 * Stripe + ココナラ顧客を統合表示・管理するコンポーネント。
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface Customer {
  siteId: string;
  subdomain: string;
  siteName: string | null;
  email: string;
  paymentSource: "stripe" | "coconala";
  coconalaOrderId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string;
  isActive: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  createdAt: string;
  lastPaymentConfirmedAt: string | null;
}

interface Summary {
  total: number;
  active: number;
  inactive: number;
  stripeCount: number;
  coconalaCount: number;
  expiringCount: number;
}

interface CustomersTabProps {
  pw: string;
}

type FilterType = "all" | "active" | "inactive" | "expiring";

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export function CustomersTab({ pw }: CustomersTabProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 課金確認ダイアログ
  const [confirmTarget, setConfirmTarget] = useState<Customer | null>(null);
  const [confirmAmount, setConfirmAmount] = useState(1000);
  const [confirmMemo, setConfirmMemo] = useState("");
  const [confirming, setConfirming] = useState(false);

  // 状態変更中
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const workerUrl = "https://sites.oneflash.net";

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pw, filter });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/customers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      setCustomers(data.customers);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [pw, filter, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // 30秒自動更新
  useEffect(() => {
    const interval = setInterval(fetchCustomers, 30_000);
    return () => clearInterval(interval);
  }, [fetchCustomers]);

  // --- 課金確認 ---
  async function handleConfirmPayment() {
    if (!confirmTarget?.subscriptionId) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/admin/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pw,
          subscriptionId: confirmTarget.subscriptionId,
          amount: confirmAmount,
          memo: confirmMemo || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "課金確認に失敗しました");
      }
      setConfirmTarget(null);
      setConfirmMemo("");
      setConfirmAmount(1000);
      fetchCustomers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラー");
    } finally {
      setConfirming(false);
    }
  }

  // --- サイト停止/再公開 ---
  async function handleSiteAction(subdomain: string, action: "deactivate" | "reactivate") {
    if (action === "deactivate" && !confirm(`「${subdomain}」を非公開にしますか？`)) return;
    setActionLoading(subdomain);
    try {
      const res = await fetch("/api/admin/update-site-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pw, subdomain, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "操作に失敗しました");
      }
      fetchCustomers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラー");
    } finally {
      setActionLoading(null);
    }
  }

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="合計" value={summary.total} color="gray" />
          <SummaryCard label="公開中" value={summary.active} color="green" />
          <SummaryCard label="停止中" value={summary.inactive} color="red" />
          <SummaryCard label="Stripe" value={summary.stripeCount} color="indigo" />
          <SummaryCard label="ココナラ" value={summary.coconalaCount} color="amber" />
          <SummaryCard label="要確認" value={summary.expiringCount} color="rose" />
        </div>
      )}

      {/* フィルター＋検索 */}
      <div className="flex flex-wrap gap-2 items-center">
        {(["all", "active", "inactive", "expiring"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filter === f
                ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {{ all: "全て", active: "公開中", inactive: "停止中", expiring: "要確認" }[f]}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="サイト名・メール検索..."
          className="ml-auto px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 w-48"
        />
      </div>

      {/* エラー */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* テーブル */}
      {loading && !customers.length ? (
        <div className="text-center py-20 text-gray-400 text-sm">読み込み中...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">顧客データなし</div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">サイト名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">サブドメイン</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">メール</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">支払元</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">ステータス</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">有効期限</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">サイト</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <tr key={c.siteId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[150px] truncate">
                      {c.siteName ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`${workerUrl}/s/${c.subdomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        {c.subdomain}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{c.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.paymentSource === "coconala"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-indigo-100 text-indigo-800"
                      }`}>
                        {c.paymentSource}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.subscriptionStatus} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.paymentSource === "stripe" ? (
                        <span className="text-gray-400">自動管理</span>
                      ) : c.expiresAt ? (
                        <span className={c.daysRemaining !== null && c.daysRemaining <= 7 ? "text-red-600 font-bold" : ""}>
                          {new Date(c.expiresAt).toLocaleDateString("ja-JP")}
                          {c.daysRemaining !== null && (
                            <span className="ml-1 text-[10px]">（残{c.daysRemaining}日）</span>
                          )}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}>
                        {c.isActive ? "公開中" : "停止中"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <a
                          href={`${workerUrl}/s/${c.subdomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-[10px] bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          表示
                        </a>
                        {c.paymentSource === "coconala" && c.isActive && (
                          <button
                            onClick={() => { setConfirmTarget(c); setConfirmAmount(1000); setConfirmMemo(""); }}
                            className="px-2 py-1 text-[10px] bg-amber-100 text-amber-800 rounded hover:bg-amber-200"
                          >
                            課金確認
                          </button>
                        )}
                        {c.isActive ? (
                          <button
                            onClick={() => handleSiteAction(c.subdomain, "deactivate")}
                            disabled={actionLoading === c.subdomain}
                            className="px-2 py-1 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            停止
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSiteAction(c.subdomain, "reactivate")}
                            disabled={actionLoading === c.subdomain}
                            className="px-2 py-1 text-[10px] bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                          >
                            再公開
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 課金確認ダイアログ */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-bold text-gray-900 mb-4">
              「{confirmTarget.siteName ?? confirmTarget.subdomain}」の課金を確認しますか？
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">確認日</span>
                <span className="font-medium">{new Date().toLocaleDateString("ja-JP")}</span>
              </div>

              <div>
                <label className="block text-gray-500 mb-1">金額（円）</label>
                <input
                  type="number"
                  value={confirmAmount}
                  onChange={(e) => setConfirmAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">メモ（任意）</label>
                <input
                  type="text"
                  value={confirmMemo}
                  onChange={(e) => setConfirmMemo(e.target.value)}
                  placeholder="例: 3月分確認"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                有効期限: {confirmTarget.expiresAt ? new Date(confirmTarget.expiresAt).toLocaleDateString("ja-JP") : "未設定"} → +35日延長
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleConfirmPayment}
                disabled={confirming}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 disabled:opacity-50"
              >
                {confirming ? "処理中..." : "確認して延長する"}
              </button>
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ユーティリティコンポーネント
// ---------------------------------------------------------------------------

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: "bg-gray-50 text-gray-900",
    green: "bg-green-50 text-green-900",
    red: "bg-red-50 text-red-900",
    indigo: "bg-indigo-50 text-indigo-900",
    amber: "bg-amber-50 text-amber-900",
    rose: "bg-rose-50 text-rose-900",
  };
  return (
    <div className={`${colorMap[color] ?? colorMap.gray} rounded-xl p-4 text-center`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] font-medium opacity-70 mt-1">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    past_due: "bg-amber-100 text-amber-800",
    canceled: "bg-red-100 text-red-800",
    trialing: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
