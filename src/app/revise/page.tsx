/**
 * /revise ページ
 *
 * 修正フォーム。メールで送られた修正用URL（トークン付き）からアクセスする。
 *
 * URL形式: /revise?token=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const MAX_INSTRUCTION_LENGTH = 200;

function ReviseContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [instruction, setInstruction] = useState("");
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

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!token) return;
    if (!instruction.trim()) {
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
        // 有料修正が必要
        setError(data.message ?? "有料修正が必要です（500円）");
        // TODO: data.checkoutUrl があれば Stripe Checkout へリダイレクト
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "修正に失敗しました");
      }

      setSuccess({
        publicUrl: data.publicUrl ?? "",
        freeRevisionsRemaining: data.freeRevisionsRemaining ?? 0,
      });
      setInstruction("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "エラーが発生しました。もう一度お試しください。";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-lg w-full">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">サイトの修正</h1>
          <p className="mt-2 text-sm text-gray-500">
            修正したい内容を具体的に入力してください
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
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
              <div>
                <label
                  htmlFor="instruction"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  修正内容
                </label>
                <textarea
                  id="instruction"
                  value={instruction}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_INSTRUCTION_LENGTH) {
                      setInstruction(e.target.value);
                    }
                  }}
                  placeholder="例: キャッチコピーを「創業20年の安心と実績」に変更してください。また、背景色をもう少し明るくしてください。"
                  rows={5}
                  maxLength={MAX_INSTRUCTION_LENGTH}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  disabled={isSubmitting}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-400">
                    具体的に書くほど精度が上がります
                  </p>
                  <span
                    className={`text-xs ${
                      instruction.length >= MAX_INSTRUCTION_LENGTH
                        ? "text-red-500"
                        : "text-gray-400"
                    }`}
                  >
                    {instruction.length}/{MAX_INSTRUCTION_LENGTH}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !instruction.trim()}
                className="mt-6 w-full py-3 px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
            </form>
          )}

          {/* 注意事項 */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 leading-relaxed">
              無料修正は2回まで。3回目以降は500円/回となります。
              修正はAIが自動で行うため、イメージと異なる場合があります。
              その場合は再度修正をご依頼ください。
            </p>
          </div>
        </div>
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
