/**
 * / ページ (LP - ランディングページ)
 *
 * OnePage-Flash のサービス紹介LP。
 * ダークテーマ・プレミアムデザイン。
 * 作品例はスクリーンショット画像で表示し、リンクで実物を見せる。
 */

import Link from "next/link";
import Image from "next/image";
import UtmCapture from "@/components/UtmCapture";

const WORKER_BASE = "https://onepage-flash-router.ai-fudosan.workers.dev/s";

const SAMPLES = [
  { slug: "sample-tax", label: "税理士事務所", time: "8分", img: "/samples/pc-1.png" },
  { slug: "sample-bloom", label: "美容室", time: "11分", img: "/samples/pc-2.png" },
  { slug: "sample-karada", label: "整体院", time: "7分", img: "/samples/pc-3.png" },
  { slug: "sample-komorebi", label: "カフェ", time: "9分", img: "/samples/pc-4.png" },
  { slug: "sample-shanti", label: "ヨガスタジオ", time: "6分", img: "/samples/pc-5.png" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0F0F1A] text-slate-100">
      <UtmCapture trackPageView />
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
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-16">
        {/* 背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-violet-900/20" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative z-10 text-center max-w-3xl mx-auto px-4">
          <p className="inline-block px-4 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full mb-8 tracking-wider">
            AI POWERED HP BUILDER
          </p>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.3] mb-6">
            いまどきホームページなんて
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500">
              「1,980円」
            </span>
            で作る時代。
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed mb-3">
            シンプル・最小機能で十分。
            <br />
            AIがあなたのホームページを10分で作ります。
          </p>

          <p className="text-sm text-slate-500 mb-10">
            初期費用 1,980円 + 月額 480円 / いつでも解約可
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
        </div>
      </section>

      {/* 作品例セクション — iframe で実サイト縮小表示 */}
      <section className="bg-[#1A1A2E] py-20 sm:py-28 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
            AIが作った<span className="text-amber-400">作品例</span>
          </h2>
          <p className="text-center text-slate-400 mb-14">
            すべて実際にAIが生成したホームページです。クリックで実物が見れます。
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SAMPLES.map((s) => (
              <a
                key={s.slug}
                href={`${WORKER_BASE}/${s.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-2xl overflow-hidden border border-[#2D2D44] hover:border-amber-500/50 transition-all duration-300 bg-[#1E2035]"
              >
                {/* スクリーンショット画像 */}
                <div className="relative w-full h-48 sm:h-56 overflow-hidden">
                  <Image
                    src={s.img}
                    alt={`${s.label}のホームページ`}
                    width={640}
                    height={360}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                {/* ラベル */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-slate-200 font-semibold text-sm">{s.label}</span>
                    <span className="ml-2 text-amber-400 text-xs font-medium">
                      {s.time}で完成
                    </span>
                  </div>
                  <span className="text-slate-500 group-hover:text-amber-400 text-xs transition-colors">
                    実物を見る →
                  </span>
                </div>
              </a>
            ))}

            {/* 最後のカード: CTA */}
            <Link
              href="/create"
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#2D2D44] hover:border-amber-500/50 transition-all duration-300 p-8 min-h-[320px]"
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <span className="text-amber-400 font-bold text-lg">あなたのサイトを作る</span>
              <span className="text-slate-500 text-sm mt-2">10分で完成します</span>
            </Link>
          </div>
        </div>
      </section>

      {/* お悩みセクション */}
      <section className="bg-[#0F0F1A] py-20 sm:py-28 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            こんな<span className="text-amber-400">お悩み</span>、ありませんか？
          </h2>
          <p className="text-center text-slate-400 mb-14">
            ホームページを持ちたいけど、踏み出せない理由
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", text: "制作会社に頼んだら\n10万円以上と言われた" },
              { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", text: "忙しすぎて\nHPのことまで手が回らない" },
              { icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", text: "自分で作ろうとしたけど\nデザインが上手くいかない" },
              { icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", text: "ネットで検索しても\n自分のお店が出てこない" },
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
                <p className="text-slate-300 leading-relaxed whitespace-pre-line">{item.text}</p>
              </div>
            ))}
          </div>

          <p className="text-center mt-10 text-lg text-slate-300">
            <span className="text-amber-400 font-bold">OnePage-Flash</span> なら、すべて解決。
          </p>
        </div>
      </section>

      {/* 聞かれる6つの質問セクション */}
      <section className="bg-[#0F0F1A] py-20 sm:py-28 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            聞かれるのは<span className="text-amber-400">6つ</span>だけ
          </h2>
          <p className="text-center text-slate-400 mb-14">
            この6つの質問に答えるだけで、AIがプロ品質のHPを自動生成します
          </p>

          <div className="space-y-4">
            {[
              {
                num: "Q1",
                question: "どんなお仕事をされていますか？屋号や事業名は？",
                example: "例: 山田太郎整体院",
                icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
              },
              {
                num: "Q2",
                question: "あなたのサービスの一番の強みを一言で表すと？",
                example: "例: 10年以上の実績。つらい痛みを根本から改善します",
                icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
              },
              {
                num: "Q3",
                question: "お客さんに一番伝えたいことは？（自由記述）",
                example: "例: 当院は2010年開業。腰痛・肩こりを専門とした...",
                icon: "M4 6h16M4 12h16M4 18h7",
              },
              {
                num: "Q4",
                question: "問い合わせの受付方法は？",
                example: "例: 電話 03-1234-5678 / メール info@example.com",
                icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
              },
              {
                num: "Q5",
                question: "サイトの雰囲気は？（3択から選ぶだけ）",
                example: "シンプル / カラフル / ビジネス",
                icon: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01",
              },
              {
                num: "Q6",
                question: "メールアドレスを教えてください",
                example: "完成URLと修正リンクをお届けします",
                icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
              },
            ].map((item) => (
              <div
                key={item.num}
                className="flex items-start gap-4 p-5 bg-[#1E2035] rounded-2xl border border-[#2D2D44] hover:border-indigo-500/30 transition-colors duration-300"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      {item.num}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">{item.question}</span>
                  </div>
                  <p className="text-xs text-slate-500">{item.example}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center mt-10 text-slate-400 text-sm">
            所要時間は<span className="text-amber-400 font-bold">約5〜10分</span>。スマホからでもOK。
          </p>
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
                desc: "6つの質問にテキストで回答。\nサイト名、キャッチコピー、\n説明文、連絡先を入力するだけ。",
              },
              {
                step: "2",
                icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
                title: "AIが即座に生成",
                desc: "AIがプロ品質のHPを自動生成。\nプレビューで確認。\n気に入らなければ再生成OK。",
              },
              {
                step: "3",
                icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                title: "決済して即公開",
                desc: "プレビューに納得したら決済。\nあなた専用のURLで\n即座にサイトが公開されます。",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative flex flex-col items-center text-center p-8 bg-[#1E2035] rounded-2xl border border-[#2D2D44]"
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
                <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{item.desc}</p>
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
              <span className="text-2xl font-bold text-slate-300">+ ¥480</span>
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
          <p className="text-slate-400 mb-10 text-lg leading-relaxed">
            あなたのお店・サービスを、
            <br className="sm:hidden" />
            もっと多くの人に届けませんか？
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
