/**
 * / ページ (LP - ランディングページ)
 *
 * OnePage-Flash のサービス紹介LP。
 * ダークテーマ・プレミアムデザイン。
 * 作品例はスクリーンショット画像で表示し、リンクで実物を見せる。
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import UtmCapture from "@/components/UtmCapture";

/**
 * Google Ads コンバージョンイベントを発火する。
 * グローバルタグ（AW-17822680636）は layout.tsx で設置済み。
 * window.gtag は layout.tsx のインラインスクリプトで定義されるため
 * unknown キャストでアクセスする。
 */
function fireConversionEvent(): void {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gtagFn = (window as unknown as Record<string, unknown>)["gtag"] as ((...args: unknown[]) => void) | undefined;
  if (typeof gtagFn === "function") {
    gtagFn("event", "conversion", {
      send_to: "AW-17822680636/ObktCNO1nvwbELyMwrJC",
      value: 3980.0,
      currency: "JPY",
    });
  }
}

/**
 * CTA クリック時にコンバージョンを発火し、300ms 後に遷移する。
 * Next.js の Link では href="/create" の内部遷移を使いつつ、
 * gtag のタグ送信を確保するために setTimeout でわずかに遅延させる。
 */
function handleCtaClick(e: React.MouseEvent<HTMLAnchorElement>): void {
  e.preventDefault();
  const href = (e.currentTarget as HTMLAnchorElement).href;
  fireConversionEvent();
  setTimeout(() => {
    window.location.href = href;
  }, 300);
}

const WORKER_BASE = "https://onepage-flash-router.ai-fudosan.workers.dev/s";

const SAMPLES = [
  { slug: "sample-tax", label: "税理士事務所", time: "8分", img: "/samples/pc-1.png" },
  { slug: "sample-bloom", label: "美容室", time: "11分", img: "/samples/pc-2.png" },
  { slug: "sample-karada", label: "整体院", time: "7分", img: "/samples/pc-3.png" },
  { slug: "sample-komorebi", label: "カフェ", time: "9分", img: "/samples/pc-4.png" },
  { slug: "sample-shanti", label: "ヨガスタジオ", time: "6分", img: "/samples/pc-5.png" },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "OnePage-Flash",
  "applicationCategory": "WebApplication",
  "description": "テキストを打ち込むだけでAIが美しいホームページを自動生成するサービス。個人事業主・フリーランス・店舗オーナー向け。",
  "url": "https://oneflash.bantex.jp",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "3980",
    "priceCurrency": "JPY",
    "description": "初期制作3,980円（税込）+ 月額480円/月（税込・初月無料）",
  },
  "provider": {
    "@type": "Organization",
    "name": "株式会社バンテックス",
    "url": "https://bantex.jp/",
  },
  "featureList": [
    "AIによるホームページ自動生成",
    "テキスト入力のみで完成",
    "レスポンシブデザイン対応",
    "独自サブドメイン付与",
    "3つのデザインテーマ",
  ],
};

export default function HomePage() {
  // スクロール計測: 各セクションが30%以上表示されたタイミングでBeacon送信
  useEffect(() => {
    const sid = localStorage.getItem('_bx_sid') || crypto.randomUUID();
    localStorage.setItem('_bx_sid', sid);
    const dt = window.innerWidth < 768 ? 'mobile' : 'desktop';
    const ref = document.referrer || '';
    const sent: Record<string, boolean> = {};

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const secId = entry.target.getAttribute('data-section') || entry.target.id;
        if (!secId || sent[secId]) return;
        sent[secId] = true;
        const blob = new Blob([JSON.stringify({
          session_id: sid, service_key: 'onepage-flash',
          section_id: secId, device_type: dt, referrer: ref
        })], { type: 'application/json' });
        navigator.sendBeacon('https://bantex-ads-dashboard.onrender.com/api/track/scroll', blob);
      });
    }, { threshold: 0.3 });

    document.querySelectorAll('section[id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-[#0F0F1A] text-slate-100 overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <UtmCapture trackPageView />

      {/* LINE フローティングボタン */}
      <a
        href="https://lin.ee/5b8JT4C"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-1.5 bg-[#06C755] hover:bg-[#05b04c] text-white font-bold px-3 py-2 sm:px-4 sm:py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 text-[2.8vw] sm:text-sm"
      >
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
        LINEで相談
      </a>

      {/* ナビゲーション */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#0F0F1A]/80 border-b border-[#2D2D44]">
        <div className="max-w-6xl mx-auto px-2 sm:px-6 lg:px-8 h-12 sm:h-16 flex items-center justify-between whitespace-nowrap">
          <span className="font-black text-[3vw] sm:text-lg tracking-tight">
            OnePage<span className="text-amber-400">-Flash</span>
          </span>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Link
              href="/edit"
              className="px-2 py-1 sm:px-4 sm:py-2 text-slate-400 text-[2.6vw] sm:text-sm font-medium hover:text-slate-200 transition-colors"
            >
              サイト修正
            </Link>
            <Link
              href="/create"
              onClick={handleCtaClick}
              className="px-2.5 py-1.5 sm:px-5 sm:py-2.5 bg-amber-500 text-gray-900 text-[2.6vw] sm:text-sm font-bold rounded-md sm:rounded-lg hover:bg-amber-400 transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
            >
              今すぐ作成
            </Link>
          </div>
        </div>
      </nav>

      {/* ヒーローセクション */}
      <section id="hero" className="relative min-h-[80vh] sm:min-h-[90vh] flex items-center justify-center overflow-hidden pt-12 sm:pt-16">
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

        <div className="relative z-10 text-center max-w-3xl mx-auto px-2 sm:px-4">
          <p className="inline-block px-2 py-0.5 sm:px-4 sm:py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[2.2vw] sm:text-xs font-semibold rounded-full mb-5 sm:mb-8 tracking-wider whitespace-nowrap">
            質問6個でHP完成 · 最短10分 · AI自動生成
          </p>

          <h1 className="text-[5vw] sm:text-3xl md:text-4xl lg:text-5xl font-black leading-[1.5] sm:leading-[1.3] mb-3 sm:mb-6 whitespace-nowrap">
            HPがない？ 6つの質問に答えて。
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500">
              3,980円
            </span>
            でURL発行まで完了。
          </h1>

          <p className="text-[3.2vw] sm:text-lg md:text-xl text-slate-300 leading-relaxed mb-2 sm:mb-3 whitespace-nowrap">
            業界No.1のコスト。秘密はAI自動生成。
            <br />
            サーバー・SSL込み月480円。HPをお急ぎの方へ。
          </p>

          <p className="text-[2.8vw] sm:text-sm text-slate-500 mb-6 sm:mb-10 whitespace-nowrap">
            初期3,980円 + 月額480円（税込・初月無料・サーバーSSL込）/ いつでも解約可
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 justify-center px-0 sm:px-2">
            <Link
              href="/create"
              onClick={handleCtaClick}
              className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-5 py-2.5 sm:px-8 sm:py-4 rounded-lg sm:rounded-xl text-[3vw] sm:text-lg transition-all duration-300 hover:scale-105 shadow-[0_0_30px_rgba(245,158,11,0.35)] hover:shadow-[0_0_50px_rgba(245,158,11,0.55)] whitespace-nowrap"
            >
              無料でプレビューを見る
              <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link
              href="/edit"
              className="inline-flex items-center justify-center gap-1.5 border border-slate-600 hover:border-amber-500/50 text-slate-300 hover:text-amber-400 font-medium px-5 py-2.5 sm:px-8 sm:py-4 rounded-lg sm:rounded-xl text-[3vw] sm:text-lg transition-all duration-300 whitespace-nowrap"
            >
              既存サイトを修正する
            </Link>
          </div>
        </div>
      </section>

      {/* 作品例セクション — iframe で実サイト縮小表示 */}
      <section id="samples" className="bg-[#1A1A2E] py-14 sm:py-20 md:py-28 px-2 sm:px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[4.2vw] sm:text-3xl md:text-4xl font-bold text-center mb-2 sm:mb-3 whitespace-nowrap">
            AIが<span className="text-amber-400">実際に作った</span>サイト
          </h2>
          <p className="text-center text-slate-400 text-[2.7vw] sm:text-base mb-8 sm:mb-14 whitespace-nowrap">
            全部3,980円。クリックで実物をご覧ください。
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {SAMPLES.map((s) => (
              <a
                key={s.slug}
                href={`${WORKER_BASE}/${s.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-xl sm:rounded-2xl overflow-hidden border border-[#2D2D44] hover:border-amber-500/50 transition-all duration-300 bg-[#1E2035]"
              >
                {/* スクリーンショット画像 */}
                <div className="relative w-full h-40 sm:h-48 md:h-56 overflow-hidden">
                  <Image
                    src={s.img}
                    alt={`${s.label}のホームページ`}
                    width={640}
                    height={360}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                {/* ラベル */}
                <div className="p-3 sm:p-4 flex items-center justify-between">
                  <div className="text-center sm:text-left flex-1">
                    <span className="text-slate-200 font-semibold text-xs sm:text-sm">{s.label}</span>
                    <span className="ml-2 text-amber-400 text-[10px] sm:text-xs font-medium">
                      {s.time}で完成
                    </span>
                  </div>
                  <span className="text-slate-500 group-hover:text-amber-400 text-[10px] sm:text-xs transition-colors">
                    実物を見る →
                  </span>
                </div>
              </a>
            ))}

            {/* 最後のカード: CTA */}
            <Link
              href="/create"
              onClick={handleCtaClick}
              className="flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border-2 border-dashed border-[#2D2D44] hover:border-amber-500/50 transition-all duration-300 p-6 sm:p-8 min-h-[200px] sm:min-h-[320px]"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </div>
              <span className="text-amber-400 font-bold text-sm sm:text-lg">あなたのサイトを作る</span>
              <span className="text-slate-500 text-xs sm:text-sm mt-1 sm:mt-2">10分で完成します</span>
            </Link>
          </div>
        </div>
      </section>

      {/* お悩みセクション */}
      <section id="pain" className="bg-[#0F0F1A] py-14 sm:py-20 md:py-28 px-2 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[4.2vw] sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4 whitespace-nowrap">
            HPが<span className="text-amber-400">ない</span>だけで、損してませんか？
          </h2>
          <p className="text-center text-slate-400 text-[2.8vw] sm:text-base mb-8 sm:mb-14 whitespace-nowrap">
            「作りたいけど高い・難しい・時間ない」——もう言い訳は不要です
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {[
              { icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", text: "制作会社の見積もり10万円以上…\n個人事業主には高すぎる" },
              { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", text: "本業が忙しすぎて\nHP制作なんて後回し" },
              { icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", text: "自作しようとしたけど\n結局挫折して未完成のまま" },
              { icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", text: "「お店の名前 + 地域名」で\n検索しても何も出てこない" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center sm:items-start gap-3 sm:gap-4 p-4 sm:p-5 bg-[#1E2035] rounded-xl sm:rounded-2xl border border-[#2D2D44] hover:border-red-500/30 transition-colors duration-300 text-center sm:text-left flex-col sm:flex-row"
              >
                <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line text-[2.8vw] sm:text-base">{item.text}</p>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 sm:mt-10 text-[3vw] sm:text-lg text-slate-300 whitespace-nowrap">
            <span className="text-amber-400 font-bold">OnePage-Flash</span> なら、すべて解決。
          </p>
        </div>
      </section>

      {/* 聞かれる6つの質問セクション */}
      <section id="questions" className="bg-[#0F0F1A] py-14 sm:py-20 md:py-28 px-2 sm:px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[4.2vw] sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4 whitespace-nowrap">
            聞かれるのは<span className="text-amber-400">たった6つ</span>
          </h2>
          <p className="text-center text-slate-400 text-[2.7vw] sm:text-base mb-8 sm:mb-14 whitespace-nowrap">
            この6つに答えるだけ。あとはAIが全部やります
          </p>

          <div className="space-y-3 sm:space-y-4">
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
                className="flex items-start gap-3 sm:gap-4 p-3 sm:p-5 bg-[#1E2035] rounded-xl sm:rounded-2xl border border-[#2D2D44] hover:border-indigo-500/30 transition-colors duration-300"
              >
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[2.2vw] sm:text-xs font-bold text-indigo-400 bg-indigo-500/10 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                      {item.num}
                    </span>
                    <span className="text-[2.8vw] sm:text-sm font-semibold text-slate-200">{item.question}</span>
                  </div>
                  <p className="text-[2.2vw] sm:text-xs text-slate-500">{item.example}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 sm:mt-10 text-slate-400 text-[2.8vw] sm:text-sm whitespace-nowrap">
            所要時間は<span className="text-amber-400 font-bold">約5〜10分</span>。スマホからでもOK。
          </p>

          {/* 迷惑メール注意書き */}
          <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-[#1E2035] rounded-xl border border-amber-500/20">
            <p className="text-[2.4vw] sm:text-xs text-slate-400 leading-relaxed text-center">
              <span className="text-amber-400 font-medium">メールが届かない場合：</span>
              完成通知は <span className="text-slate-300 font-medium">noreply@bantex.jp</span> から送信されます。
              迷惑メールフォルダをご確認いただくか、
              <span className="text-slate-300">@bantex.jp</span> からのメールを受信許可に設定してください。
            </p>
          </div>
        </div>
      </section>

      {/* ステップセクション */}
      <section id="steps" className="bg-[#1A1A2E] py-14 sm:py-20 md:py-28 px-2 sm:px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[4.2vw] sm:text-3xl md:text-4xl font-bold text-center mb-10 sm:mb-16 whitespace-nowrap">
            最短<span className="text-amber-400">10分</span>。3ステップで公開
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
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
                className="relative flex flex-col items-center text-center p-5 sm:p-8 bg-[#1E2035] rounded-xl sm:rounded-2xl border border-[#2D2D44]"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center">
                  {item.step}
                </div>
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3 sm:mb-5 mt-2">
                  <svg className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                </div>
                <h3 className="text-[3vw] sm:text-lg font-bold mb-1 sm:mb-2">{item.title}</h3>
                <p className="text-[2.5vw] sm:text-sm text-slate-400 leading-relaxed whitespace-pre-line">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 料金セクション */}
      <section id="pricing" className="bg-[#0F0F1A] py-14 sm:py-20 md:py-28 px-2 sm:px-4">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-[4.2vw] sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 whitespace-nowrap">
            この価格、<span className="text-amber-400">本気</span>です
          </h2>
          <p className="text-slate-400 text-[2.8vw] sm:text-base mb-8 sm:mb-12 whitespace-nowrap">サーバー・SSL・ドメイン全部込み。追加費用なし。</p>

          <div className="bg-gradient-to-b from-[#1E2035] to-[#1A1A2E] rounded-2xl sm:rounded-3xl border border-indigo-500/30 p-4 sm:p-8 md:p-10 shadow-[0_0_60px_rgba(99,102,241,0.1)]">
            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[2.5vw] sm:text-xs font-medium mb-4 sm:mb-6">
              業界最安クラス
            </span>

            <div className="mb-1 sm:mb-2 whitespace-nowrap">
              <span className="text-[7vw] sm:text-5xl md:text-6xl font-black">¥3,980</span>
              <span className="text-[2.8vw] sm:text-lg text-slate-400 ml-1 sm:ml-2">初期費用</span>
            </div>
            <div className="mb-1 sm:mb-3 whitespace-nowrap">
              <span className="text-[4.5vw] sm:text-2xl font-bold text-slate-300">+ ¥480</span>
              <span className="text-slate-400 text-[2.8vw] sm:text-base">/月</span>
            </div>
            <p className="text-[3vw] sm:text-sm text-amber-400 font-medium mb-1">初月無料</p>
            <p className="text-[2.5vw] sm:text-sm text-slate-500 mb-5 sm:mb-8 whitespace-nowrap">税込 / いつでも解約可 / 解約後も再開OK</p>

            <ul className="space-y-2 sm:space-y-3 text-[2.8vw] sm:text-sm text-slate-300 mb-5 sm:mb-8 text-left">
              {[
                "AIによるプロ品質HP自動生成",
                "プレビューで確認してから決済",
                "あなた専用URLで即時公開",
                "月2回の修正込み",
                "SSL証明書・サーバー費用込み",
                "解約後も再開すれば即復旧",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 sm:gap-3 whitespace-nowrap">
                  <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/create"
              onClick={handleCtaClick}
              className="block w-full py-2.5 sm:py-4 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold rounded-lg sm:rounded-xl text-[3vw] sm:text-lg transition-all duration-300 shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] text-center whitespace-nowrap"
            >
              無料でプレビューを見る
            </Link>
          </div>
        </div>
      </section>

      {/* 最終CTA */}
      <section id="cta-final" className="relative py-16 sm:py-24 md:py-32 overflow-hidden px-2 sm:px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-[#0F0F1A] to-violet-900/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 sm:w-96 h-64 sm:h-96 bg-amber-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-[4.2vw] sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 whitespace-nowrap">
            HPがないのは、もったいない。
          </h2>
          <p className="text-slate-400 mb-6 sm:mb-10 text-[3vw] sm:text-lg leading-relaxed whitespace-nowrap">
            6つの質問に答えるだけ。
            <br className="sm:hidden" />
            10分後にはあなた専用のURLが届きます。
          </p>

          <Link
            href="/create"
            onClick={handleCtaClick}
            className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold px-5 py-2.5 sm:px-10 sm:py-5 rounded-lg sm:rounded-xl text-[3vw] sm:text-xl transition-all duration-300 hover:scale-105 shadow-[0_0_40px_rgba(245,158,11,0.4)] hover:shadow-[0_0_60px_rgba(245,158,11,0.6)] whitespace-nowrap"
          >
            無料でサイトを作ってみる
            <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>

          <p className="text-slate-600 text-[2.5vw] sm:text-sm mt-3 sm:mt-4 whitespace-nowrap">
            クレジットカード不要でプレビューが確認できます
          </p>

          <div className="mt-6 sm:mt-8">
            <a
              href="https://lin.ee/5b8JT4C"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 sm:gap-2 text-[#06C755] hover:text-[#05b04c] text-[2.8vw] sm:text-base font-medium transition-colors"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              ご不明な点はLINEでお気軽にどうぞ
            </a>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="bg-[#0A0A14] py-8 sm:py-12 px-2 sm:px-4 border-t border-[#2D2D44]">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between gap-6 sm:gap-8 mb-8 sm:mb-10 text-center sm:text-left">
            <div className="sm:max-w-xs">
              <span className="font-black text-[3vw] sm:text-lg tracking-tight">
                OnePage<span className="text-amber-400">-Flash</span>
              </span>
              <p className="text-[2.4vw] sm:text-sm text-slate-500 leading-relaxed mt-2 sm:mt-3">
                テキストを入力するだけで、AIが10分でプロ品質のホームページを生成するサービスです。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-8 text-[2.4vw] sm:text-sm">
              <div>
                <div className="text-slate-300 font-medium mb-1.5 sm:mb-3">サービス</div>
                <div className="space-y-1 sm:space-y-2">
                  <Link href="/create" className="block text-slate-500 hover:text-white transition-colors">HP作成</Link>
                  <Link href="/edit" className="block text-slate-500 hover:text-white transition-colors">サイト修正</Link>
                  <a href="https://lin.ee/5b8JT4C" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#06C755] hover:text-[#05b04c] transition-colors">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                    LINEサポート
                  </a>
                </div>
              </div>
              <div>
                <div className="text-slate-300 font-medium mb-1.5 sm:mb-3">法的情報</div>
                <div className="space-y-1 sm:space-y-2">
                  <Link href="/legal/terms" className="block text-slate-500 hover:text-white transition-colors">利用規約</Link>
                  <Link href="/legal/privacy" className="block text-slate-500 hover:text-white transition-colors">プライバシーポリシー</Link>
                  <Link href="/legal/tokushoho" className="block text-slate-500 hover:text-white transition-colors whitespace-nowrap">特定商取引法に基づく表記</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[#2D2D44] pt-4 sm:pt-6">
            <div className="flex flex-col items-center gap-2 sm:gap-3 text-[2.2vw] sm:text-xs text-slate-600">
              <p className="text-center whitespace-nowrap">&copy; 2026 OnePage-Flash（株式会社バンテックス）<span className="ml-1 sm:ml-2 text-slate-700">v0.7.0</span></p>
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Stripe 安全決済
                </span>
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  SSL暗号化
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
