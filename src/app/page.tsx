/**
 * / ページ (LP - ランディングページ)
 *
 * OnePage-Flash のサービス紹介LP。
 * ダークテーマ・プレミアムデザイン。
 */

import Link from "next/link";
import Image from "next/image";

const GALLERY_ITEMS = [
  { id: 1, label: "税理士事務所", time: "8分", src: "/samples/pc-1.png" },
  { id: 2, label: "美容室", time: "11分", src: "/samples/pc-2.png" },
  { id: 3, label: "整体院", time: "7分", src: "/samples/pc-3.png" },
  { id: 4, label: "カフェ", time: "9分", src: "/samples/pc-4.png" },
  { id: 5, label: "ヨガスタジオ", time: "6分", src: "/samples/pc-5.png" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0F0F1A] text-slate-100">
      {/* ナビゲーション */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#0F0F1A]/80 border-b border-[#2D2D44]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="font-black text-lg tracking-tight">
            OnePage<span className="text-amber-400">-Flash</span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/edit"
              className="px-4 py-2 text-slate-400 text-sm font-medium hover:text-slate-200 transition-colors"
            >
              サイト修正
            </Link>
            <Link
              href="/create"
              className="px-5 py-2.5 bg-amber-500 text-gray-900 text-sm font-bold rounded-lg hover:bg-amber-400 transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
            >
              今すぐ作成
            </Link>
          </div>
        </div>
      </nav>

      {/* ヒーローセクション */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* 背景グラデーション */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-violet-900/20" />
        {/* グリッドパターン */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <p className="inline-block px-4 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full mb-8 tracking-wider">
            AI POWERED HP BUILDER
          </p>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.1] mb-6">
            ホームページ、
            <br />
            まだ
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500">
              「後回し」
            </span>
            にしてますか？
          </h1>

          <p className="text-xl sm:text-2xl font-bold text-amber-400 mb-4">
            今日、1,980円で終わらせてください。
          </p>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto mb-10">
            テキストを入力するだけ。AIが10分でプロ品質のホームページを生成します。
            <br className="hidden sm:block" />
            コーディング不要。デザイン知識不要。月380円で、ずっと公開し続けられます。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/create"
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg transition-all duration-300 hover:scale-105 shadow-[0_0_30px_rgba(245,158,11,0.35)] hover:shadow-[0_0_50px_rgba(245,158,11,0.55)]"
            >
              無料でプレビューを見る
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link
              href="/edit"
              className="inline-flex items-center justify-center gap-2 border border-slate-600 hover:border-amber-500/50 text-slate-300 hover:text-amber-400 font-medium px-8 py-4 rounded-xl text-lg transition-all duration-300"
            >
              既存サイトを修正する
            </Link>
          </div>

          {/* 実績バッジ */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-14 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              平均制作時間 <span className="text-slate-300 font-semibold">8.5分</span>
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              稼働中サイト <span className="text-slate-300 font-semibold">24/7</span>
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              SSL証明書 <span className="text-slate-300 font-semibold">無料付与</span>
            </span>
          </div>
        </div>
      </section>

      {/* お悩みセクション */}
      <section className="bg-[#1A1A2E] py-20 sm:py-28 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            こんな<span className="text-amber-400">お悩み</span>、ありませんか？
          </h2>
          <p className="text-center text-slate-400 mb-14">
            ホームページを持ちたいけど、踏み出せない理由
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", text: "制作会社に見積もりを取ったら10万円以上と言われた" },
              { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", text: "忙しすぎて、HPのことまで手が回らない" },
              { icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", text: "自分で作ろうとしたけど、デザインが上手くいかない" },
              { icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", text: "ネットで検索しても自分のお店が出てこない" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-start gap-4 p-5 bg-[#1E2035] rounded-2xl border border-[#2D2D44] hover:border-red-500/30 transition-colors duration-300"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <p className="text-slate-300 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>

          <p className="text-center mt-10 text-lg text-slate-300">
            <span className="text-amber-400 font-bold">OnePage-Flash</span> なら、すべて解決できます。
          </p>
        </div>
      </section>

      {/* ギャラリーセクション */}
      <section className="bg-[#0F0F1A] py-20 sm:py-28 overflow-hidden px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            こんなホームページが
            <span className="text-amber-400">10分</span>で完成します
          </h2>
          <p className="text-center text-slate-400 mb-14">
            実際にAIが生成したサイトのスクリーンショット
          </p>

          <div className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-700 -mx-4 px-4">
            {GALLERY_ITEMS.map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 w-72 sm:w-80 snap-start rounded-2xl overflow-hidden border border-[#2D2D44] hover:border-amber-500/40 transition-all duration-300 hover:scale-[1.02] bg-[#1E2035] shadow-xl"
              >
                <div className="h-48 sm:h-56 overflow-hidden bg-[#1E2035]">
                  <Image
                    src={item.src}
                    alt={`${item.label}のホームページ`}
                    width={320}
                    height={224}
                    className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-slate-200 font-semibold text-sm">{item.label}</span>
                  <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    {item.time}で完成
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ステップセクション */}
      <section className="bg-[#1A1A2E] py-20 sm:py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
            たった<span className="text-amber-400">3ステップ</span>で完成
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
                title: "質問に答える",
                description: "6つの質問にテキストで回答。サイト名、キャッチコピー、説明文、連絡先を入力するだけ。",
              },
              {
                step: "2",
                icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
                title: "AIが即座に生成",
                description: "AIがプロ品質のホームページを自動生成。スクリーンショットでプレビュー確認。気に入らなければ再生成OK。",
              },
              {
                step: "3",
                icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                title: "決済して即公開",
                description: "プレビューに納得したら決済。あなた専用のURLで即座にサイトが公開されます。",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative flex flex-col items-center text-center p-8 bg-[#1E2035] rounded-2xl border border-[#2D2D44] hover:border-indigo-500/40 transition-colors duration-300"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center">
                  {item.step}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-5 mt-2">
                  <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 料金セクション */}
      <section className="bg-[#0F0F1A] py-20 sm:py-28 px-4">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            シンプルな<span className="text-amber-400">料金</span>
          </h2>
          <p className="text-slate-400 mb-12">わかりやすい1プランのみ。追加費用なし。</p>

          <div className="bg-gradient-to-b from-[#1E2035] to-[#1A1A2E] rounded-3xl border border-indigo-500/30 p-8 sm:p-10 shadow-[0_0_60px_rgba(99,102,241,0.1)]">
            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-medium mb-6">
              業界最安クラス
            </span>

            <div className="mb-2">
              <span className="text-5xl sm:text-6xl font-black">¥1,980</span>
              <span className="text-lg text-slate-400 ml-2">初期費用</span>
            </div>
            <div className="mb-6">
              <span className="text-2xl font-bold text-slate-300">+ ¥380</span>
              <span className="text-slate-400">/月</span>
            </div>
            <p className="text-sm text-slate-500 mb-8">税込 / いつでも解約可 / 解約後も再開OK</p>

            <ul className="space-y-3 text-sm text-slate-300 mb-8 text-left">
              {[
                "AIによるプロ品質HP自動生成",
                "プレビューで確認してから決済",
                "あなた専用URLで即時公開",
                "月2回の修正込み",
                "SSL証明書・サーバー費用込み",
                "解約後も再開すれば即復旧",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/create"
              className="block w-full py-4 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold rounded-xl text-lg transition-all duration-300 shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] text-center"
            >
              無料でプレビューを見る
            </Link>
          </div>
        </div>
      </section>

      {/* 最終CTA */}
      <section className="relative py-24 sm:py-32 overflow-hidden px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-[#0F0F1A] to-violet-900/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            今日、ホームページを手に入れよう
          </h2>
          <p className="text-slate-400 mb-10 text-lg">
            あなたのお店・サービスを、もっと多くの人に届けませんか？
          </p>

          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-10 py-5 rounded-xl text-xl transition-all duration-300 hover:scale-105 shadow-[0_0_40px_rgba(245,158,11,0.4)] hover:shadow-[0_0_60px_rgba(245,158,11,0.6)]"
          >
            無料でサイトを作ってみる
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>

          <p className="text-slate-600 text-sm mt-4">
            クレジットカード不要でプレビューが確認できます
          </p>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-8 px-4 border-t border-[#2D2D44]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-bold text-slate-400">
            OnePage<span className="text-amber-400/70">-Flash</span>
          </span>
          <div className="text-xs text-slate-600 text-center sm:text-right">
            <p>&copy; 2026 OnePage-Flash. All rights reserved.</p>
            <p className="mt-1">v0.1.0-prototype</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
