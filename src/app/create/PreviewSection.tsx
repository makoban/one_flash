/**
 * PreviewSection コンポーネント
 *
 * 左: スクリーンショットプレビュー（PC/スマホ切り替え）
 * 右: AI指示を主要UIとした編集パネル + 履歴
 */

"use client";

import { useState } from "react";
import type { SiteFormData } from "@/lib/gemini";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface HistoryEntry {
  id: number;
  previewData: {
    pcImage: string;
    mobileImage: string;
    html: string;
  };
  instruction: string;
  timestamp: Date;
}

interface PreviewSectionProps {
  pcImage: string;
  mobileImage: string;
  formData: SiteFormData;
  regenerationsLeft: number;
  onRegenerate: (updatedData: SiteFormData, instruction: string) => void;
  onPublish: () => void;
  isRegenerating: boolean;
  isPublishing?: boolean;
  history: HistoryEntry[];
  currentHistoryIndex: number;
  onRestoreFromHistory: (historyId: number) => void;
}

type DeviceTab = "pc" | "mobile";

const THEME_LABELS: Record<SiteFormData["colorTheme"], string> = {
  simple: "シンプル",
  colorful: "カラフル",
  business: "ビジネス",
};

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function PreviewSection({
  pcImage,
  mobileImage,
  formData,
  regenerationsLeft,
  onRegenerate,
  onPublish,
  isRegenerating,
  isPublishing = false,
  history,
  currentHistoryIndex,
  onRestoreFromHistory,
}: PreviewSectionProps) {
  const [activeTab, setActiveTab] = useState<DeviceTab>("pc");
  const [editData, setEditData] = useState<SiteFormData>(formData);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const currentImage = activeTab === "pc" ? pcImage : mobileImage;

  // 変更があるかどうか
  const hasChanges =
    editData.siteName !== formData.siteName ||
    editData.catchphrase !== formData.catchphrase ||
    editData.description !== formData.description ||
    editData.contactInfo !== formData.contactInfo ||
    editData.colorTheme !== formData.colorTheme ||
    instruction.trim().length > 0;

  function handleRegenerate() {
    onRegenerate(editData, instruction.trim());
    setEditingField(null);
    setInstruction("");
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">プレビュー</h2>
        <p className="mt-1 text-sm text-gray-500">
          AIに修正指示を出して再生成、または公開へ進めます
        </p>
      </div>

      {/* 2カラムレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 左: プレビュー画像（2/3幅） */}
        <div className="lg:col-span-2">
          {/* デバイス切り替えタブ */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
              <TabButton
                active={activeTab === "pc"}
                onClick={() => setActiveTab("pc")}
                icon={<MonitorIcon />}
                label="PC"
              />
              <TabButton
                active={activeTab === "mobile"}
                onClick={() => setActiveTab("mobile")}
                icon={<SmartphoneIcon />}
                label="スマホ"
              />
            </div>
          </div>

          {/* 画像表示エリア */}
          <div
            className={`relative bg-gray-50 rounded-xl border border-gray-200 shadow-md overflow-hidden ${
              activeTab === "mobile" ? "max-w-xs mx-auto" : "w-full"
            }`}
          >
            {isRegenerating ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 font-medium">再生成中...</p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImage}
                alt={activeTab === "pc" ? "PC版プレビュー" : "スマホ版プレビュー"}
                className="w-full h-auto block"
              />
            )}

            <div className="absolute top-3 left-3">
              <span className="text-[10px] font-semibold text-white bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                {activeTab === "pc" ? "PC版" : "スマホ版"}
              </span>
            </div>
          </div>

          {/* 公開ボタン（プレビュー下） */}
          <div className="mt-6">
            <button
              type="button"
              onClick={onPublish}
              disabled={isRegenerating || isPublishing}
              className="w-full py-4 px-6 bg-indigo-600 text-white rounded-xl font-bold text-base hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPublishing ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon />
                  決済画面へ移動中...
                </span>
              ) : (
                "このサイトを公開する（決済へ進む）"
              )}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">
              初期制作費 2,980円 + 月額 380円/月（初月無料）
            </p>
          </div>
        </div>

        {/* 右: 編集パネル（1/3幅） */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm sticky top-20">

            {/* === AI指示エリア（メイン・強調） === */}
            <div className="p-5 bg-gradient-to-b from-indigo-50 to-white rounded-t-2xl border-b border-indigo-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">AIに修正を指示</h3>
                  <p className="text-xs text-indigo-500 font-medium">
                    ここに入力するだけでデザインが変わります
                  </p>
                </div>
              </div>

              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={"例:\n・もっとシンプルにしてほしい\n・キャッチコピーをもっと目立たせて\n・連絡先セクションを大きく\n・全体的にもっと高級感を出して\n・アイコンを増やして華やかに"}
                rows={6}
                maxLength={500}
                className="w-full px-4 py-3 text-sm text-gray-900 bg-white border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 resize-none placeholder:text-gray-400 shadow-inner"
              />
              <div className="flex justify-between mt-1.5">
                <p className="text-[10px] text-indigo-400 font-medium">
                  デザイン・テキスト・レイアウト何でもOK
                </p>
                <span className="text-[10px] text-gray-400">{instruction.length}/500</span>
              </div>

              {/* カラーテーマ切り替え */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">テーマ変更</label>
                <div className="flex gap-2">
                  {(["simple", "colorful", "business"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditData((prev) => ({ ...prev, colorTheme: t }))}
                      className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                        editData.colorTheme === t
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                      }`}
                    >
                      {THEME_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 再生成ボタン */}
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isRegenerating || regenerationsLeft <= 0}
                className={`w-full mt-4 py-3.5 px-4 rounded-xl font-bold text-sm transition-all ${
                  hasChanges && !isRegenerating && regenerationsLeft > 0
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg"
                    : "bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isRegenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon />
                    再生成中...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {hasChanges ? "変更を反映して再生成" : "デザインを変えて再生成"}
                    <span className="text-xs opacity-80">（残り{regenerationsLeft}回）</span>
                  </span>
                )}
              </button>
              {regenerationsLeft <= 0 && (
                <p className="text-center text-xs text-red-400 mt-2">
                  再生成の回数上限に達しました
                </p>
              )}
            </div>

            {/* === 履歴 === */}
            {history.length > 1 && (
              <div className="border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setHistoryOpen(!historyOpen)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-600">
                      生成履歴（{history.length}件）
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${historyOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {historyOpen && (
                  <div className="px-4 pb-4 space-y-1.5">
                    {history.map((entry, index) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => onRestoreFromHistory(entry.id)}
                        disabled={isRegenerating}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                          index === currentHistoryIndex
                            ? "bg-indigo-50 border border-indigo-200"
                            : "bg-gray-50 border border-transparent hover:bg-gray-100 hover:border-gray-200"
                        } disabled:opacity-50`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          index === currentHistoryIndex
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}>
                          {entry.id}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs truncate ${
                            index === currentHistoryIndex ? "text-indigo-700 font-medium" : "text-gray-600"
                          }`}>
                            {entry.instruction}
                          </p>
                        </div>
                        {index === currentHistoryIndex && (
                          <span className="text-[10px] text-indigo-500 font-medium flex-shrink-0">表示中</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === 入力内容の直接編集（折りたたみ） === */}
            <FieldsAccordion
              editData={editData}
              setEditData={setEditData}
              editingField={editingField}
              setEditingField={setEditingField}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 編集可能フィールド
// ---------------------------------------------------------------------------

interface EditableFieldProps {
  label: string;
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onChange: (v: string) => void;
  type: "input" | "textarea";
}

function EditableField({
  label,
  value,
  isEditing,
  onStartEdit,
  onEndEdit,
  onChange,
  type,
}: EditableFieldProps) {
  if (isEditing) {
    return (
      <div>
        <label className="block text-xs font-medium text-indigo-600 mb-1">{label}</label>
        {type === "textarea" ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onEndEdit}
            autoFocus
            rows={3}
            className="w-full px-3 py-2 text-sm text-gray-900 bg-indigo-50 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onEndEdit}
            autoFocus
            className="w-full px-3 py-2 text-sm text-gray-900 bg-indigo-50 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className="w-full text-left group"
    >
      <label className="block text-xs font-medium text-gray-500 mb-0.5 pointer-events-none">
        {label}
      </label>
      <div className="px-3 py-2 rounded-lg border border-transparent group-hover:border-indigo-200 group-hover:bg-indigo-50/50 transition-all">
        <p className="text-sm text-gray-800 line-clamp-2">{value}</p>
        <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
          クリックして編集
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// 共通パーツ
// ---------------------------------------------------------------------------

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-white text-indigo-600 shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MonitorIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 21h8M12 17v4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SmartphoneIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 18h.01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 入力内容の折りたたみパネル
// ---------------------------------------------------------------------------

function FieldsAccordion({
  editData,
  setEditData,
  editingField,
  setEditingField,
}: {
  editData: SiteFormData;
  setEditData: React.Dispatch<React.SetStateAction<SiteFormData>>;
  editingField: string | null;
  setEditingField: (f: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-xs font-medium text-gray-500">入力内容を直接編集</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <EditableField
            label="屋号・事業名"
            value={editData.siteName}
            isEditing={editingField === "siteName"}
            onStartEdit={() => setEditingField("siteName")}
            onEndEdit={() => setEditingField(null)}
            onChange={(v) => setEditData((prev) => ({ ...prev, siteName: v }))}
            type="input"
          />
          <EditableField
            label="キャッチコピー"
            value={editData.catchphrase}
            isEditing={editingField === "catchphrase"}
            onStartEdit={() => setEditingField("catchphrase")}
            onEndEdit={() => setEditingField(null)}
            onChange={(v) => setEditData((prev) => ({ ...prev, catchphrase: v }))}
            type="input"
          />
          <EditableField
            label="説明・本文"
            value={editData.description}
            isEditing={editingField === "description"}
            onStartEdit={() => setEditingField("description")}
            onEndEdit={() => setEditingField(null)}
            onChange={(v) => setEditData((prev) => ({ ...prev, description: v }))}
            type="textarea"
          />
          <EditableField
            label="連絡先"
            value={editData.contactInfo}
            isEditing={editingField === "contactInfo"}
            onStartEdit={() => setEditingField("contactInfo")}
            onEndEdit={() => setEditingField(null)}
            onChange={(v) => setEditData((prev) => ({ ...prev, contactInfo: v }))}
            type="textarea"
          />
        </div>
      )}
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
