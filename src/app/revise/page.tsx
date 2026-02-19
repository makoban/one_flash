/**
 * /revise ページ
 *
 * 修正フォーム。メールで送られた修正用URL（トークン付き）からアクセスする。
 * 6つの項目別編集フィールドとフリーワード指示欄を分離して表示。
 *
 * URL形式: /revise?token=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const MAX_INSTRUCTION_LENGTH = 500;

/** 修正対象の6項目 */
interface RevisionFields {
  siteName: string;
  catchphrase: string;
  description: string;
  contactInfo: string;
  colorTheme: string;
  email: string;
}

const EMPTY_FIELDS: RevisionFields = {
  siteName: "",
  catchphrase: "",
  description: "",
  contactInfo: "",
  colorTheme: "",
  email: "",
};

/** 項目ラベル定義 */
const FIELD_CONFIG: Array<{
  key: keyof RevisionFields;
  label: string;
  placeholder: string;
  type: "input" | "textarea";
}> = [
  {
    key: "siteName",
    label: "屋号・事業名",
    placeholder: "変更したい屋号・事業名を入力（変更しない場合は空欄）",
    type: "input",
  },
  {
    key: "catchphrase",
    label: "キャッチコピー",
    placeholder: "変更したいキャッチコピーを入力",
    type: "input",
  },
  {
    key: "description",
    label: "説明・本文",
    placeholder: "変更したい説明文を入力",
    type: "textarea",
  },
  {
    key: "contactInfo",
    label: "連絡先・問い合わせ先",
    placeholder: "変更したい連絡先を入力",
    type: "textarea",
  },
  {
    key: "colorTheme",
    label: "サイトの雰囲気",
    placeholder: "例: もっとシンプルに / ビジネス寄りに / 温かみのある感じに",
    type: "input",
  },
  {
    key: "email",
    label: "メールアドレス",
    placeholder: "変更したいメールアドレスを入力",
    type: "input",
  },
];

function ReviseContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [fields, setFields] = useState<RevisionFields>(EMPTY_FIELDS);
  const [freeInstruction, setFreeInstruction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    publicUrl: string;
    freeRevisionsRemaining: number;
  } | null>(null);

  // トークンがない場合のガード
  useEffect(() => {
    if (!token) {
      setError("修正用URLが無効です。メールに記載されたURLからアクセスしてください。");
    }
  }, [token]);

  /** 6項目の変更内容 + フリーワードをまとめて1つの指示文にする */
  function buildInstruction(): string {
    const parts: string[] = [];

    for (const config of FIELD_CONFIG) {
      const value = fields[config.key].trim();
      if (value) {
        parts.push(`【${config.label}】${value}`);
      }
    }

    if (freeInstruction.trim()) {
      parts.push(`【その他の修正指示】${freeInstruction.trim()}`);
    }

    return parts.join("\n");
  }

  /** 入力があるかどうか */
  function hasAnyInput(): boolean {
    const hasFieldInput = Object.values(fields).some((v) => v.trim().length > 0);
    return hasFieldInput || freeInstruction.trim().length > 0;
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!token) return;

    const instruction = buildInstruction();
    if (!instruction) {
      setError("修正内容を1つ以上入力してください");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, instruction }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        publicUrl?: string;
        freeRevisionsRemaining?: number;
        requiresPayment?: boolean;
        message?: string;
        error?: string;
      };

      if (response.status === 402 && data.requiresPayment) {
        setError(data.message ?? "有料修正が必要です（500円）");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "修正に失敗しました");
      }

      setSuccess({
        publicUrl: data.publicUrl ?? "",
        freeRevisionsRemaining: data.freeRevisionsRemaining ?? 0,
      });
      setFields(EMPTY_FIELDS);
      setFreeInstruction("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "エラーが発生しました。もう一度お試しください。";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">サイトの修正</h1>
          <p className="mt-2 text-sm text-gray-500">
            修正したい項目だけ入力してください。空欄の項目は変更されません。
          </p>
        </div>

        {/* 成功メッセージ */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <h2 className="text-sm font-semibold text-green-800 mb-2">
              修正が完了しました
            </h2>
            <p className="text-xs text-green-700 mb-3">
              更新内容がサイトに反映されました。
              残り無料修正: {success.freeRevisionsRemaining}回
            </p>
            <a
              href={success.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-medium text-green-700 underline hover:text-green-900"
            >
              更新されたサイトを確認する
            </a>
          </div>
        )}

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 修正フォーム */}
        {token && (
          <form onSubmit={handleSubmit}>
            {/* セクション1: 6項目の個別編集 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0">
                  1
                </div>
                <h2 className="text-base font-bold text-gray-900">項目ごとの修正</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6 ml-8">
                変更したい項目だけ入力。空欄は変更されません。
              </p>

              <div className="space-y-5">
                {FIELD_CONFIG.map((config) => (
                  <div key={config.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {config.label}
                    </label>
                    {config.type === "textarea" ? (
                      <textarea
                        value={fields[config.key]}
                        onChange={(e) =>
                          setFields((prev) => ({
                            ...prev,
                            [config.key]: e.target.value,
                          }))
                        }
                        placeholder={config.placeholder}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 resize-none placeholder:text-gray-400"
                        disabled={isSubmitting}
                      />
                    ) : (
                      <input
                        type="text"
                        value={fields[config.key]}
                        onChange={(e) =>
                          setFields((prev) => ({
                            ...prev,
                            [config.key]: e.target.value,
                          }))
                        }
                        placeholder={config.placeholder}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 placeholder:text-gray-400"
                        disabled={isSubmitting}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* セクション2: フリーワード指示 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0">
                  2
                </div>
                <h2 className="text-base font-bold text-gray-900">その他の修正指示</h2>
              </div>
              <p className="text-xs text-gray-400 mb-4 ml-8">
                デザインの変更、レイアウトの調整など自由に記入できます
              </p>

              <textarea
                value={freeInstruction}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_INSTRUCTION_LENGTH) {
                    setFreeInstruction(e.target.value);
                  }
                }}
                placeholder={"例:\n・全体的にもっとシンプルにしてほしい\n・キャッチコピーをもっと目立たせて\n・連絡先セクションを大きくして\n・背景色をもう少し明るくして"}
                rows={5}
                maxLength={MAX_INSTRUCTION_LENGTH}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 resize-none placeholder:text-gray-400"
                disabled={isSubmitting}
              />
              <div className="flex justify-between items-center mt-1.5">
                <p className="text-xs text-gray-400">
                  具体的に書くほど精度が上がります
                </p>
                <span
                  className={`text-xs ${
                    freeInstruction.length >= MAX_INSTRUCTION_LENGTH
                      ? "text-red-500"
                      : "text-gray-400"
                  }`}
                >
                  {freeInstruction.length}/{MAX_INSTRUCTION_LENGTH}
                </span>
              </div>
            </div>

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={isSubmitting || !hasAnyInput()}
              className="w-full py-3 px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
                  AIが修正中...（1〜2分かかります）
                </span>
              ) : (
                "修正を依頼する"
              )}
            </button>

            {/* 注意事項 */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 leading-relaxed text-center">
                無料修正は2回まで。3回目以降は500円/回となります。
                修正はAIが自動で行うため、イメージと異なる場合があります。
                その場合は再度修正をご依頼ください。
              </p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export default function RevisePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ReviseContent />
    </Suspense>
  );
}
