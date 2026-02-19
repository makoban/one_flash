/**
 * /complete ページ
 *
 * Stripe 決済完了後のサンクスページ。
 * session_id クエリパラメータから決済情報を取得して表示する。
 *
 * 注意: サイト生成は Webhook 処理中のため、このページ表示時点ではまだ
 *       生成中の場合がある。メール送信後に確認URLを案内する。
 */

import { Suspense } from "react";

function CompleteContent() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        {/* 成功アイコン */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
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
          ただいまAIがあなたのホームページを作成しています。
          完成したURLをメールでお送りしますので、しばらくお待ちください。
        </p>

        {/* 所要時間の案内 */}
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
            <span className="text-sm font-medium text-indigo-700">生成中...</span>
          </div>
          <p className="text-xs text-indigo-600">通常1〜3分で完成します</p>
        </div>

        {/* 次のステップ */}
        <div className="text-left space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">次のステップ</h2>
          {[
            "登録メールアドレスに完成通知が届きます",
            "メール内のURLからサイトを確認できます",
            "修正が必要な場合は修正用URLからご依頼ください（無料2回）",
          ].map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <span className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {index + 1}
              </span>
              <span className="text-sm text-gray-600">{step}</span>
            </div>
          ))}
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

export default function CompletePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <CompleteContent />
    </Suspense>
  );
}
