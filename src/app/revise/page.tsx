/**
 * /revise ページ
 *
 * 修正フォーム。メールで送られた修正用URL（トークン付き）からアクセスする。
 * AI指示（フリーワード）をメインUIとし、6項目の直接編集は折りたたみで分離。
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
    placeholder: "例: もっとシンプルに / カラフルに / ビジネス寄りに",
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

  const [freeInstruction, setFreeInstruction] = useState("");
  const [fields, setFields] = useState<RevisionFields>(EMPTY_FIELDS);
  const [fieldsOpen, setFieldsOpen] = useState(false);
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

    // AI指示を最優先
    if (freeInstruction.trim()) {
      parts.push(freeInstruction.trim());
    }

    // 6項目の変更があれば追記
    for (const config of FIELD_CONFIG) {
      const value = fields[config.key].trim();
      if (value) {
        parts.push(`【${config.label}の変更】${value}`);
      }
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
      setError("修正内容を入力してください");
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
      setFreeInstruction("");
      setFields(EMPTY_FIELDS);
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
            AIに修正したい内容を伝えてください
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
            {/* メインエリア: AI指示 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">AIに修正を指示</h2>
                  <p className="text-xs text-gray-400">デザイン・テキスト・レイアウト、何でも自由に伝えてください</p>
                </div>
              </div>

              <textarea
                value={freeInstruction}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_INSTRUCTION_LENGTH) {
                    setFreeInstruction(e.target.value);
                  }
                }}
                placeholder={"例:\n・全体的にもっとシンプルにしてほしい\n・キャッチコピーをもっと目立たせて\n・連絡先セクションを大きくして\n・背景色をもう少し明るくして\n・カラフルな感じにして"}
                rows={6}
                maxLength={MAX_INSTRUCTION_LENGTH}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 resize-none placeholder:text-gray-400"
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

            {/* 折りたたみ: 項目ごとの直接編集 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
              <button
                type="button"
                onClick={() => setFieldsOpen(!fieldsOpen)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">項目ごとに直接編集</span>
                    <p className="text-xs text-gray-400">屋号・キャッチコピー・連絡先などを個別に変更</p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${fieldsOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {fieldsOpen && (
                <div className="px-5 pb-5 space-y-5 border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-400">
                    変更したい項目だけ入力。空欄の項目は変更されません。
                  </p>
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
              )}
            </div>

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={isSubmitting || !hasAnyInput()}
              className="w-full py-3.5 px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
                無料修正は月2回まで。3回目以降は500円/回となります。
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
