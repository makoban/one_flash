/**
 * /admin 統合管理ダッシュボード
 *
 * 5タブ構成:
 *   [全体] [OnePage-Flash] [ai-fudosan] [ai-shoken] [ai-shigyo]
 *
 * パスワード認証付き（URL: /admin?pw=ADMIN_PASSWORD）。
 * アクティブなタブのみ30秒ごとに自動更新。
 */

"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { KpiCard, formatYen } from "./AdminComponents";
import { OpfTab } from "./OpfTab";
import { PurchaseTab } from "./PurchaseTab";
import type {
  OpfStatsData,
  PurchaseStats,
  OverviewData,
} from "../api/admin/stats/route";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

type TabId = "overview" | "opf" | "fudosan" | "shoken" | "shigyo";

interface TabConfig {
  id: TabId;
  label: string;
  service: string;
}

const TABS: TabConfig[] = [
  { id: "overview", label: "全体", service: "overview" },
  { id: "opf", label: "OnePage-Flash", service: "opf" },
  { id: "fudosan", label: "ai-fudosan", service: "fudosan" },
  { id: "shoken", label: "ai-shoken", service: "shoken" },
  { id: "shigyo", label: "ai-shigyo", service: "shigyo" },
];

// Tailwindのクラスを動的に生成しないよう、静的マッピングを使用
const TAB_ACTIVE_STYLES: Record<TabId, string> = {
  overview: "bg-indigo-100 text-indigo-800 font-bold",
  opf: "bg-blue-100 text-blue-800 font-bold",
  fudosan: "bg-green-100 text-green-800 font-bold",
  shoken: "bg-amber-100 text-amber-800 font-bold",
  shigyo: "bg-rose-100 text-rose-800 font-bold",
};

const TAB_INACTIVE_STYLE =
  "bg-white text-gray-500 hover:bg-gray-50 font-medium";

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

function AdminContent() {
  const searchParams = useSearchParams();
  const pw = searchParams.get("pw") ?? "";

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [opfData, setOpfData] = useState<OpfStatsData | null>(null);
  const [fudosanData, setFudosanData] = useState<PurchaseStats | null>(null);
  const [shokenData, setShokenData] = useState<PurchaseStats | null>(null);
  const [shigyoData, setShigyoData] = useState<PurchaseStats | null>(null);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingOpf, setLoadingOpf] = useState(false);
  const [loadingFudosan, setLoadingFudosan] = useState(false);
  const [loadingShoken, setLoadingShoken] = useState(false);
  const [loadingShigyo, setLoadingShigyo] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [tabError, setTabError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // フェッチヘルパー
  // ---------------------------------------------------------------------------

  const fetchService = useCallback(
    async (service: string) => {
      const res = await fetch(
        `/api/admin/stats?pw=${encodeURIComponent(pw)}&service=${service}`
      );
      if (res.status === 401) {
        throw new Error("auth");
      }
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "fetch error");
      }
      return res.json();
    },
    [pw]
  );

  // ---------------------------------------------------------------------------
  // Overview フェッチ
  // ---------------------------------------------------------------------------

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    setTabError(null);
    try {
      const data = (await fetchService("overview")) as OverviewData;
      setOverviewData(data);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "auth") {
        setAuthError(
          "認証に失敗しました。正しいパスワードをURLに含めてください。\n例: /admin?pw=your_password"
        );
      } else {
        setTabError("概要データの取得に失敗しました");
      }
    } finally {
      setLoadingOverview(false);
    }
  }, [fetchService]);

  // ---------------------------------------------------------------------------
  // タブ別フェッチ
  // ---------------------------------------------------------------------------

  const fetchOpf = useCallback(async () => {
    setLoadingOpf(true);
    setTabError(null);
    try {
      const data = (await fetchService("opf")) as OpfStatsData;
      setOpfData(data);
    } catch {
      setTabError("OnePage-Flash データの取得に失敗しました");
    } finally {
      setLoadingOpf(false);
    }
  }, [fetchService]);

  const fetchFudosan = useCallback(async () => {
    setLoadingFudosan(true);
    setTabError(null);
    try {
      const data = (await fetchService("fudosan")) as PurchaseStats;
      setFudosanData(data);
    } catch {
      setTabError("ai-fudosan データの取得に失敗しました");
    } finally {
      setLoadingFudosan(false);
    }
  }, [fetchService]);

  const fetchShoken = useCallback(async () => {
    setLoadingShoken(true);
    setTabError(null);
    try {
      const data = (await fetchService("shoken")) as PurchaseStats;
      setShokenData(data);
    } catch {
      setTabError("ai-shoken データの取得に失敗しました");
    } finally {
      setLoadingShoken(false);
    }
  }, [fetchService]);

  const fetchShigyo = useCallback(async () => {
    setLoadingShigyo(true);
    setTabError(null);
    try {
      const data = (await fetchService("shigyo")) as PurchaseStats;
      setShigyoData(data);
    } catch {
      setTabError("ai-shigyo データの取得に失敗しました");
    } finally {
      setLoadingShigyo(false);
    }
  }, [fetchService]);

  // ---------------------------------------------------------------------------
  // タブ切り替え時のフェッチ
  // ---------------------------------------------------------------------------

  const fetchActiveTab = useCallback(() => {
    switch (activeTab) {
      case "overview":
        fetchOverview();
        break;
      case "opf":
        fetchOpf();
        break;
      case "fudosan":
        fetchFudosan();
        break;
      case "shoken":
        fetchShoken();
        break;
      case "shigyo":
        fetchShigyo();
        break;
    }
  }, [activeTab, fetchOverview, fetchOpf, fetchFudosan, fetchShoken, fetchShigyo]);

  // 初回マウント時に Overview をフェッチ
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // タブ切り替え時にデータがなければフェッチ
  useEffect(() => {
    if (activeTab === "overview" && !overviewData) {
      fetchOverview();
    } else if (activeTab === "opf" && !opfData) {
      fetchOpf();
    } else if (activeTab === "fudosan" && !fudosanData) {
      fetchFudosan();
    } else if (activeTab === "shoken" && !shokenData) {
      fetchShoken();
    } else if (activeTab === "shigyo" && !shigyoData) {
      fetchShigyo();
    }
  }, [
    activeTab,
    overviewData,
    opfData,
    fudosanData,
    shokenData,
    shigyoData,
    fetchOverview,
    fetchOpf,
    fetchFudosan,
    fetchShoken,
    fetchShigyo,
  ]);

  // 30秒ごとにアクティブタブのみ自動更新
  useEffect(() => {
    const interval = setInterval(() => {
      fetchActiveTab();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchActiveTab]);

  // ---------------------------------------------------------------------------
  // 認証エラー表示
  // ---------------------------------------------------------------------------

  if (authError) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-4">
            Admin Dashboard
          </h1>
          <p className="text-sm text-red-600 whitespace-pre-line">{authError}</p>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // レンダリング
  // ---------------------------------------------------------------------------

  const isLoadingActive =
    (activeTab === "overview" && loadingOverview) ||
    (activeTab === "opf" && loadingOpf) ||
    (activeTab === "fudosan" && loadingFudosan) ||
    (activeTab === "shoken" && loadingShoken) ||
    (activeTab === "shigyo" && loadingShigyo);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            統合管理ダッシュボード
          </h1>
          <button
            onClick={fetchActiveTab}
            disabled={isLoadingActive}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            {isLoadingActive ? "更新中..." : "更新"}
          </button>
        </div>

        {/* タブバー */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setTabError(null);
              }}
              className={`px-4 py-2 rounded-xl text-sm transition-colors ${
                activeTab === tab.id
                  ? TAB_ACTIVE_STYLES[tab.id]
                  : TAB_INACTIVE_STYLE
              } border`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* タブエラー */}
        {tabError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {tabError}
          </div>
        )}

        {/* タブコンテンツ */}
        {activeTab === "overview" && (
          <OverviewTabContent data={overviewData} loading={loadingOverview} />
        )}

        {activeTab === "opf" && (
          <>
            {loadingOpf && !opfData ? (
              <LoadingPlaceholder />
            ) : opfData ? (
              <OpfTab data={opfData} />
            ) : (
              <EmptyPlaceholder message="データなし。「更新」ボタンを押してください。" />
            )}
          </>
        )}

        {activeTab === "fudosan" && (
          <PurchaseTab
            data={fudosanData}
            loading={loadingFudosan}
            serviceName="ai-fudosan"
            serviceLabel="ai-fudosan"
          />
        )}

        {activeTab === "shoken" && (
          <PurchaseTab
            data={shokenData}
            loading={loadingShoken}
            serviceName="ai-shoken"
            serviceLabel="ai-shoken"
          />
        )}

        {activeTab === "shigyo" && (
          <PurchaseTab
            data={shigyoData}
            loading={loadingShigyo}
            serviceName="ai-shigyo"
            serviceLabel="ai-shigyo"
          />
        )}

        {/* コスト監視リマインダー */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-amber-800 mb-3">
            日次コスト監視チェックリスト
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-700">
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-amber-900 underline"
            >
              Stripe Dashboard → 売上・チャーン確認
            </a>
            <a
              href="https://console.cloud.google.com/apis/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-amber-900 underline"
            >
              Google Cloud → Gemini API使用量
            </a>
            <a
              href="https://dash.cloudflare.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-amber-900 underline"
            >
              Cloudflare → Workers/R2使用量
            </a>
            <a
              href="https://dashboard.render.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-amber-900 underline"
            >
              Render → CPU/Memory使用率
            </a>
            <a
              href="https://resend.com/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-amber-900 underline"
            >
              Resend → メール送信数
            </a>
            <a
              href="https://analytics.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-amber-900 underline"
            >
              GA4 → アクセス解析
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Overview タブコンテンツ
// ---------------------------------------------------------------------------

function OverviewTabContent({
  data,
  loading,
}: {
  data: OverviewData | null;
  loading: boolean;
}) {
  if (loading && !data) {
    return <LoadingPlaceholder />;
  }

  if (!data) {
    return (
      <EmptyPlaceholder message="データなし。「更新」ボタンを押してください。" />
    );
  }

  const { grandTotal, opf, fudosan, shoken, shigyo } = data;

  return (
    <div className="space-y-6">
      {/* Row 1: 全サービス合計KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="全サービス今月売上"
          value={formatYen(grandTotal.thisMonthRevenue)}
          sub="全サービス合計"
          color="indigo"
        />
        <KpiCard
          label="全サービス累計売上"
          value={formatYen(grandTotal.totalRevenue)}
          sub="全サービス合計"
          color="purple"
        />
        <KpiCard
          label="全サービスユーザー数"
          value={grandTotal.totalUsers.toLocaleString()}
          sub="累計（重複含む）"
          color="blue"
        />
      </div>

      {/* Row 2: サービス別サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* OnePage-Flash */}
        <ServiceSummaryCard
          label="OnePage-Flash"
          colorBar="bg-blue-400"
          items={
            opf
              ? [
                  { key: "MRR", value: formatYen(opf.mrr) },
                  { key: "アクティブサブスク", value: `${opf.activeSubs}件` },
                  { key: "累計ユーザー", value: `${opf.totalUsers}人` },
                  { key: "今月売上（推定）", value: formatYen(opf.thisMonthRevenue) },
                ]
              : null
          }
        />

        {/* ai-fudosan */}
        <ServiceSummaryCard
          label="ai-fudosan"
          colorBar="bg-green-400"
          items={
            fudosan
              ? [
                  { key: "今月売上", value: formatYen(fudosan.thisMonthRevenue) },
                  { key: "累計売上", value: formatYen(fudosan.totalRevenue) },
                  { key: "ユニーク購入者", value: `${fudosan.uniqueUsers}人` },
                  { key: "累計購入数", value: `${fudosan.totalPurchases}件` },
                ]
              : null
          }
        />

        {/* ai-shoken */}
        <ServiceSummaryCard
          label="ai-shoken"
          colorBar="bg-amber-400"
          items={
            shoken
              ? [
                  { key: "今月売上", value: formatYen(shoken.thisMonthRevenue) },
                  { key: "累計売上", value: formatYen(shoken.totalRevenue) },
                  { key: "ユニーク購入者", value: `${shoken.uniqueUsers}人` },
                  { key: "累計購入数", value: `${shoken.totalPurchases}件` },
                ]
              : null
          }
        />

        {/* ai-shigyo */}
        <ServiceSummaryCard
          label="ai-shigyo"
          colorBar="bg-rose-400"
          items={
            shigyo
              ? [
                  { key: "今月売上", value: formatYen(shigyo.thisMonthRevenue) },
                  { key: "累計売上", value: formatYen(shigyo.totalRevenue) },
                  { key: "ユニーク購入者", value: `${shigyo.uniqueUsers}人` },
                  { key: "累計購入数", value: `${shigyo.totalPurchases}件` },
                ]
              : null
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ServiceSummaryCard
// ---------------------------------------------------------------------------

function ServiceSummaryCard({
  label,
  colorBar,
  items,
}: {
  label: string;
  colorBar: string;
  items: Array<{ key: string; value: string }> | null;
}) {
  return (
    <div className="bg-white rounded-2xl border overflow-hidden">
      <div className={`h-1.5 w-full ${colorBar}`} />
      <div className="p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">{label}</h3>
        {items ? (
          <dl className="space-y-2">
            {items.map(({ key, value }) => (
              <div
                key={key}
                className="flex items-center justify-between text-xs"
              >
                <dt className="text-gray-500">{key}</dt>
                <dd className="font-bold text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-gray-400">
            データ取得不可
            <br />
            環境変数を確認してください
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ユーティリティコンポーネント
// ---------------------------------------------------------------------------

function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-400 text-sm">読み込み中...</p>
    </div>
  );
}

function EmptyPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-gray-400 text-sm text-center whitespace-pre-line">
        {message}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// エクスポート
// ---------------------------------------------------------------------------

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AdminContent />
    </Suspense>
  );
}
