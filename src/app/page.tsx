/**
 * / ページ (LP - ランディングページ)
 *
 * OnePage-Flash のサービス紹介LP。
 * チラシ調の強い価格訴求と、条件が合う人向けのシンプルHP制作導線。
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import UtmCapture from "@/components/UtmCapture";

function fireConversionEvent(): void {
  if (typeof window === "undefined") return;
  const gtagFn = (window as unknown as Record<string, unknown>)["gtag"] as ((...args: unknown[]) => void) | undefined;
  if (typeof gtagFn === "function") {
    gtagFn("event", "conversion", {
      send_to: "AW-17822680636/ObktCNO1nvwbELyMwrJC",
      value: 3980.0,
      currency: "JPY",
    });
  }
}

function handleCtaClick(e: React.MouseEvent<HTMLAnchorElement>): void {
  e.preventDefault();
  const href = (e.currentTarget as HTMLAnchorElement).href;
  fireConversionEvent();
  setTimeout(() => {
    window.location.href = href;
  }, 300);
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

const WORKER_BASE = "https://sites.oneflash.net/s";

const SAMPLES = [
  { slug: "sample-tax", label: "税理士事務所", time: "8分", img: "/samples/pc-1.png" },
  { slug: "sample-bloom", label: "美容室", time: "11分", img: "/samples/pc-2.png" },
  { slug: "sample-karada", label: "整体院", time: "7分", img: "/samples/pc-3.png" },
  { slug: "sample-komorebi", label: "カフェ", time: "9分", img: "/samples/pc-4.png" },
  { slug: "sample-shanti", label: "ヨガスタジオ", time: "6分", img: "/samples/pc-5.png" },
];

const CONDITIONS = [
  {
    num: "1",
    title: "画像無し",
    body: "写真素材の準備や差し替えにこだわらず、文章中心のシンプルなHPで作ります。",
  },
  {
    num: "2",
    title: "1ページ超シンプル",
    body: "会社概要、サービス、連絡先を1ページにまとめます。複雑な下層ページは作りません。",
  },
  {
    num: "3",
    title: "URLなんでもOK",
    body: "覚えやすさや独自ドメインに強くこだわらず、発行されたURLでそのまま公開します。",
  },
];

const PAINS = [
  "制作会社の見積もりが高く、HPを後回しにしている",
  "写真やデザインを決める時間がなく、いつまでも公開できない",
  "まずは名刺代わりの1ページがあれば十分",
  "店名や屋号で検索された時に、最低限の受け皿がほしい",
];

const FLOW = [
  {
    step: "1",
    title: "6つの質問に答える",
    body: "屋号、サービス内容、強み、連絡先などをスマホから入力します。",
  },
  {
    step: "2",
    title: "AIが文章とデザインを作成",
    body: "入力内容をもとに、文章とデザインを組み立てた1ページHPを自動生成します。",
  },
  {
    step: "3",
    title: "プレビュー後に決済",
    body: "内容を見てから決済。公開URLと修正リンクをメールで受け取れます。",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "OnePage-Flash",
  "applicationCategory": "WebApplication",
  "description": "6つの質問に答えるだけで、AIが文章とデザインを作成する1ページホームページ制作サービス。初期3,980円（税込）+ 月額480円（税込・初月無料）。",
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
    "6つの質問から文章とデザインを作成",
    "画像無しのシンプル1ページ制作",
    "プレビュー確認後の決済",
    "サーバー・SSL込み",
    "月2回の修正込み",
  ],
};

export default function HomePage() {
  useEffect(() => {
    const sid = localStorage.getItem("_bx_sid") || crypto.randomUUID();
    localStorage.setItem("_bx_sid", sid);
    const dt = window.innerWidth < 768 ? "mobile" : "desktop";
    const ref = document.referrer || "";
    const sent: Record<string, boolean> = {};

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const secId = entry.target.getAttribute("data-section") || entry.target.id;
        if (!secId || sent[secId]) return;
        sent[secId] = true;
        const blob = new Blob([JSON.stringify({
          session_id: sid,
          service_key: "onepage-flash",
          section_id: secId,
          device_type: dt,
          referrer: ref,
        })], { type: "application/json" });
        navigator.sendBeacon("https://bantex-ads-dashboard.onrender.com/api/track/scroll", blob);
      });
    }, { threshold: 0.3 });

    document.querySelectorAll("section[id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <UtmCapture trackPageView />

      <a
        href="https://lin.ee/5b8JT4C"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-[#06C755] px-4 py-3 text-sm font-bold text-white shadow-xl transition hover:bg-[#05b04c] sm:bottom-6 sm:right-6"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
        </svg>
        LINEで相談
      </a>

      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-200 bg-white/92 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <span className="text-base font-black sm:text-lg">
            OnePage<span className="text-orange-500">-Flash</span>
          </span>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/edit"
              className="text-sm font-bold text-zinc-600 transition hover:text-zinc-950"
            >
              サイト修正
            </Link>
            <Link
              href="/create"
              onClick={handleCtaClick}
              className="rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:bg-orange-600 sm:px-5"
            >
              今すぐ作成
            </Link>
          </div>
        </div>
      </nav>

      <section id="hero" className="bg-yellow-300 pt-14 sm:pt-16">
        <div className="sr-only">
          <h1>HPは、こだわりを捨てろ。6つの質問でAIが文章とデザインを作成。ホームページ制作は3,980円税込、月額480円税込で最短5分。</h1>
          <p>画像無し、1ページ超シンプル、発行URLなんでもOKなら、OnePage-Flashで文章中心のホームページをプレビューしてから決済できます。</p>
        </div>

        <Link
          href="/create"
          onClick={handleCtaClick}
          aria-label="OnePage-Flashでホームページをプレビューする"
          className="block"
        >
          <Image
            src="/campaign/oneflash-flyer-desktop-20260701b.png"
            alt="HPは、こだわりを捨てろ。6つの質問に答えるだけでAIが文章とデザインを作成。3,980円税込、最短5分、月額480円税込のOnePage-Flashチラシ"
            width={1672}
            height={941}
            priority
            className="hidden h-auto w-full md:block"
          />
          <Image
            src="/campaign/oneflash-flyer-mobile-20260701b.png"
            alt="HPは、こだわりを捨てろ。6つの質問でAIが文章とデザインを作成するスマホ向けOnePage-Flashチラシ"
            width={941}
            height={1672}
            priority
            className="block h-auto w-full md:hidden"
          />
        </Link>
      </section>

      <section id="conditions" className="bg-yellow-300 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black text-red-700">この条件なら、速い。</p>
              <h2 className="text-3xl font-black leading-tight text-zinc-950 sm:text-4xl">
                3つのこだわりが無ければOK
              </h2>
            </div>
            <p className="max-w-xl text-sm font-bold leading-relaxed text-zinc-800 sm:text-base">
              高級なフルオーダーHPではありません。まず公開するための、割り切った1ページ制作です。
            </p>
          </div>

          <div className="mb-8 overflow-hidden rounded-lg border-2 border-zinc-950 bg-white shadow-[8px_8px_0_#18181b]">
            <Image
              src="/campaign/conditions-panel-20260701b.png"
              alt="3つのこだわりが無ければOK。画像無し、1ページ超シンプル、URLなんでもOKの条件説明"
              width={1536}
              height={1024}
              loading="eager"
              className="h-auto w-full"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {CONDITIONS.map((item) => (
              <article key={item.num} className="rounded-lg border-2 border-zinc-950 bg-white p-5 shadow-[6px_6px_0_#18181b]">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-2xl font-black text-white">
                    {item.num}
                  </span>
                  <h3 className="text-2xl font-black text-zinc-950">{item.title}</h3>
                </div>
                <p className="text-sm font-bold leading-relaxed text-zinc-700">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pain" className="bg-white px-4 py-12 sm:px-6 sm:py-18 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-black text-orange-600">作り込む前に、まず出す。</p>
            <h2 className="mt-2 text-3xl font-black leading-tight text-zinc-950 sm:text-5xl">
              HPが無いままの機会損失を、今日で止める。
            </h2>
            <p className="mt-4 text-base font-bold leading-relaxed text-zinc-700">
              写真、文章、デザイン、独自URLに悩んで止まっているなら、6つの質問からAIに任せる1ページで十分です。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAINS.map((item) => (
              <div key={item} className="flex gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <CheckIcon className="mt-0.5 h-5 w-5 flex-none text-red-600" />
                <p className="text-sm font-bold leading-relaxed text-zinc-800">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="samples" className="bg-zinc-950 px-4 py-12 text-white sm:px-6 sm:py-18 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black text-yellow-300">6つの質問からAIが作るサンプル</p>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">
                1ページでも、最低限の信頼は作れる。
              </h2>
            </div>
            <p className="max-w-xl text-sm font-bold leading-relaxed text-zinc-300 sm:text-base">
              入力内容をもとに、文章とデザインを組み立てたサンプルです。クリックすると実物を確認できます。
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLES.map((sample) => (
              <a
                key={sample.slug}
                href={`${WORKER_BASE}/${sample.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-lg border border-zinc-700 bg-white text-zinc-950 transition hover:-translate-y-1 hover:border-yellow-300"
              >
                <div className="relative h-52 overflow-hidden bg-zinc-100">
                  <Image
                    src={sample.img}
                    alt={`AIが作った${sample.label}のホームページサンプル`}
                    width={640}
                    height={360}
                    loading="eager"
                    className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-black">{sample.label}</p>
                    <p className="text-sm font-bold text-orange-600">{sample.time}で完成</p>
                  </div>
                  <span className="text-sm font-black text-zinc-700 group-hover:text-orange-600">
                    実物を見る
                  </span>
                </div>
              </a>
            ))}
            <Link
              href="/create"
              onClick={handleCtaClick}
              className="flex min-h-72 flex-col justify-between rounded-lg border-2 border-dashed border-yellow-300 p-6 text-yellow-300 transition hover:bg-yellow-300 hover:text-zinc-950"
            >
              <span className="text-sm font-black">あなたの業種でも</span>
              <span className="text-3xl font-black leading-tight">まずはAIでプレビュー</span>
              <span className="inline-flex items-center gap-2 text-base font-black">
                作ってみる
                <ArrowIcon />
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section id="steps" className="bg-white px-4 py-12 sm:px-6 sm:py-18 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-8 max-w-3xl text-center">
            <p className="text-sm font-black text-orange-600">手順はシンプル</p>
            <h2 className="mt-2 text-3xl font-black leading-tight text-zinc-950 sm:text-4xl">
              スマホから入力して、プレビューを見てから決済。
            </h2>
          </div>

          <div className="mb-8 overflow-hidden rounded-lg border-2 border-zinc-950 bg-white shadow-2xl shadow-zinc-950/10">
            <Image
              src="/campaign/steps-panel-20260701b.png"
              alt="最短5分、3ステップでHP公開。6つの質問に答える、AIが文章とデザインを作成、URLで公開"
              width={1672}
              height={941}
              loading="eager"
              className="h-auto w-full"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {FLOW.map((item) => (
              <article key={item.step} className="rounded-lg border-2 border-zinc-950 bg-white p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 text-xl font-black text-yellow-300">
                  {item.step}
                </div>
                <h3 className="text-xl font-black text-zinc-950">{item.title}</h3>
                <p className="mt-3 text-sm font-bold leading-relaxed text-zinc-700">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-lg bg-orange-50 p-4 text-center text-sm font-bold leading-relaxed text-zinc-700">
            完成通知は <span className="font-black text-zinc-950">noreply@bantex.jp</span> から届きます。届かない場合は迷惑メールフォルダと受信許可設定をご確認ください。
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-orange-500 px-4 py-12 sm:px-6 sm:py-18 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 overflow-hidden rounded-lg border-2 border-zinc-950 bg-white shadow-[8px_8px_0_#18181b]">
            <Image
              src="/campaign/pricing-comparison-20260701b.png"
              alt="高いHP制作で悩む前に。一般的な制作会社10万円から、OnePage-Flashは初期3,980円税込、月額480円税込"
              width={1536}
              height={1024}
              loading="eager"
              className="h-auto w-full"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-black text-white">こだわりを削った人向け価格</p>
            <h2 className="mt-2 text-4xl font-black leading-tight text-white sm:text-6xl">
              この条件なら、<br />3,980円（税込）。
            </h2>
            <p className="mt-4 max-w-xl text-base font-bold leading-relaxed text-white/90">
              サーバー・SSL込み。月額480円（税込）、初月無料。プレビュー後に決済できるので、先に仕上がりを確認できます。
            </p>
          </div>

          <div className="rounded-lg border-2 border-zinc-950 bg-white p-5 shadow-[8px_8px_0_#18181b] sm:p-7">
            <div className="mb-5 rounded-lg bg-zinc-950 p-5 text-white">
              <p className="text-sm font-black text-yellow-300">初期制作費</p>
              <p className="mt-1 text-5xl font-black text-yellow-300 sm:text-6xl">3,980円</p>
              <p className="mt-1 text-base font-black">税込 / 一回のみ</p>
            </div>
            <div className="mb-5 rounded-lg border-2 border-zinc-950 p-5">
              <p className="text-sm font-black text-zinc-600">月額利用料</p>
              <p className="mt-1 text-4xl font-black text-zinc-950">480円<span className="text-lg">/月</span></p>
              <p className="mt-1 text-sm font-bold text-zinc-700">税込・初月無料・いつでも解約可</p>
            </div>
            <ul className="space-y-3 text-sm font-bold text-zinc-800">
              {[
                "画像無し、1ページ超シンプル、発行URLなんでもOKの範囲",
                "6つの質問からAIが文章とデザインを作成",
                "プレビュー確認後に決済",
                "SSL証明書・サーバー費用込み",
                "月2回の修正込み",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckIcon className="mt-0.5 h-5 w-5 flex-none text-orange-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/create"
              onClick={handleCtaClick}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-7 py-4 text-base font-black text-white transition hover:bg-red-700"
            >
              無料でプレビューを見る
              <ArrowIcon />
            </Link>
          </div>
          </div>
        </div>
      </section>

      <section id="cta-final" className="bg-zinc-950 px-4 py-14 text-white sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-black text-yellow-300">まず公開。細かいこだわりは後でいい。</p>
          <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
            HP制作で止まっているなら、<br className="hidden sm:block" />今日プレビューしてください。
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base font-bold leading-relaxed text-zinc-300">
            3,980円（税込）の対象は、画像無し・1ページ超シンプル・URLなんでもOKの割り切り制作です。条件が合えば、速く安く出せます。
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/create"
              onClick={handleCtaClick}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-yellow-300 px-8 py-4 text-base font-black text-zinc-950 transition hover:bg-white"
            >
              まずはプレビュー
              <ArrowIcon />
            </Link>
            <a
              href="https://lin.ee/5b8JT4C"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border-2 border-[#06C755] px-8 py-4 text-base font-black text-[#06C755] transition hover:bg-[#06C755] hover:text-white"
            >
              LINEで相談
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <span className="text-lg font-black">
                OnePage<span className="text-orange-500">-Flash</span>
              </span>
              <p className="mt-3 max-w-sm text-sm font-bold leading-relaxed text-zinc-400">
                6つの質問に答えるだけで、AIが文章とデザインを作成する1ページホームページ制作サービスです。
              </p>
            </div>
            <div>
              <div className="mb-3 text-sm font-black text-zinc-200">サービス</div>
              <div className="space-y-2 text-sm font-bold text-zinc-500">
                <Link href="/create" className="block transition hover:text-white">HP作成</Link>
                <Link href="/edit" className="block transition hover:text-white">サイト修正</Link>
                <a href="https://lin.ee/5b8JT4C" target="_blank" rel="noopener noreferrer" className="block text-[#06C755] transition hover:text-[#59e58a]">LINEサポート</a>
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-black text-zinc-200">法的情報</div>
              <div className="space-y-2 text-sm font-bold text-zinc-500">
                <Link href="/legal/terms" className="block transition hover:text-white">利用規約</Link>
                <Link href="/legal/privacy" className="block transition hover:text-white">プライバシーポリシー</Link>
                <Link href="/legal/tokushoho" className="block transition hover:text-white">特定商取引法に基づく表記</Link>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-zinc-800 pt-6 text-xs font-bold text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; 2026 OnePage-Flash（株式会社バンテックス） v0.7.9</p>
            <div className="flex gap-4">
              <span>Stripe 安全決済</span>
              <span>SSL暗号化</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
