/**
 * API Route: POST /api/screenshot
 *
 * Puppeteer を使用して HTML 文字列を PC・スマホ両サイズでレンダリングし、
 * base64 エンコードした PNG スクリーンショットを返す。
 *
 * Tailwind CDN / Google Fonts / Lucide Icons CDN の読み込みを待機してから
 * キャプチャするため networkidle0 を使用する。
 *
 * Request:
 *   { html: string }
 *
 * Response:
 *   { pcImage: string, mobileImage: string }  // "data:image/png;base64,..." 形式
 *
 * puppeteer-core + @sparticuz/chromium を使用。
 * ローカル開発時はシステムの Chrome を自動検出する。
 */

import { NextRequest, NextResponse } from "next/server";
import puppeteerCore, { Browser } from "puppeteer-core";

// Puppeteer は Node.js API を使用するため nodejs ランタイムを明示
export const runtime = "nodejs";

// CDN 読み込み + レンダリング時間を考慮してタイムアウトを延長（秒単位）
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** PC版ビューポート設定 */
const PC_VIEWPORT = { width: 1280, height: 800 } as const;

/** スマホ版ビューポート設定 (iPhone 14 相当) */
const MOBILE_VIEWPORT = { width: 390, height: 844, isMobile: true } as const;

/** CDN 読み込み完了までの最大待機時間（ms） */
const NETWORK_IDLE_TIMEOUT_MS = 30_000;

/** フルページキャプチャの最大高さ上限（px） */
const MAX_PAGE_HEIGHT_PC = 5_000;
const MAX_PAGE_HEIGHT_MOBILE = 10_000;

// ---------------------------------------------------------------------------
// ハンドラー
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  let browser: Browser | null = null;

  try {
    const body = (await request.json()) as { html?: string };
    const { html } = body;

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "html is required" }, { status: 400 });
    }

    console.log("[screenshot] Launching browser...");
    // Chrome実行パスの決定:
    // 1. 環境変数 CHROME_PATH があればそれを使う（Render等）
    // 2. Windowsならシステムの Chrome
    // 3. macOS なら /Applications/Google Chrome.app
    // 4. Linux なら google-chrome-stable（Render の apt でインストール）
    const executablePath =
      process.env.CHROME_PATH ||
      (process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : "/usr/bin/google-chrome-stable");

    browser = await puppeteerCore.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--allow-file-access-from-files",
        "--font-render-hinting=none",
      ],
    });

    // --- PC版スクリーンショット ---
    const pcBase64 = await captureScreenshot(browser, html, PC_VIEWPORT, MAX_PAGE_HEIGHT_PC);
    console.log("[screenshot] PC screenshot captured");

    // --- スマホ版スクリーンショット ---
    const mobileBase64 = await captureScreenshot(browser, html, MOBILE_VIEWPORT, MAX_PAGE_HEIGHT_MOBILE);
    console.log("[screenshot] Mobile screenshot captured");

    return NextResponse.json(
      { pcImage: pcBase64, mobileImage: mobileBase64 },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[screenshot] Error:", error);
    const message =
      error instanceof Error ? error.message : "Screenshot generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // ブラウザは必ず閉じる（リソースリーク防止）
    if (browser) {
      await browser.close();
      console.log("[screenshot] Browser closed");
    }
  }
}

// ---------------------------------------------------------------------------
// ヘルパー関数
// ---------------------------------------------------------------------------

type ViewportOptions =
  | typeof PC_VIEWPORT
  | typeof MOBILE_VIEWPORT;

/**
 * 指定ビューポートで HTML をレンダリングしてスクリーンショットを撮影する。
 *
 * @param browser   - 起動済み Puppeteer Browser インスタンス
 * @param html      - レンダリングする HTML 文字列
 * @param viewport  - ビューポート設定（幅・高さ・isMobile フラグ）
 * @returns "data:image/png;base64,..." 形式の文字列
 */
async function captureScreenshot(
  browser: Browser,
  html: string,
  viewport: ViewportOptions,
  maxHeight: number
): Promise<string> {
  const page = await browser.newPage();

  try {
    // ビューポートを設定
    await page.setViewport(viewport);

    // HTML をロード。networkidle0 で Tailwind CDN / Google Fonts / Lucide が
    // すべて読み込み完了するまで待機する
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: NETWORK_IDLE_TIMEOUT_MS,
    });

    // ページの実際の高さを取得（最大高さで上限）
    const pageHeight = await page.evaluate(
      (mh: number) =>
        Math.min(document.documentElement.scrollHeight, mh),
      maxHeight
    );

    // フルページキャプチャ（高さ上限付き）
    const screenshot = await page.screenshot({
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: pageHeight,
      },
    });

    const base64 = `data:image/png;base64,${Buffer.from(screenshot).toString("base64")}`;
    return base64;
  } finally {
    // ページは必ず閉じる
    await page.close();
  }
}
