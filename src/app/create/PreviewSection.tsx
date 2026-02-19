/**
 * PreviewSection コンポーネント
 *
 * 左: スクリーンショットプレビュー（PC/スマホ切り替え）
 * 右: 入力内容の編集パネル（各項目をインライン編集 → 再生成）
 */

"use client";

import { useState } from "react";
import type { SiteFormData } from "@/lib/gemini";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface PreviewSectionProps {
  pcImage: string;
  mobileImage: string;
  formData: SiteFormData;
  regenerationsLeft: number;
  onRegenerate: (updatedData: SiteFormData, instruction: string) => void;
  onPublish: () => void;
  isRegenerating: boolean;
  isPublishing?: boolean;
}

type DeviceTab = "pc" | "mobile";

const THEME_LABELS: Record<SiteFormData["colorTheme"], string> = {
  minimal: "ミニマル",
  business: "ビジネス",
  casual: "カジュアル",
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
}: PreviewSectionProps) {
  const [activeTab, setActiveTab] = useState<DeviceTab>("pc");
  const [editData, setEditData] = useState<SiteFormData>(formData);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");

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
          内容を修正して再生成、または公開へ進めます
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
                  公開中...
                </span>
              ) : (
                "このサイトを公開する"
              )}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">
              デモ版: 決済なしで即公開されます
            </p>
          </div>
        </div>

        {/* 右: 編集パネル（1/3幅） */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm sticky top-20">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">入力内容</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                クリックして編集 → 再生成
              </p>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {/* サイト名 */}
              <EditableField
                label="屋号・事業名"
                value={editData.siteName}
                isEditing={editingField === "siteName"}
                onStartEdit={() => setEditingField("siteName")}
                onEndEdit={() => setEditingField(null)}
                onChange={(v) => setEditData((prev) => ({ ...prev, siteName: v }))}
                type="input"
              />

              {/* キャッチコピー */}
              <EditableField
                label="キャッチコピー"
                value={editData.catchphrase}
                isEditing={editingField === "catchphrase"}
                onStartEdit={() => setEditingField("catchphrase")}
                onEndEdit={() => setEditingField(null)}
                onChange={(v) => setEditData((prev) => ({ ...prev, catchphrase: v }))}
                type="input"
              />

              {/* 説明 */}
              <EditableField
                label="説明・本文"
                value={editData.description}
                isEditing={editingField === "description"}
                onStartEdit={() => setEditingField("description")}
                onEndEdit={() => setEditingField(null)}
                onChange={(v) => setEditData((prev) => ({ ...prev, description: v }))}
                type="textarea"
              />

              {/* 連絡先 */}
              <EditableField
                label="連絡先"
                value={editData.contactInfo}
                isEditing={editingField === "contactInfo"}
                onStartEdit={() => setEditingField("contactInfo")}
                onEndEdit={() => setEditingField(null)}
                onChange={(v) => setEditData((prev) => ({ ...prev, contactInfo: v }))}
                type="textarea"
              />

              {/* カラーテーマ */}
              <div className="pt-1">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">カラーテーマ</label>
                <div className="flex gap-2">
                  {(["minimal", "business", "casual"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditData((prev) => ({ ...prev, colorTheme: t }))}
                      className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                        editData.colorTheme === t
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                      }`}
                    >
                      {THEME_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 修正指示（自由記述） */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  AIへの追加指示
                </label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={"例:\n・もっとシンプルにしてほしい\n・キャッチコピーをもっと目立たせて\n・連絡先セクションを大きく\n・全体的にもっと高級感を出して"}
                  rows={4}
                  maxLength={500}
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 resize-none placeholder:text-gray-400"
                />
                <div className="flex justify-between mt-1">
                  <p className="text-[10px] text-gray-400">
                    デザインやテキストの修正指示を自由に記入
                  </p>
                  <span className="text-[10px] text-gray-400">{instruction.length}/500</span>
                </div>
              </div>
            </div>

            {/* 再生成ボタン */}
            <div className="p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={isRegenerating || regenerationsLeft <= 0}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all ${
                  hasChanges && !isRegenerating && regenerationsLeft > 0
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                    : "border-2 border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isRegenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon />
                    再生成中...
                  </span>
                ) : hasChanges ? (
                  `変更を反映して再生成（残り${regenerationsLeft}回）`
                ) : (
                  `デザインを変えて再生成（残り${regenerationsLeft}回）`
                )}
              </button>
              {regenerationsLeft <= 0 && (
                <p className="text-center text-xs text-red-400 mt-2">
                  再生成の回数上限に達しました
                </p>
              )}
            </div>
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

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
