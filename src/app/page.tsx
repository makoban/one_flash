/**
 * / ページ (LP - ランディングページ)
 *
 * OnePage-Flash のサービス紹介LP。
 * 「テキストを打ち込むだけ。10分でホームページが完成する」
 */

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ナビゲーション */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-bold text-lg text-gray-900">OnePage-Flash</span>
          <div className="flex items-center gap-3">
            <Link
              href="/edit"
              className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
            >
              サイト修正
            </Link>
            <Link
              href="/create"
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 transition-colors"
            >
              今すぐ作成
            </Link>
          </div>
        </div>
      </nav>

      {/* ヒーローセクション */}
      <section className="py-20 px-4 text-center bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block px-4 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full mb-6 uppercase tracking-wide">
            AI自動生成 ホームページ作成サービス
          </span>

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
            テキストを打ち込むだけ。
            <br />
            <span className="text-indigo-600">10分で</span>ホームページが完成。
          </h1>

          <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            個人事業主・フリーランス・店舗オーナー向け。
            AIが美しいホームページを自動生成します。
            面倒なコーディングは一切不要。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/create"
              className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all hover:shadow-lg hover:-translate-y-0.5 text-lg"
            >
              無料でサイトを作ってみる
            </Link>
            <Link
              href="/edit"
              className="px-8 py-4 border border-gray-200 text-gray-700 font-medium rounded-2xl hover:bg-gray-50 transition-colors text-lg"
            >
              既存サイトを修正する
            </Link>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            初期費用 1,980円 + 月額 380円 / いつでも解約可
          </p>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            なぜ OnePage-Flash が選ばれるのか
          </h2>
          <p className="text-center text-gray-500 mb-12">
            テキスト入力から決済まで、すべてがシンプル
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                icon: "⚡",
                title: "10分で完成",
                description:
                  "質問に答えるだけ。AIが自動でプロ品質のホームページを生成します。決済前にプレビューで確認できます。",
              },
              {
                icon: "🎨",
                title: "デザイン3択",
                description:
                  "ミニマル・ビジネス・カジュアルの3テーマから選ぶだけ。あとはAIにおまかせ。",
              },
              {
                icon: "✏️",
                title: "月2回の修正",
                description:
                  "気に入らない部分は修正指示を送るだけ。AIが即座に反映します。月額プランに含まれています。",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-indigo-50 transition-colors"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ステップセクション */}
      <section className="py-20 px-4 bg-indigo-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            たった3ステップで完成
          </h2>

          <div className="space-y-6">
            {[
              {
                step: "01",
                title: "質問に答える",
                description:
                  "6つの質問に答えるだけ。サイト名・キャッチコピー・説明・連絡先をテキストで入力し、カラーテーマを選びます。",
              },
              {
                step: "02",
                title: "AIが即座に生成",
                description:
                  "AIがあなたのホームページを自動生成。スクリーンショットで仕上がりを確認できます。気に入らなければ10回まで再生成OK。",
              },
              {
                step: "03",
                title: "決済して公開",
                description:
                  "プレビューに納得したら決済（初期1,980円+月額380円）。決済後すぐにサイトが公開されます。",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-6 items-start">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ターゲットセクション */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            こんな方におすすめ
          </h2>
          <p className="text-gray-500 mb-10">
            ホームページを持ちたいけど、難しそう・高そうと思っている方へ
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: "💆", label: "個人事業主" },
              { icon: "💻", label: "フリーランス" },
              { icon: "🏪", label: "店舗オーナー" },
              { icon: "🎪", label: "イベント主催者" },
            ].map((item) => (
              <div
                key={item.label}
                className="p-4 bg-gray-50 rounded-2xl flex flex-col items-center gap-2"
              >
                <span className="text-3xl">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 料金セクション */}
      <section className="py-20 px-4 bg-gray-900">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-2">シンプルな料金</h2>
          <p className="text-gray-400 mb-10">わかりやすい1プランのみ。</p>

          <div className="bg-white rounded-2xl p-8">
            <div className="mb-4">
              <div className="text-5xl font-bold text-gray-900">
                ¥1,980
                <span className="text-xl font-normal text-gray-500 ml-2">初期費用</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-indigo-600">
                + ¥380<span className="text-base font-normal text-gray-500">/月</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-6">税込 / いつでも解約可</p>

            <ul className="space-y-3 text-sm text-gray-700 mb-8 text-left">
              {[
                "AIによるホームページ自動生成",
                "決済前にプレビューで確認できる",
                "独自サブドメインでの即時公開",
                "月2回の修正込み",
                "解約後も再開すれば即復旧",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
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
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/create"
              className="block w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-center"
            >
              無料でサイトを作ってみる
            </Link>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-8 px-4 bg-gray-900 border-t border-gray-800">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-bold text-white">OnePage-Flash</span>
          <p className="text-xs text-gray-500">
            © 2026 OnePage-Flash. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
