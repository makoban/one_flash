/**
 * Admin ダッシュボード 共有UIコンポーネント
 *
 * KpiCard / StatusBadge / EventBadge と
 * フォーマットユーティリティ関数をエクスポートする。
 */

"use client";

// ---------------------------------------------------------------------------
// フォーマットユーティリティ
// ---------------------------------------------------------------------------

/**
 * 日時文字列を「N分前」「N時間前」「N日前」形式に変換する
 */
export function formatTime(dateStr: string): string {
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

/**
 * 数値を「¥1,234」形式にフォーマットする
 */
export function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString("ja-JP")}`;
}

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

const KPI_COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-50 border-indigo-100",
  green: "bg-green-50 border-green-100",
  blue: "bg-blue-50 border-blue-100",
  amber: "bg-amber-50 border-amber-100",
  red: "bg-red-50 border-red-100",
  purple: "bg-purple-50 border-purple-100",
};

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  color: string;
}

export function KpiCard({ label, value, sub, color }: KpiCardProps) {
  const colorClass = KPI_COLOR_MAP[color] ?? "bg-gray-50 border-gray-100";
  return (
    <div className={`rounded-2xl border p-5 ${colorClass}`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

const STATUS_DOT_MAP: Record<string, string> = {
  active: "bg-green-500",
  past_due: "bg-yellow-500",
  canceled: "bg-red-500",
  trialing: "bg-blue-500",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const dotClass = STATUS_DOT_MAP[status] ?? "bg-gray-400";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${dotClass} mr-1.5`}
    />
  );
}

// ---------------------------------------------------------------------------
// EventBadge
// ---------------------------------------------------------------------------

const EVENT_LABEL_MAP: Record<string, { text: string; bg: string }> = {
  page_view: { text: "PV", bg: "bg-gray-100 text-gray-600" },
  form_start: { text: "FS", bg: "bg-blue-100 text-blue-600" },
  checkout_start: { text: "CS", bg: "bg-amber-100 text-amber-600" },
  subscribed: { text: "CV", bg: "bg-green-100 text-green-700" },
};

interface EventBadgeProps {
  type: string;
}

export function EventBadge({ type }: EventBadgeProps) {
  const l = EVENT_LABEL_MAP[type] ?? {
    text: type.substring(0, 2).toUpperCase(),
    bg: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${l.bg} flex-shrink-0`}
    >
      {l.text}
    </span>
  );
}
