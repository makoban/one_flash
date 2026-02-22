#!/usr/bin/env node
/**
 * E2E ライブモード検証テスト
 *
 * Stripe が本番モード（テストモードでないこと）を確認するブラウザテスト。
 * 実際の決済は行わない（Checkout画面の表示確認のみ）。
 *
 * 使い方:
 *   node scripts/e2e-live-mode-check.mjs [url]
 */

import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const BASE_URL = process.argv[2] || "https://onepage-flash.onrender.com";
const SCREENSHOT_DIR = "C:\\Users\\banma\\Pictures\\Screenshots";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const TEST_DATA = {
  siteName: `ライブモード検証${Date.now().toString(36).slice(-4)}`,
  catchphrase: "体の痛みを根本から改善する10年以上の実績",
  description:
    "当院は名古屋市栄にある整体院です。肩こり・腰痛・頭痛でお悩みの方はお気軽にご相談ください。",
  contactInfo: "電話: 052-000-9999\n住所: 名古屋市中区栄1-1-1\n営業時間: 9:00-20:00",
  email: "live-mode-check@example.com",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const screenshots = [];

function log(step, msg) {
  const ts = new Date().toLocaleTimeString("ja-JP");
  console.log(`[${ts}] [${step}] ${msg}`);
}

async function snap(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `e2e-live-${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  screenshots.push(filePath);
  log("-", `Screenshot: ${path.basename(filePath)}`);
}

async function clickButtonByText(page, text) {
  return page.evaluate((t) => {
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (btn.textContent && btn.textContent.includes(t) && !btn.disabled) {
        btn.click();
        return btn.textContent.trim();
      }
    }
    return null;
  }, text);
}

async function main() {
  console.log("============================================================");
  console.log("  Stripe LIVE MODE Verification Test");
  console.log(`  Target: ${BASE_URL}`);
  console.log("============================================================\n");

  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  log("0", "Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
  });

  const page = await browser.newPage();
  const results = {
    formInput: false,
    aiGeneration: false,
    stripeRedirect: false,
    isLiveMode: false,
    noPkTest: false,
  };

  try {
    // === PHASE 1: フォーム入力 ===
    log("1", `Opening ${BASE_URL}/create ...`);
    await page.goto(`${BASE_URL}/create`, { waitUntil: "networkidle2", timeout: 60000 });
    await snap(page, "01-create");

    log("2", "Filling form...");

    // Q1
    await page.waitForSelector('input[type="text"]', { visible: true, timeout: 10000 });
    await page.type('input[type="text"]', TEST_DATA.siteName, { delay: 30 });
    await clickButtonByText(page, "次へ");
    await delay(800);

    // Q2
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"]');
      inputs[inputs.length - 1]?.focus();
    });
    await delay(200);
    await page.keyboard.type(TEST_DATA.catchphrase, { delay: 15 });
    await clickButtonByText(page, "次へ");
    await delay(800);

    // Q3
    await page.waitForSelector("textarea", { visible: true, timeout: 5000 });
    await page.evaluate(() => document.querySelector("textarea")?.focus());
    await delay(200);
    await page.keyboard.type(TEST_DATA.description, { delay: 8 });
    await clickButtonByText(page, "次へ");
    await delay(800);

    // Q4
    await page.waitForSelector("textarea", { visible: true, timeout: 5000 });
    await page.evaluate(() => document.querySelector("textarea")?.focus());
    await delay(200);
    await page.keyboard.type(TEST_DATA.contactInfo, { delay: 8 });
    await clickButtonByText(page, "次へ");
    await delay(800);

    // Q5
    await page.evaluate(() => {
      const btns = document.querySelectorAll("button");
      for (const b of btns) {
        if (b.textContent?.includes("シンプル")) { b.click(); break; }
      }
    });
    await delay(300);
    await clickButtonByText(page, "次へ");
    await delay(800);

    // Q6
    await page.waitForSelector('input[type="email"]', { visible: true, timeout: 5000 });
    await page.type('input[type="email"]', TEST_DATA.email, { delay: 25 });

    results.formInput = true;
    log("2", "Form filled");
    await snap(page, "02-form");

    // === PHASE 2: AI生成 ===
    log("3", "Clicking generate...");
    await clickButtonByText(page, "サイトを生成する");

    log("3", "Waiting for AI generation (up to 120s)...");
    const genStart = Date.now();
    await page.waitForFunction(() => {
      const imgs = document.querySelectorAll("img");
      for (const img of imgs) {
        if (img.src?.startsWith("data:image") && img.naturalWidth > 100) return true;
      }
      return [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("公開"));
    }, { timeout: 120000 });

    log("3", `Generated in ${((Date.now() - genStart) / 1000).toFixed(1)}s`);
    results.aiGeneration = true;
    await snap(page, "03-preview");

    // === PHASE 3: Stripe Checkout ===
    log("4", "Clicking publish...");
    await clickButtonByText(page, "公開");

    log("4", "Waiting for Stripe redirect...");
    await page.waitForFunction(
      () => window.location.href.includes("checkout.stripe.com"),
      { timeout: 30000 }
    );
    results.stripeRedirect = true;
    log("5", `Stripe Checkout URL: ${page.url()}`);
    await delay(5000);
    await snap(page, "04-stripe-checkout");

    // === PHASE 4: ライブモード判定 ===
    log("6", "Checking for TEST MODE indicators...");

    // チェック1: URLに"test"が含まれていないか
    const checkoutUrl = page.url();
    const urlHasTest = checkoutUrl.includes("/test/");
    log("6", `URL contains /test/: ${urlHasTest}`);

    // チェック2: ページに"テストモード"/"TEST MODE"/"test mode"表示がないか
    const testModeVisible = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return (
        text.includes("test mode") ||
        text.includes("テストモード") ||
        text.includes("テスト モード")
      );
    });
    log("6", `"Test mode" text visible: ${testModeVisible}`);

    // チェック3: pk_live がHTMLソースに含まれているか（デバッグ用）
    const pageSource = await page.content();
    const hasPkLive = pageSource.includes("pk_live");
    const hasPkTest = pageSource.includes("pk_test");
    log("6", `pk_live in source: ${hasPkLive}`);
    log("6", `pk_test in source: ${hasPkTest}`);

    results.isLiveMode = !testModeVisible && !urlHasTest;
    results.noPkTest = !hasPkTest;

    await snap(page, "05-live-mode-check");

    // Stripe Checkout ページの表示内容を確認
    const pageInfo = await page.evaluate(() => {
      const amounts = [];
      document.querySelectorAll("[class*='Amount'], [class*='amount'], [class*='price'], [data-testid*='total']").forEach((el) => {
        if (el.textContent.trim()) amounts.push(el.textContent.trim());
      });
      return {
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        amounts,
      };
    });
    log("6", `Page title: ${pageInfo.title}`);
    log("6", `Page text (first 300 chars): ${pageInfo.bodyText.substring(0, 300)}`);

    // === 結果 ===
    console.log("\n============================================================");
    console.log("  STRIPE LIVE MODE CHECK RESULTS");
    console.log("============================================================");
    console.log(`  Form Input:        ${results.formInput ? "PASS" : "FAIL"}`);
    console.log(`  AI Generation:     ${results.aiGeneration ? "PASS" : "FAIL"}`);
    console.log(`  Stripe Redirect:   ${results.stripeRedirect ? "PASS" : "FAIL"}`);
    console.log(`  Live Mode:         ${results.isLiveMode ? "PASS (NO test mode badge)" : "FAIL (test mode detected)"}`);
    console.log(`  No pk_test:        ${results.noPkTest ? "PASS" : "FAIL (pk_test found in source)"}`);
    console.log("------------------------------------------------------------");
    console.log(`  Screenshots: ${screenshots.length} files`);
    for (const s of screenshots) console.log(`    ${path.basename(s)}`);
    console.log("============================================================");

    const allPass = Object.values(results).every(Boolean);
    if (allPass) {
      console.log("\n  >>> LIVE MODE CONFIRMED - ALL CHECKS PASSED <<<");
      console.log("  NOTE: No payment was made. Stripe is in production mode.");
    } else {
      console.log("\n  >>> SOME CHECKS FAILED <<<");
    }

    log("-", "Browser stays open for 15s for visual confirmation...");
    await delay(15000);

  } catch (err) {
    console.error(`\nFATAL: ${err.message}`);
    try { await snap(page, "99-fatal"); } catch {}
    await delay(10000);
  } finally {
    await browser.close();
    log("-", "Browser closed.");
  }
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
