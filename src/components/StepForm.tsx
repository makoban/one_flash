/**
 * StepForm コンポーネント
 *
 * 3ステップのウィザード形式フォームを管理する。
 * フォームデータの状態管理とステップ間のナビゲーションを担当。
 *
 * ステップ構成:
 *   Step 1: サイト基本情報（サイト名・キャッチコピー・本文・連絡先）
 *   Step 2: カラーテーマ選択
 *   Step 3: 確認・Stripe 決済へ
 */

"use client";

import { useState } from "react";
import ProgressBar from "@/components/ProgressBar";
import type { SiteFormData } from "@/lib/gemini";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

const COLOR_THEMES: Array<{
  value: SiteFormData["colorTheme"];
  label: string;
  description: string;
  preview: { bg: string; accent: string; text: string };
}> = [
  {
    value: "minimal",
    label: "ミニマル",
    description: "白を基調とした清潔感のあるシンプルなデザイン",
    preview: { bg: "#ffffff", accent: "#4f46e5", text: "#374151" },
  },
  {
    value: "business",
    label: "ビジネス",
    description: "紺を基調とした信頼感のあるプロフェッショナルなデザイン",
    preview: { bg: "#f8fafc", accent: "#2563eb", text: "#1e293b" },
  },
  {
    value: "casual",
    label: "カジュアル",
    description: "温かみのある色使いで親しみやすいデザイン",
    preview: { bg: "#fffbf7", accent: "#7c3aed", text: "#44403c" },
  },
];

const TOTAL_STEPS = 3;

const INITIAL_FORM_DATA: SiteFormData = {
  siteName: "",
  catchphrase: "",
  description: "",
  contactInfo: "",
  colorTheme: "minimal",
  email: "",
  subdomain: "",
};

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

interface StepFormProps {
  onSubmit: (formData: SiteFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export default function StepForm({ onSubmit, isSubmitting = false }: StepFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<SiteFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Partial<Record<keyof SiteFormData, string>>>({});

  // --- フォームフィールド更新 ---
  function handleChange(
    field: keyof SiteFormData,
    value: string
  ): void {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // エラーをクリア
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // --- Step 1 バリデーション ---
  function validateStep1(): boolean {
    const newErrors: typeof errors = {};

    if (!formData.siteName.trim()) {
      newErrors.siteName = "サイト名を入力してください";
    } else if (formData.siteName.length > 100) {
      newErrors.siteName = "サイト名は100文字以内で入力してください";
    }

    if (!formData.catchphrase.trim()) {
      newErrors.catchphrase = "キャッチコピーを入力してください";
    } else if (formData.catchphrase.length > 200) {
      newErrors.catchphrase = "キャッチコピーは200文字以内で入力してください";
    }

    if (!formData.description.trim()) {
      newErrors.description = "本文・説明を入力してください";
    }

    if (!formData.contactInfo.trim()) {
      newErrors.contactInfo = "連絡先情報を入力してください";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // --- ステップ進む ---
  function handleNext(): void {
    if (currentStep === 1 && !validateStep1()) return;
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }

  // --- ステップ戻る ---
  function handleBack(): void {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  // --- 決済へ進む ---
  async function handleSubmit(): Promise<void> {
    await onSubmit(formData);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        {currentStep === 1 && (
          <Step1
            formData={formData}
            errors={errors}
            onChange={handleChange}
          />
        )}

        {currentStep === 2 && (
          <Step2
            selectedTheme={formData.colorTheme}
            onChange={(value) => handleChange("colorTheme", value)}
          />
        )}

        {currentStep === 3 && (
          <Step3 formData={formData} />
        )}

        {/* ナビゲーションボタン */}
        <div className="mt-8 flex gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1 py-3 px-6 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              戻る
            </button>
          )}

          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              次へ進む
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  処理中...
                </span>
              ) : (
                "5,000円で決済してサイトを作成"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: 基本情報入力
// ---------------------------------------------------------------------------

interface Step1Props {
  formData: SiteFormData;
  errors: Partial<Record<keyof SiteFormData, string>>;
  onChange: (field: keyof SiteFormData, value: string) => void;
}

function Step1({ formData, errors, onChange }: Step1Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">サイト情報を入力</h2>
      <p className="text-sm text-gray-500 mb-6">
        ホームページに掲載する内容を入力してください
      </p>

      <div className="space-y-5">
        {/* サイト名 */}
        <div>
          <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">
            サイト名・屋号 <span className="text-red-500">*</span>
          </label>
          <input
            id="siteName"
            type="text"
            value={formData.siteName}
            onChange={(e) => onChange("siteName", e.target.value)}
            placeholder="例: 山田太郎 整体院"
            maxLength={100}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
              ${errors.siteName ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-500"}`}
          />
          {errors.siteName && (
            <p className="mt-1 text-xs text-red-500">{errors.siteName}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">{formData.siteName.length}/100</p>
        </div>

        {/* キャッチコピー */}
        <div>
          <label htmlFor="catchphrase" className="block text-sm font-medium text-gray-700 mb-1">
            キャッチコピー <span className="text-red-500">*</span>
          </label>
          <input
            id="catchphrase"
            type="text"
            value={formData.catchphrase}
            onChange={(e) => onChange("catchphrase", e.target.value)}
            placeholder="例: 10年以上の実績。あなたのつらい痛みを根本から改善します"
            maxLength={200}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
              ${errors.catchphrase ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-500"}`}
          />
          {errors.catchphrase && (
            <p className="mt-1 text-xs text-red-500">{errors.catchphrase}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">{formData.catchphrase.length}/200</p>
        </div>

        {/* 本文・説明 */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            サービス内容・自己紹介 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="例: 当院は2010年開業。腰痛・肩こりを専門とした整体院です。施術は完全予約制で、1回60分のていねいなカウンセリングと施術を行います..."
            rows={5}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none
              ${errors.description ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-500"}`}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-500">{errors.description}</p>
          )}
        </div>

        {/* 連絡先 */}
        <div>
          <label htmlFor="contactInfo" className="block text-sm font-medium text-gray-700 mb-1">
            連絡先・アクセス情報 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="contactInfo"
            value={formData.contactInfo}
            onChange={(e) => onChange("contactInfo", e.target.value)}
            placeholder="例: メール: info@example.com&#10;電話: 03-1234-5678（10〜18時）&#10;住所: 東京都渋谷区〇〇1-2-3&#10;Instagram: @example"
            rows={4}
            className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none
              ${errors.contactInfo ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-500"}`}
          />
          {errors.contactInfo && (
            <p className="mt-1 text-xs text-red-500">{errors.contactInfo}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: カラーテーマ選択
// ---------------------------------------------------------------------------

interface Step2Props {
  selectedTheme: SiteFormData["colorTheme"];
  onChange: (value: SiteFormData["colorTheme"]) => void;
}

function Step2({ selectedTheme, onChange }: Step2Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">デザインテーマを選択</h2>
      <p className="text-sm text-gray-500 mb-6">
        ホームページのデザイン方向性を選んでください
      </p>

      <div className="space-y-3">
        {COLOR_THEMES.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => onChange(theme.value)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all
              ${
                selectedTheme === theme.value
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-100 hover:border-gray-300 bg-white"
              }`}
          >
            <div className="flex items-center gap-4">
              {/* カラープレビュー */}
              <div
                className="w-16 h-12 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100"
                style={{ background: theme.preview.bg }}
              >
                <div
                  className="h-4 w-full"
                  style={{ background: theme.preview.accent }}
                />
                <div className="p-1.5">
                  <div
                    className="h-1.5 w-8 rounded-full mb-1"
                    style={{ background: theme.preview.text, opacity: 0.6 }}
                  />
                  <div
                    className="h-1 w-12 rounded-full"
                    style={{ background: theme.preview.text, opacity: 0.3 }}
                  />
                </div>
              </div>

              {/* テーマ情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{theme.label}</span>
                  {selectedTheme === theme.value && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                      選択中
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{theme.description}</p>
              </div>

              {/* ラジオインジケーター */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all
                  ${
                    selectedTheme === theme.value
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-gray-300"
                  }`}
              >
                {selectedTheme === theme.value && (
                  <div className="w-full h-full rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: 確認画面
// ---------------------------------------------------------------------------

interface Step3Props {
  formData: SiteFormData;
}

function Step3({ formData }: Step3Props) {
  const selectedTheme = COLOR_THEMES.find((t) => t.value === formData.colorTheme);

  const reviewItems: Array<{ label: string; value: string }> = [
    { label: "サイト名・屋号", value: formData.siteName },
    { label: "キャッチコピー", value: formData.catchphrase },
    { label: "サービス内容", value: formData.description },
    { label: "連絡先情報", value: formData.contactInfo },
    { label: "デザインテーマ", value: selectedTheme?.label ?? formData.colorTheme },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">入力内容の確認</h2>
      <p className="text-sm text-gray-500 mb-6">
        以下の内容でホームページを作成します。決済後、AIが自動生成を行います。
      </p>

      <div className="space-y-4">
        {reviewItems.map((item) => (
          <div key={item.label} className="border-b border-gray-100 pb-4 last:border-0">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {item.label}
            </dt>
            <dd className="text-sm text-gray-800 whitespace-pre-wrap">{item.value}</dd>
          </div>
        ))}
      </div>

      {/* 料金表示 */}
      <div className="mt-6 bg-indigo-50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-indigo-900">ホームページ作成料金</span>
          <span className="text-2xl font-bold text-indigo-700">¥5,000</span>
        </div>
        <p className="mt-1 text-xs text-indigo-600">
          買い切り / 無料修正2回付き / クレジットカード決済
        </p>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        決済完了後、AIがホームページを自動生成します（通常1〜3分）。
        完成したURLとともに修正用URLをメールでお送りします。
      </p>
    </div>
  );
}
