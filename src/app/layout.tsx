import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HP制作 格安3,980円ならOnePage-Flash | ホームページ激安制作",
  description: "HP制作を格安で始めたい方向け。画像無し・1ページ超シンプル・URLなんでもOKなら、6つの質問に答えるだけでAIが文章とデザインを作成。初期3,980円（税込）+ 月額480円（税込・初月無料）。",
  keywords: [
    "HP制作 格安",
    "ホームページ 激安",
    "ホームページ制作 格安",
    "安いホームページ制作",
    "1ページ ホームページ制作",
    "AI ホームページ制作",
    "OnePage-Flash",
  ],
  metadataBase: new URL("https://oneflash.bantex.jp"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://oneflash.bantex.jp",
    title: "HP制作 格安3,980円ならOnePage-Flash | ホームページ激安制作",
    description: "HP制作を格安で始めたい方向け。画像無し・1ページ超シンプル・URLなんでもOKなら、6つの質問に答えるだけでAIが文章とデザインを作成。初期3,980円（税込）+ 月額480円（税込・初月無料）。",
    images: [
      {
        url: "/campaign/oneflash-flyer-desktop-20260701b.png",
        width: 1672,
        height: 941,
        alt: "HP制作を格安3,980円税込で始めるOnePage-Flashのチラシ",
      },
    ],
    siteName: "OnePage-Flash",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "HP制作 格安3,980円ならOnePage-Flash | ホームページ激安制作",
    description: "HP制作を格安で始めたい方向け。画像無し・1ページ超シンプル・URLなんでもOKなら、6つの質問に答えるだけでAIが文章とデザインを作成。初期3,980円（税込）+ 月額480円（税込・初月無料）。",
    images: ["/campaign/oneflash-flyer-desktop-20260701b.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "fE7Fgs6Lf_Fhpw_e3lkJZUnR_EyknArr9uVxzGZcj50",
  },
};

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const AW_ID = process.env.NEXT_PUBLIC_AW_CONVERSION_ID;
const GTAG_ID = GA_ID || AW_ID;
const X_PIXEL_ID = process.env.NEXT_PUBLIC_X_PIXEL_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* Microsoft Clarity */}
        <Script id="clarity-init" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "vtghvflph0");
          `}
        </Script>
        {/* Google Analytics 4 + Google Ads */}
        {GTAG_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                ${GA_ID ? `gtag('config', '${GA_ID}');` : ""}
                ${AW_ID ? `gtag('config', '${AW_ID}');` : ""}
              `}
            </Script>
          </>
        )}
        {/* X Pixel */}
        {X_PIXEL_ID && (
          <Script id="x-pixel-init" strategy="afterInteractive">
            {`
              !function(e,t,n,s,u,a){
                e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},
                s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,
                u.src='https://static.ads-twitter.com/uwt.js',
                a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))
              }(window,document,'script');
              twq('config','${X_PIXEL_ID}');
            `}
          </Script>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
