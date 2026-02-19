/**
 * CardStepForm コンポーネント
 *
 * 6問のチャット風カードUIフォーム。
 * 1問ずつカード形式でフェードインアニメーションとともに表示する。
 *
 * 質問構成:
 *   Q1: 屋号・事業名 (siteName)
 *   Q2: キャッチコピー (catchphrase)
 *   Q3: 伝えたいこと (description)
 *   Q4: 問い合わせ先 (contactInfo)
 *   Q5: サイトの雰囲気 (colorTheme)
 *   Q6: サブドメイン + メールアドレス (subdomain / email)
 */

"use client";

import { useState, useEffect, useRef } from "react";
import type { SiteFormData } from "@/lib/gemini";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 6;

const COLOR_THEMES: Array<{
  value: SiteFormData["colorTheme"];
  label: string;
  description: string;
  colors: string[];
}> = [
  {
    value: "minimal",
    label: "ミニマル",
    description: "白を基調とした清潔感のあるシンプルなデザイン",
    colors: ["#ffffff", "#4f46e5", "#374151"],
  },
  {
    value: "business",
    label: "ビジネス",
    description: "紺を基調とした信頼感のあるプロフェッショナルなデザイン",
    colors: ["#f8fafc", "#2563eb", "#1e293b"],
  },
  {
    value: "casual",
    label: "カジュアル",
    description: "温かみのある色使いで親しみやすいデザイン",
    colors: ["#fffbf7", "#7c3aed", "#44403c"],
  },
];

/** サブドメインを自動生成する（ランダム8文字） */
function generateSubdomain(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `site-${result}`;
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface CardStepFormProps {
  onSubmit: (formData: SiteFormData) => Promise<void>;
  isSubmitting: boolean;
}

type FormErrors = Partial<Record<keyof SiteFormData, string>>;

// ---------------------------------------------------------------------------
// フォームの初期値
// ---------------------------------------------------------------------------

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
// メインコンポーネント
// ---------------------------------------------------------------------------

export default function CardStepForm({ onSubmit, isSubmitting }: CardStepFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<SiteFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  // アニメーション用: ステップ変更のたびにキーを更新してフェードインを再発火
  const [animationKey, setAnimationKey] = useState(0);

  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // ステップ変更時にフォーカスをリセット & アニメーション再発火
  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
    // 少し遅延させてDOMが更新された後にフォーカス
    const timer = setTimeout(() => {
      firstInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // --- フォームフィールド更新 ---
  function handleChange(field: keyof SiteFormData, value: string): void {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // --- バリデーション（ステップ別） ---
  function validateCurrentStep(): boolean {
    const newErrors: FormErrors = {};

    switch (currentStep) {
      case 1:
        if (!formData.siteName.trim()) {
          newErrors.siteName = "屋号・事業名を入力してください";
        } else if (formData.siteName.length > 100) {
          newErrors.siteName = "100文字以内で入力してください";
        }
        break;

      case 2:
        if (!formData.catchphrase.trim()) {
          newErrors.catchphrase = "キャッチコピーを入力してください";
        } else if (formData.catchphrase.length > 200) {
          newErrors.catchphrase = "200文字以内で入力してください";
        }
        break;

      case 3:
        if (!formData.description.trim()) {
          newErrors.description = "内容を入力してください";
        }
        break;

      case 4:
        if (!formData.contactInfo.trim()) {
          newErrors.contactInfo = "連絡先を入力してください";
        }
        break;

      case 5:
        // colorTheme はデフォルト値があるため、バリデーション不要
        break;

      case 6:
        if (!formData.email.trim()) {
          newErrors.email = "メールアドレスを入力してください";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = "有効なメールアドレスを入力してください";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext(): void {
    if (!validateCurrentStep()) return;
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }

  function handleBack(): void {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }

  async function handleSubmit(): Promise<void> {
    if (!validateCurrentStep()) return;
    // サブドメインは自動生成
    const submitData = { ...formData, subdomain: generateSubdomain() };
    await onSubmit(submitData);
  }

  // Enterキーで次へ進む（textareaは除く）
  function handleKeyDown(e: React.KeyboardEvent, isTextarea = false): void {
    if (e.key === "Enter" && !isTextarea) {
      e.preventDefault();
      if (currentStep < TOTAL_STEPS) {
        handleNext();
      }
    }
  }

  const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* プログレスバーエリア */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-indigo-600">
            ステップ {currentStep}/{TOTAL_STEPS}
          </span>
          <span className="text-xs text-gray-400">{progressPercent}% 完了</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* カード本体 */}
      <div
        key={animationKey}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8"
        style={{
          animation: "fadeSlideIn 0.35s ease both",
        }}
      >
        {/* フェードインアニメーション定義（インラインで注入） */}
        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* 各ステップのコンテンツ */}
        {currentStep === 1 && (
          <StepSiteName
            value={formData.siteName}
            error={errors.siteName}
            onChange={(v) => handleChange("siteName", v)}
            onKeyDown={handleKeyDown}
            inputRef={(el) => { firstInputRef.current = el; }}
          />
        )}
        {currentStep === 2 && (
          <StepCatchphrase
            value={formData.catchphrase}
            error={errors.catchphrase}
            onChange={(v) => handleChange("catchphrase", v)}
            onKeyDown={handleKeyDown}
            inputRef={(el) => { firstInputRef.current = el; }}
          />
        )}
        {currentStep === 3 && (
          <StepDescription
            value={formData.description}
            error={errors.description}
            onChange={(v) => handleChange("description", v)}
            textareaRef={(el) => { firstInputRef.current = el; }}
          />
        )}
        {currentStep === 4 && (
          <StepContact
            value={formData.contactInfo}
            error={errors.contactInfo}
            onChange={(v) => handleChange("contactInfo", v)}
            textareaRef={(el) => { firstInputRef.current = el; }}
          />
        )}
        {currentStep === 5 && (
          <StepColorTheme
            value={formData.colorTheme}
            onChange={(v) => handleChange("colorTheme", v)}
          />
        )}
        {currentStep === 6 && (
          <StepEmail
            email={formData.email}
            emailError={errors.email}
            onEmailChange={(v) => handleChange("email", v)}
            onKeyDown={handleKeyDown}
            inputRef={(el) => { firstInputRef.current = el; }}
          />
        )}

        {/* ナビゲーションボタン */}
        <div className="mt-8 flex gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-5 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              戻る
            </button>
          )}

          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
            >
              次へ
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <SpinnerIcon />
                  生成中...
                </span>
              ) : (
                "サイトを生成する"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: 屋号・事業名
// ---------------------------------------------------------------------------

interface StepSiteNameProps {
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}

function StepSiteName({ value, error, onChange, onKeyDown, inputRef }: StepSiteNameProps) {
  return (
    <div>
      <QuestionLabel step={1} />
      <h2 className="text-lg font-bold text-gray-900 mt-1 mb-4 leading-snug">
        どんなお仕事をされていますか？<br />
        屋号や事業名があれば教えてください
      </h2>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="例: 山田太郎整体院"
        maxLength={100}
        className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          error ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-400"
        }`}
      />
      <div className="flex justify-between mt-1.5">
        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <span />
        )}
        <span className="text-xs text-gray-400 ml-auto">{value.length}/100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: キャッチコピー
// ---------------------------------------------------------------------------

interface StepCatchphraseProps {
  value: string;
  error?: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}

function StepCatchphrase({ value, error, onChange, onKeyDown, inputRef }: StepCatchphraseProps) {
  return (
    <div>
      <QuestionLabel step={2} />
      <h2 className="text-lg font-bold text-gray-900 mt-1 mb-4 leading-snug">
        あなたのサービスの一番の強みを<br />
        一言で表すと？
      </h2>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="例: 10年以上の実績。つらい痛みを根本から改善します"
        maxLength={200}
        className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          error ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-400"
        }`}
      />
      <div className="flex justify-between mt-1.5">
        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <span />
        )}
        <span className="text-xs text-gray-400 ml-auto">{value.length}/200</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: 伝えたいこと（自由記述）
// ---------------------------------------------------------------------------

interface StepDescriptionProps {
  value: string;
  error?: string;
  onChange: (v: string) => void;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
}

function StepDescription({ value, error, onChange, textareaRef }: StepDescriptionProps) {
  return (
    <div>
      <QuestionLabel step={3} />
      <h2 className="text-lg font-bold text-gray-900 mt-1 mb-4 leading-snug">
        お客さんに一番伝えたいことを<br />
        自由に書いてください（何でもOK）
      </h2>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="例: 当院は2010年開業。腰痛・肩こりを専門とした整体院です。施術は完全予約制で、1回60分のていねいなカウンセリングと施術を行います..."
        rows={5}
        className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${
          error ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-400"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <p className="mt-1.5 text-xs text-gray-400">
        多く書くほど、AIがより良いサイトを作れます
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: 連絡先・問い合わせ先
// ---------------------------------------------------------------------------

interface StepContactProps {
  value: string;
  error?: string;
  onChange: (v: string) => void;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
}

function StepContact({ value, error, onChange, textareaRef }: StepContactProps) {
  return (
    <div>
      <QuestionLabel step={4} />
      <h2 className="text-lg font-bold text-gray-900 mt-1 mb-4 leading-snug">
        お客さんからの問い合わせは<br />
        どこで受け付けますか？
      </h2>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`例: 電話: 03-1234-5678\nメール: info@example.com\n住所: 東京都渋谷区〇〇1-2-3\nInstagram: @example`}
        rows={4}
        className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none ${
          error ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-400"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <p className="mt-1.5 text-xs text-gray-400">
        電話・メール・SNS・住所など、載せたい情報を自由に記入してください
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: カラーテーマ選択
// ---------------------------------------------------------------------------

interface StepColorThemeProps {
  value: SiteFormData["colorTheme"];
  onChange: (v: SiteFormData["colorTheme"]) => void;
}

function StepColorTheme({ value, onChange }: StepColorThemeProps) {
  return (
    <div>
      <QuestionLabel step={5} />
      <h2 className="text-lg font-bold text-gray-900 mt-1 mb-5 leading-snug">
        サイトの雰囲気はどれが近いですか？
      </h2>
      <div className="space-y-3">
        {COLOR_THEMES.map((theme) => {
          const isSelected = value === theme.value;
          return (
            <button
              key={theme.value}
              type="button"
              onClick={() => onChange(theme.value)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-100 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-4">
                {/* カラーパレット（小さな丸） */}
                <div className="flex gap-1.5 flex-shrink-0">
                  {theme.colors.map((color, i) => (
                    <span
                      key={i}
                      className="w-5 h-5 rounded-full border border-gray-200 inline-block"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                {/* テーマ情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{theme.label}</span>
                    {isSelected && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                        選択中
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{theme.description}</p>
                </div>

                {/* ラジオインジケーター */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    isSelected ? "border-indigo-500 bg-indigo-500" : "border-gray-300"
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6: メールアドレス
// ---------------------------------------------------------------------------

interface StepEmailProps {
  email: string;
  emailError?: string;
  onEmailChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}

function StepEmail({
  email,
  emailError,
  onEmailChange,
  onKeyDown,
  inputRef,
}: StepEmailProps) {
  return (
    <div>
      <QuestionLabel step={6} />
      <h2 className="text-lg font-bold text-gray-900 mt-1 mb-5 leading-snug">
        最後に、メールアドレスを<br />
        教えてください
      </h2>

      <input
        ref={inputRef}
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="info@example.com"
        className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-900 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          emailError ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-indigo-400"
        }`}
      />
      {emailError ? (
        <p className="mt-1 text-xs text-red-500">{emailError}</p>
      ) : (
        <p className="mt-1.5 text-xs text-gray-400">
          完成したサイトのURLと修正用リンクをこちらにお届けします
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 共通: 質問番号ラベル
// ---------------------------------------------------------------------------

function QuestionLabel({ step }: { step: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full">
      <span className="w-4 h-4 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
        {step}
      </span>
      Q{step}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 共通: スピナーアイコン
// ---------------------------------------------------------------------------

function SpinnerIcon() {
  return (
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
  );
}
