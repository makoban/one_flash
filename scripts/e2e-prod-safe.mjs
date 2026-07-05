#!/usr/bin/env node
/**
 * Production-safe E2E checks for OnePage-Flash.
 *
 * This script exercises the released site without submitting real payments or
 * publishing sites. It blocks analytics writes, mocks destructive/edge API
 * paths where needed, and runs one real create-preview generation smoke test.
 *
 * Usage:
 *   node scripts/e2e-prod-safe.mjs
 *   BASE_URL=https://oneflash.bantex.jp HEADFUL=1 node scripts/e2e-prod-safe.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const BASE_URL = process.env.BASE_URL || "https://oneflash.bantex.jp";
const CHROME_PATH =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const HEADFUL = process.env.HEADFUL === "1";
const SKIP_LIVE_GENERATE = process.env.SKIP_LIVE_GENERATE === "1";
const LIVE_TIMEOUT_MS = Number(process.env.LIVE_TIMEOUT_MS || 240_000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_DIR = path.resolve(
  __dirname,
  "..",
  "tmp",
  "e2e-prod-safe",
  new Date().toISOString().replace(/[:.]/g, "-")
);

const TEST_DATA = {
  siteName: `E2E確認整体院 ${Date.now().toString(36).slice(-5)}`,
  catchphrase: "20年の実績。肩こりと腰痛を根本から整えます",
  description:
    "名古屋市の小さな整体院です。初めての方にもわかりやすく説明し、肩こり、腰痛、姿勢の悩みに合わせて丁寧に施術します。予約制で落ち着いて相談できます。",
  contactInfo:
    "電話: 052-000-1111\n住所: 名古屋市中区栄1-1-1\n営業時間: 10:00-19:00\n予約: https://example.com/reserve",
  email: `e2e+${Date.now()}@example.com`,
};

const MOCK_HTML = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>E2E確認整体院</title>
  <style>
    body{margin:0;font-family:system-ui,sans-serif;color:#172033;background:#fff}
    main{max-width:960px;margin:0 auto;padding:48px 20px}
    h1{font-size:clamp(30px,6vw,64px);line-height:1.08;margin:0 0 16px}
    p{font-size:18px;line-height:1.8}
    .cta{display:inline-block;margin-top:20px;padding:14px 20px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none}
  </style>
</head>
<body>
  <main>
    <h1>E2E確認整体院</h1>
    <p>20年の実績。肩こりと腰痛を根本から整えます。</p>
    <a class="cta" href="tel:0520001111">電話で予約する</a>
  </main>
</body>
</html>`;

const results = [];

function log(message) {
  console.log(`[${new Date().toLocaleTimeString("ja-JP")}] ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function screenshot(page, name) {
  const file = path.join(ARTIFACT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function withTest(name, fn) {
  const startedAt = Date.now();
  try {
    await fn();
    const ms = Date.now() - startedAt;
    results.push({ name, status: "PASS", ms });
    log(`PASS ${name} (${ms}ms)`);
  } catch (error) {
    const ms = Date.now() - startedAt;
    results.push({
      name,
      status: "FAIL",
      ms,
      error: error instanceof Error ? error.message : String(error),
    });
    log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function createBrowser() {
  assert(fs.existsSync(CHROME_PATH), `Chrome not found: ${CHROME_PATH}`);
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: HEADFUL ? false : "new",
    defaultViewport: { width: 1280, height: 900 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1280,900",
    ],
  });
}

async function newPage(browser, options = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(options.defaultTimeout ?? 30_000);
  page.setDefaultNavigationTimeout(options.navigationTimeout ?? 60_000);
  if (options.viewport) {
    await page.setViewport(options.viewport);
  }
  if (options.userAgent) {
    await page.setUserAgent(options.userAgent);
  }

  const consoleErrors = [];
  const requestFailures = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" && !isIgnoredConsoleError(text)) {
      consoleErrors.push(text);
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const failureText = request.failure()?.errorText || "";
    if (!isIgnoredNetworkFailure(url, failureText)) {
      requestFailures.push(`${failureText} ${url}`);
    }
  });

  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    try {
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (pathname === "/api/track") {
        await request.respond({ status: 204, body: "" });
        return;
      }

      if (
        url.hostname.includes("googletagmanager.com") ||
        url.hostname.includes("google-analytics.com") ||
        url.hostname.includes("doubleclick.net") ||
        url.hostname.includes("ads-twitter.com") ||
        url.hostname === "bantex-ads-dashboard.onrender.com"
      ) {
        await request.abort();
        return;
      }

      if (options.route) {
        const handled = await options.route(request, url);
        if (handled) return;
      }

      await request.continue();
    } catch {
      if (!request.isInterceptResolutionHandled()) {
        await request.continue().catch(() => undefined);
      }
    }
  });

  return {
    page,
    consoleErrors,
    requestFailures,
    async assertQuiet() {
      assert(
        consoleErrors.length === 0,
        `Browser console errors: ${consoleErrors.slice(0, 3).join(" | ")}`
      );
      assert(
        requestFailures.length === 0,
        `Network failures: ${requestFailures.slice(0, 3).join(" | ")}`
      );
    },
  };
}

function isIgnoredConsoleError(text) {
  return /ERR_BLOCKED_BY_CLIENT|Failed to load resource: net::ERR_FAILED|Failed to load resource.*googletagmanager|ads-twitter|google-analytics/i.test(
    text
  );
}

function isIgnoredNetworkFailure(url, failureText) {
  if (/net::ERR_BLOCKED_BY_CLIENT|net::ERR_ABORTED/i.test(failureText)) return true;
  return /googletagmanager|google-analytics|doubleclick|ads-twitter|bantex-ads-dashboard/i.test(
    url
  );
}

async function clickByText(page, text, selector = "button, a") {
  await page.waitForFunction(
    ({ text: targetText, selector: targetSelector }) =>
      [...document.querySelectorAll(targetSelector)].some((el) => {
        const disabled = "disabled" in el && el.disabled;
        return !disabled && el.textContent?.includes(targetText);
      }),
    {},
    { text, selector }
  );
  const clicked = await page.evaluate(
    ({ text: targetText, selector: targetSelector }) => {
      const el = [...document.querySelectorAll(targetSelector)].find((candidate) => {
        const disabled = "disabled" in candidate && candidate.disabled;
        return !disabled && candidate.textContent?.includes(targetText);
      });
      el?.click();
      return Boolean(el);
    },
    { text, selector }
  );
  assert(clicked, `Button/link not found: ${text}`);
}

async function typeVisible(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = "";
      el.focus();
    }
  }, selector);
  await page.type(selector, value, { delay: 4 });
}

async function fillCreateForm(page) {
  await typeVisible(page, 'input[type="text"]', TEST_DATA.siteName);
  await clickByText(page, "次へ");

  await page.waitForFunction(() => document.body.textContent?.includes("ステップ 2/6"));
  await typeVisible(page, 'input[type="text"]', TEST_DATA.catchphrase);
  await clickByText(page, "次へ");

  await page.waitForFunction(() => document.body.textContent?.includes("ステップ 3/6"));
  await typeVisible(page, "textarea", TEST_DATA.description);
  await clickByText(page, "次へ");

  await page.waitForFunction(() => document.body.textContent?.includes("ステップ 4/6"));
  await typeVisible(page, "textarea", TEST_DATA.contactInfo);
  await clickByText(page, "次へ");

  await page.waitForFunction(() => document.body.textContent?.includes("ステップ 5/6"));
  await clickByText(page, "次へ");

  await page.waitForFunction(() => document.body.textContent?.includes("ステップ 6/6"));
  await typeVisible(page, 'input[type="email"]', TEST_DATA.email);
}

async function assertNoRawBrowserError(page) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  assert(
    !/The string did not match the expected pattern|Unexpected end of JSON input|Failed to execute 'json'/i.test(
      bodyText
    ),
    `Raw browser JSON error leaked to UI: ${bodyText.slice(0, 300)}`
  );
}

async function testPublicPages(browser) {
  const pages = ["/", "/start", "/create", "/edit", "/legal/terms", "/legal/privacy", "/legal/tokushoho"];
  for (const [index, route] of pages.entries()) {
    const { page, assertQuiet } = await newPage(browser);
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.innerText.trim().length > 0);
    const statusText = await page.evaluate(() => document.body.innerText.slice(0, 80));
    assert(statusText.trim().length > 0, `${route} rendered empty body`);

    if (["/", "/start", "/create"].includes(route)) {
      const { page: mobilePage, assertQuiet: assertMobileQuiet } = await newPage(browser, {
        viewport: { width: 390, height: 844, isMobile: true },
      });
      await mobilePage.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
      await mobilePage.waitForFunction(() => document.body.innerText.trim().length > 0);
      const widths = await mobilePage.evaluate(() => ({
        innerWidth: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        docScrollWidth: document.documentElement.scrollWidth,
      }));
      assert(
        widths.bodyScrollWidth <= widths.innerWidth + 2 &&
          widths.docScrollWidth <= widths.innerWidth + 2,
        `${route} horizontal overflow: ${JSON.stringify(widths)}`
      );
      await screenshot(mobilePage, `public-${index}-${route.replaceAll("/", "root") || "root"}`);
      await assertMobileQuiet();
      await mobilePage.close();
    }

    await assertQuiet();
    await page.close();
  }
}

async function testGenerateMalformedJson(browser) {
  let generateCalls = 0;
  const { page } = await newPage(browser, {
    route: async (request, url) => {
      if (url.pathname === "/api/moderate") {
        await request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ isSafe: true, reason: "OK" }),
        });
        return true;
      }
      // ジョブ未対応の旧サーバーを再現 → クライアントは /api/generate にフォールバック
      if (url.pathname === "/api/generate-job") {
        await request.respond({ status: 404, contentType: "text/plain", body: "not found" });
        return true;
      }
      if (url.pathname === "/api/generate") {
        generateCalls += 1;
        await request.respond({
          status: 200,
          contentType: "application/json",
          body: "",
        });
        return true;
      }
      return false;
    },
  });

  await page.goto(`${BASE_URL}/create`, { waitUntil: "domcontentloaded" });
  await fillCreateForm(page);
  await clickByText(page, "サイトを生成する");

  await page.waitForFunction(
    () =>
      document.body.innerText.includes("同じ内容で再試行") ||
      document.body.innerText.includes("通信が不安定でAI生成結果を読み込めませんでした"),
    { timeout: 45_000 }
  );
  await assertNoRawBrowserError(page);
  assert(generateCalls === 3, `Expected 3 generate retries, got ${generateCalls}`);
  await screenshot(page, "mock-generate-malformed-json");
  await page.close();
}

async function testJobFlowSurvivesBrokenStatusJson(browser) {
  let statusCalls = 0;
  const { page } = await newPage(browser, {
    route: async (request, url) => {
      if (url.pathname === "/api/moderate") {
        await request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ isSafe: true, reason: "OK" }),
        });
        return true;
      }
      if (url.pathname === "/api/generate-job") {
        await request.respond({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ jobId: "e2e-job-1" }),
        });
        return true;
      }
      if (url.pathname === "/api/generate-job-status") {
        statusCalls += 1;
        // 1回目: 壊れたJSON（iOS Safariの通信切断を再現）→ 次のポーリングで回復すること
        if (statusCalls === 1) {
          await request.respond({ status: 200, contentType: "application/json", body: "" });
          return true;
        }
        // 2回目: 生成中
        if (statusCalls === 2) {
          await request.respond({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: "pending" }),
          });
          return true;
        }
        // 3回目以降: 完了
        await request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "complete", html: MOCK_HTML, warnings: [] }),
        });
        return true;
      }
      if (url.pathname === "/api/screenshot") {
        await request.respond({ status: 500, contentType: "text/plain", body: "screenshot failed" });
        return true;
      }
      return false;
    },
  });

  await page.goto(`${BASE_URL}/create`, { waitUntil: "domcontentloaded" });
  await fillCreateForm(page);
  await clickByText(page, "サイトを生成する");

  await page.waitForFunction(
    () => document.body.innerText.includes("このサイトを公開する"),
    { timeout: 90_000 }
  );
  await assertNoRawBrowserError(page);
  assert(statusCalls >= 3, `Expected at least 3 status polls, got ${statusCalls}`);
  await screenshot(page, "mock-job-flow-broken-status-json");
  await page.close();
}

async function testScreenshotFallbackAndCheckoutJsonGuard(browser) {
  const { page } = await newPage(browser, {
    route: async (request, url) => {
      if (url.pathname === "/api/moderate") {
        await request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ isSafe: true, reason: "OK" }),
        });
        return true;
      }
      // ジョブ未対応の旧サーバーを再現（フォールバック経路で検証）
      if (url.pathname === "/api/generate-job") {
        await request.respond({ status: 404, contentType: "text/plain", body: "not found" });
        return true;
      }
      if (url.pathname === "/api/generate") {
        await request.respond({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ html: MOCK_HTML, warnings: [] }),
        });
        return true;
      }
      if (url.pathname === "/api/screenshot") {
        await request.respond({
          status: 500,
          contentType: "text/plain",
          body: "screenshot failed without json",
        });
        return true;
      }
      if (url.pathname === "/api/create-checkout-session") {
        await request.respond({
          status: 200,
          contentType: "application/json",
          body: "",
        });
        return true;
      }
      return false;
    },
  });

  await page.goto(`${BASE_URL}/create`, { waitUntil: "domcontentloaded" });
  await fillCreateForm(page);
  await clickByText(page, "サイトを生成する");

  await page.waitForFunction(
    () =>
      document.body.innerText.includes("プレビュー画像の生成だけ失敗しました") &&
      document.body.innerText.includes("このサイトを公開する"),
    { timeout: 45_000 }
  );
  await assertNoRawBrowserError(page);
  await screenshot(page, "mock-screenshot-fallback-preview");

  await clickByText(page, "このサイトを公開する");
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("決済ページ") ||
      document.body.innerText.includes("通信が不安定"),
    { timeout: 20_000 }
  );
  await assertNoRawBrowserError(page);
  const text = await page.evaluate(() => document.body.innerText);
  assert(
    text.includes("決済ページ") || text.includes("通信が不安定"),
    "Checkout malformed JSON did not show a Japanese error"
  );
  await screenshot(page, "mock-checkout-malformed-json");
  await page.close();
}

async function testLiveCreatePreview(browser) {
  if (SKIP_LIVE_GENERATE) {
    results.push({ name: "live create preview", status: "SKIP", ms: 0 });
    log("SKIP live create preview");
    return;
  }

  const { page } = await newPage(browser, {
    defaultTimeout: LIVE_TIMEOUT_MS,
    navigationTimeout: 90_000,
  });
  await page.setViewport({
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  await page.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
  );

  await page.goto(`${BASE_URL}/create`, { waitUntil: "domcontentloaded" });
  await fillCreateForm(page);
  await screenshot(page, "live-mobile-form-complete");
  await clickByText(page, "サイトを生成する");

  const started = Date.now();
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return (
        text.includes("このサイトを公開する") ||
        text.includes("AIに修正を指示") ||
        text.includes("プレビュー画像の生成だけ失敗しました") ||
        text.includes("同じ内容で再試行") ||
        text.includes("通信が不安定") ||
        text.includes("AI生成サービス")
      );
    },
    { timeout: LIVE_TIMEOUT_MS }
  );

  await assertNoRawBrowserError(page);
  const text = await page.evaluate(() => document.body.innerText);
  const elapsed = Date.now() - started;
  assert(
    text.includes("このサイトを公開する") || text.includes("AIに修正を指示"),
    `Live generation did not reach preview after ${elapsed}ms: ${text.slice(0, 300)}`
  );
  await screenshot(page, "live-mobile-preview");
  await page.close();
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  log(`Target: ${BASE_URL}`);
  log(`Artifacts: ${ARTIFACT_DIR}`);

  const browser = await createBrowser();
  try {
    await withTest("public pages and mobile overflow", () => testPublicPages(browser));
    await withTest("malformed generate JSON is retried and localized (legacy fallback)", () =>
      testGenerateMalformedJson(browser)
    );
    await withTest("job polling survives broken status JSON", () =>
      testJobFlowSurvivesBrokenStatusJson(browser)
    );
    await withTest("screenshot fallback and checkout JSON guard", () =>
      testScreenshotFallbackAndCheckoutJsonGuard(browser)
    );
    await withTest("live mobile create reaches preview", () => testLiveCreatePreview(browser));
  } finally {
    await browser.close();
  }

  const summary = {
    baseUrl: BASE_URL,
    createdAt: new Date().toISOString(),
    artifactDir: ARTIFACT_DIR,
    results,
  };
  const summaryPath = path.join(ARTIFACT_DIR, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log("\n=== E2E summary ===");
  for (const result of results) {
    console.log(
      `${result.status.padEnd(4)} ${String(result.ms).padStart(6)}ms ${result.name}${
        result.error ? ` - ${result.error}` : ""
      }`
    );
  }
  console.log(`Summary: ${summaryPath}`);

  const failed = results.filter((result) => result.status === "FAIL");
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
