/**
 * API Route: POST /api/screenshot
 *
 * Puppeteer を使用して HTML 文字列を PC・スマホ両サイズでレンダリングし、
 * base64 エンコードした PNG スクリーンショットを返す。
 *
 * 本番環境(Linux): @sparticuz/chromium のバンドル Chromium を使用。
 * ローカル開発: システムの Chrome を自動検出。
 *
 * Request:
 *   { html: string }
 *
 * Response:
 *   { pcImage: string, mobileImage: string }  // "data:image/png;base64,..." 形式
 */

import { NextRequest, NextResponse } from "next/server";
import puppeteerCore, { Browser } from "puppeteer-core";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const PC_VIEWPORT = { width: 1280, height: 800 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844, isMobile: true } as const;
const NETWORK_IDLE_TIMEOUT_MS = 30_000;
const MAX_PAGE_HEIGHT_PC = 5_000;
const MAX_PAGE_HEIGHT_MOBILE = 10_000;

// ---------------------------------------------------------------------------
// Chromium バイナリ取得
// ---------------------------------------------------------------------------

/**
 * 実行環境に応じた Chrome/Chromium のパスを返す。
 * Linux（Render 等のサーバー）では @sparticuz/chromium を使用。
 * ローカル開発ではシステムの Chrome を使用。
 */
async function getChromiumConfig(): Promise<{
  executablePath: string;
  args: string[];
  headless: boolean | "shell";
}> {
  // 環境変数で明示指定がある場合はそれを使用
  if (process.env.CHROME_PATH) {
    return {
      executablePath: process.env.CHROME_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      headless: true,
    };
  }

  // Linux (Render) → @sparticuz/chromium を使用
  if (process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless,
    };
  }

  // macOS
  if (process.platform === "darwin") {
    return {
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    };
  }

  // Windows
  return {
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  };
}

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
    const config = await getChromiumConfig();
    console.log("[screenshot] executablePath:", config.executablePath);

    browser = await puppeteerCore.launch({
      executablePath: config.executablePath,
      headless: config.headless as true,
      args: config.args,
    });

    // --- PC版スクリーンショット ---
    const pcBase64 = await captureScreenshot(
      browser,
      html,
      PC_VIEWPORT,
      MAX_PAGE_HEIGHT_PC
    );
    console.log("[screenshot] PC screenshot captured");

    // --- スマホ版スクリーンショット ---
    const mobileBase64 = await captureScreenshot(
      browser,
      html,
      MOBILE_VIEWPORT,
      MAX_PAGE_HEIGHT_MOBILE
    );
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
    if (browser) {
      await browser.close();
      console.log("[screenshot] Browser closed");
    }
  }
}

// ---------------------------------------------------------------------------
// ヘルパー関数
// ---------------------------------------------------------------------------

type ViewportOptions = typeof PC_VIEWPORT | typeof MOBILE_VIEWPORT;

async function captureScreenshot(
  browser: Browser,
  html: string,
  viewport: ViewportOptions,
  maxHeight: number
): Promise<string> {
  const page = await browser.newPage();

  try {
    await page.setViewport(viewport);

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: NETWORK_IDLE_TIMEOUT_MS,
    });

    const pageHeight = await page.evaluate(
      (mh: number) =>
        Math.min(document.documentElement.scrollHeight, mh),
      maxHeight
    );

    const screenshot = await page.screenshot({
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: pageHeight,
      },
    });

    return `data:image/png;base64,${Buffer.from(screenshot).toString("base64")}`;
  } finally {
    await page.close();
  }
}
