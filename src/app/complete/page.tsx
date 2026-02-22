/**
 * /complete ページ
 *
 * Stripe 決済完了後のサンクスページ。
 * session_id クエリパラメータからサイト公開状態をポーリングし、
 * 公開完了後にURLを表示する。
 */

"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConversionTracker from "@/components/ConversionTracker";

interface SiteStatus {
  status: "pending" | "complete" | "error";
  subdomain?: string;
  publicUrl?: string;
  workerUrl?: string;
  siteName?: string;
  message?: string;
  error?: string;
}

function CompleteContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const checkStatus = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/check-site-status?session_id=${sessionId}`);
      const data: SiteStatus = await res.json();
      setSiteStatus(data);
      return data.status;
    } catch {
      return "error";
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    // 初回チェック
    checkStatus();

    // 5秒ごとにポーリング（最大60回 = 5分）
    const interval = setInterval(async () => {
      setPollCount((prev) => prev + 1);
      const status = await checkStatus();
      if (status === "complete" || pollCount >= 60) {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId, checkStatus, pollCount]);

  const isComplete = siteStatus?.status === "complete" && siteStatus.publicUrl;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center px-4">
      <ConversionTracker />
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {/* 成功アイコン */}
        <div
          className={`w-16 h-16 ${isComplete ? "bg-green-100" : "bg-green-100"} rounded-full flex items-center justify-center mx-auto mb-6`}
        >
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          お支払いありがとうございます
        </h1>

        <p className="text-gray-600 mb-6">
          サブスクリプション登録が完了しました。
          {isComplete
            ? "ホームページが公開されました！"
            : "ただいまホームページを公開しています..."}
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left">
          <p className="text-xs text-gray-500 mb-1">お支払い内容</p>
          <p className="text-sm text-gray-700">
            初期制作費: <strong>3,980円（税込）</strong>
          </p>
          <p className="text-sm text-gray-700">
            月額利用料: <strong>480円/月（税込）</strong>（初月無料・以降自動更新）
          </p>
        </div>

        {/* 公開完了 or 生成中 */}
        {isComplete ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-bold text-green-700">
                公開完了！
              </span>
            </div>
            <a
              href={siteStatus.workerUrl ?? siteStatus.publicUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 px-4 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors mb-2"
            >
              あなたのサイトを見る
            </a>
            <p className="text-xs text-green-600 break-all">
              {siteStatus.workerUrl ?? siteStatus.publicUrl}
            </p>
          </div>
        ) : (
          <div className="bg-indigo-50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg
                className="w-4 h-4 text-indigo-500 animate-spin"
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
              <span className="text-sm font-medium text-indigo-700">
                公開処理中...
              </span>
            </div>
            <p className="text-xs text-indigo-600">
              通常1〜3分で完成します（自動で更新されます）
            </p>
          </div>
        )}

        {/* 次のステップ */}
        <div className="text-left space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">次のステップ</h2>
          {isComplete ? (
            <>
              <StepItem index={1} done>
                サイトが公開されました
              </StepItem>
              <StepItem index={2}>
                登録メールアドレスに完成通知が届きます
              </StepItem>
              <StepItem index={3}>
                修正が必要な場合はメール内の修正用URLからご依頼ください
              </StepItem>
            </>
          ) : (
            <>
              <StepItem index={1}>
                登録メールアドレスに完成通知が届きます
              </StepItem>
              <StepItem index={2}>
                メール内のURLからサイトを確認できます
              </StepItem>
              <StepItem index={3}>
                修正が必要な場合はメール内の修正用URLからご依頼ください
              </StepItem>
            </>
          )}
        </div>

        <a
          href="/"
          className="mt-8 inline-block text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          トップページに戻る
        </a>
      </div>
    </main>
  );
}

function StepItem({
  index,
  done,
  children,
}: {
  index: number;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
          done
            ? "bg-green-100 text-green-600"
            : "bg-indigo-100 text-indigo-600"
        }`}
      >
        {done ? (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          index
        )}
      </span>
      <span className={`text-sm ${done ? "text-green-700 font-medium" : "text-gray-600"}`}>
        {children}
      </span>
    </div>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <CompleteContent />
    </Suspense>
  );
}
