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
  title: "OnePage-Flash - 10分でホームページが完成",
  description: "テキストを打ち込むだけ。AIが美しいホームページを自動生成します。初期3,980円 + 月額480円（税込・初月無料）。",
  metadataBase: new URL("https://oneflash.bantex.jp"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://oneflash.bantex.jp",
    title: "OnePage-Flash - 10分でホームページが完成",
    description: "テキストを打ち込むだけ。AIが美しいホームページを自動生成。初期3,980円 + 月額480円（税込・初月無料）。",
    siteName: "OnePage-Flash",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: "OnePage-Flash - 10分でホームページが完成",
    description: "テキストを打ち込むだけ。AIが美しいホームページを自動生成。初期3,980円 + 月額480円（税込・初月無料）。",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
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
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
