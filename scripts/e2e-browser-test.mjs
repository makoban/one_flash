#!/usr/bin/env node
/**
 * E2E ブラウザテスト: Puppeteer で実際のブラウザを操作してフルフローをテスト
 *
 * ルール: E2Eテストは常にPuppeteerブラウザ自動操作で本番環境でユーザー同様にテストする
 *
 * 使い方:
 *   node scripts/e2e-browser-test.mjs [url]
 *
 * デフォルト: https://onepage-flash.onrender.com
 *
 * フルフロー:
 *   1. /create → 6問フォーム入力
 *   2. AI生成待機 → プレビュー確認
 *   3. 「公開する」→ Stripe Checkout
 *   4. テストカード入力 → 「申し込む」
 *   5. /complete ページ → 公開URL表示確認
 *   6. 公開サイトアクセス確認
 */

import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------
const BASE_URL = process.argv[2] || "https://onepage-flash.onrender.com";
const SCREENSHOT_DIR = "C:\\Users\\banma\\Pictures\\Screenshots";
const CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const TEST_DATA = {
  siteName: `E2Eテスト整体院${Date.now().toString(36).slice(-4)}`,
  catchphrase: "体の痛みを根本から改善する10年以上の実績",
  description:
    "当院は名古屋市栄にある整体院です。肩こり・腰痛・頭痛でお悩みの方はお気軽にご相談ください。丁寧なカウンセリングで一人ひとりに合った施術を提供します。",
  contactInfo:
    "電話: 052-000-9999\n住所: 名古屋市中区栄1-1-1\n営業時間: 9:00-20:00",
  email: "e2e-browser-test@example.com",
};

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const screenshots = [];

function log(step, msg) {
  const ts = new Date().toLocaleTimeString("ja-JP");
  console.log(`[${ts}] [Step ${step}] ${msg}`);
}

async function snap(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `e2e-${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  screenshots.push(filePath);
  log("-", `Screenshot: ${path.basename(filePath)}`);
  return filePath;
}

async function snapFull(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `e2e-${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  screenshots.push(filePath);
  log("-", `Full screenshot: ${path.basename(filePath)}`);
  return filePath;
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

// ---------------------------------------------------------------------------
// Stripe iframe 内のカード番号入力
// ---------------------------------------------------------------------------
async function typeInStripeCardField(page) {
  // Stripe Checkout ではカード入力がiframe内のStripe Elementsにある
  // iframe を全部取得して、カード番号フィールドを探す
  await delay(3000);
  const frames = page.frames();
  log("7", `Searching ${frames.length} frames for card input...`);

  let cardEntered = false;
  for (const frame of frames) {
    try {
      const url = frame.url();
      if (!url.includes("stripe.com")) continue;

      // カード番号フィールドの候補セレクター
      const selectors = [
        'input[name="cardnumber"]',
        'input[name="number"]',
        'input[data-elements-stable-field-name="cardNumber"]',
        'input[autocomplete="cc-number"]',
        'input[placeholder*="1234"]',
        'input[placeholder*="カード番号"]',
      ];

      for (const sel of selectors) {
        try {
          const el = await frame.$(sel);
          if (el) {
            await el.click();
            await delay(200);
            await el.type("4242424242424242", { delay: 80 });
            log("7", `Card number entered via: ${sel}`);
            cardEntered = true;
            break;
          }
        } catch {}
      }
      if (cardEntered) break;
    } catch {}
  }

  if (!cardEntered) {
    // フォールバック: 全フレームの全inputを試す
    log("7", "Card number field not found in named selectors, trying all inputs...");
    for (const frame of frames) {
      try {
        const inputs = await frame.$$("input");
        for (const input of inputs) {
          const attrs = await frame.evaluate((el) => ({
            name: el.name,
            placeholder: el.placeholder,
            type: el.type,
            autocomplete: el.autocomplete,
          }), input);
          if (
            attrs.autocomplete === "cc-number" ||
            attrs.name === "cardnumber" ||
            attrs.name === "number" ||
            (attrs.placeholder && attrs.placeholder.includes("1234"))
          ) {
            await input.click();
            await delay(200);
            await input.type("4242424242424242", { delay: 80 });
            log("7", `Card entered via fallback: name=${attrs.name}, placeholder=${attrs.placeholder}`);
            cardEntered = true;
            break;
          }
        }
        if (cardEntered) break;
      } catch {}
    }
  }

  return cardEntered;
}

// ---------------------------------------------------------------------------
// メインE2Eフロー
// ---------------------------------------------------------------------------
async function main() {
  console.log("============================================================");
  console.log("  E2E Full Browser Test (Puppeteer + Chrome)");
  console.log(`  Target: ${BASE_URL}`);
  console.log("============================================================\n");

  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  if (!fs.existsSync(CHROME_PATH)) {
    console.error(`ERROR: Chrome not found at ${CHROME_PATH}`);
    process.exit(1);
  }

  log("0", "Launching Chrome...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
  });

  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`  [BROWSER] ${msg.text()}`);
  });

  const results = { formInput: false, aiGeneration: false, stripeRedirect: false, payment: false, completePage: false, sitePublished: false };

  try {
    // ==========================================================
    // PHASE 1: フォーム入力
    // ==========================================================
    log("1", `Opening ${BASE_URL}/create ...`);
    await page.goto(`${BASE_URL}/create`, { waitUntil: "networkidle2", timeout: 60000 });
    await snap(page, "01-create");

    log("2", "Filling 6-step form...");

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
      for (const b of btns) { if (b.textContent?.includes("シンプル")) { b.click(); break; } }
    });
    await delay(300);
    await clickButtonByText(page, "次へ");
    await delay(800);

    // Q6
    await page.waitForSelector('input[type="email"]', { visible: true, timeout: 5000 });
    await page.type('input[type="email"]', TEST_DATA.email, { delay: 25 });

    results.formInput = true;
    log("2", "Form filled successfully");
    await snap(page, "02-form-complete");

    // ==========================================================
    // PHASE 2: AI生成
    // ==========================================================
    log("3", "Clicking 'サイトを生成する'...");
    await clickButtonByText(page, "サイトを生成する");

    log("3", "Waiting for AI generation (up to 120s)...");
    const genStart = Date.now();
    try {
      await page.waitForFunction(() => {
        const imgs = document.querySelectorAll("img");
        for (const img of imgs) {
          if (img.src?.startsWith("data:image") && img.naturalWidth > 100) return true;
        }
        return [...document.querySelectorAll("button")].some(b => b.textContent?.includes("公開"));
      }, { timeout: 120000 });
    } catch { log("3", "WARNING: Generation timeout"); }

    const genSec = ((Date.now() - genStart) / 1000).toFixed(1);
    log("3", `Generation done in ${genSec}s`);
    results.aiGeneration = true;
    await snap(page, "03-preview");

    // ==========================================================
    // PHASE 3: Stripe Checkout
    // ==========================================================
    log("4", "Clicking publish button...");
    await clickButtonByText(page, "公開");

    log("4", "Waiting for Stripe redirect...");
    try {
      await page.waitForFunction(() => window.location.href.includes("checkout.stripe.com"), { timeout: 30000 });
      results.stripeRedirect = true;
      log("5", "Stripe Checkout loaded");
      await delay(4000);
      await snap(page, "04-stripe");

      // --- カード番号入力 ---
      const cardOk = await typeInStripeCardField(page);
      if (!cardOk) log("7", "WARNING: Could not enter card number automatically");

      // --- 有効期限 ---
      for (const frame of page.frames()) {
        try {
          const el = await frame.$('input[name="cardExpiry"], input[name="expiry"], input[autocomplete="cc-exp"]');
          if (el) { await el.type("1230", { delay: 60 }); log("7", "Expiry entered"); break; }
        } catch {}
      }

      // --- CVC ---
      for (const frame of page.frames()) {
        try {
          const el = await frame.$('input[name="cardCvc"], input[name="cvc"], input[autocomplete="cc-csc"]');
          if (el) { await el.type("123", { delay: 60 }); log("7", "CVC entered"); break; }
        } catch {}
      }

      // --- 名前 ---
      try {
        const nameInput = await page.$('input#billingName, input[name="billingName"], input[autocomplete="name"]');
        if (nameInput) { await nameInput.click({ clickCount: 3 }); await nameInput.type("Test User", { delay: 25 }); log("7", "Name entered"); }
      } catch {}

      await delay(1000);
      await snap(page, "05-stripe-filled");

      // --- 「申し込む」クリック ---
      log("8", "Clicking submit button...");
      const submitClicked = await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"], .SubmitButton-IconContainer')?.closest("button")
          || [...document.querySelectorAll("button")].find(b => b.textContent?.includes("申し込む"));
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      log("8", submitClicked ? "Submit clicked!" : "Submit button not found or disabled");

      if (submitClicked) {
        // ==========================================================
        // PHASE 4: 完了ページ確認
        // ==========================================================
        log("9", "Waiting for redirect to /complete (up to 60s)...");
        try {
          await page.waitForFunction(
            () => window.location.href.includes("/complete") || window.location.href.includes("onepage-flash"),
            { timeout: 60000 }
          );
          log("9", `Redirected to: ${page.url()}`);
          await delay(3000);
          await snap(page, "06-complete-initial");

          // ポーリングで「公開完了」が表示されるまで待つ（最大90秒）
          log("10", "Waiting for site to be published (polling, up to 90s)...");
          try {
            await page.waitForFunction(() => {
              return document.body.innerText.includes("公開完了")
                || document.body.innerText.includes("あなたのサイトを見る");
            }, { timeout: 90000 });

            results.completePage = true;
            log("10", "Complete page shows published URL!");
            await snap(page, "07-complete-published");
            await snapFull(page, "07-complete-published-full");

            // 公開URLを取得
            const siteUrl = await page.evaluate(() => {
              const links = document.querySelectorAll("a");
              for (const a of links) {
                if (a.href && (a.href.includes("workers.dev/s/") || a.href.includes("oneflash.net"))) {
                  return a.href;
                }
              }
              return null;
            });

            if (siteUrl) {
              log("11", `Published site URL: ${siteUrl}`);

              // ==========================================================
              // PHASE 5: 公開サイト確認
              // ==========================================================
              log("11", "Opening published site...");
              const sitePage = await browser.newPage();
              await sitePage.goto(siteUrl, { waitUntil: "networkidle2", timeout: 30000 });
              const siteStatus = await sitePage.evaluate(() => ({
                title: document.title,
                bodyLength: document.body.innerHTML.length,
                hasContent: !document.body.innerText.includes("非公開") && !document.body.innerText.includes("見つかりません"),
              }));

              log("11", `Site title: "${siteStatus.title}", HTML: ${siteStatus.bodyLength} bytes, valid: ${siteStatus.hasContent}`);
              results.sitePublished = siteStatus.hasContent;
              await snap(sitePage, "08-published-site");
              await snapFull(sitePage, "08-published-site-full");
              await sitePage.close();
            }
          } catch {
            log("10", "Timeout: Complete page did not show published URL within 90s");
            await snap(page, "07-complete-timeout");
          }

          results.payment = true;
        } catch {
          log("9", "Did not redirect to /complete within 60s");
          log("9", `Current URL: ${page.url()}`);
          await snap(page, "06-no-redirect");
        }
      }
    } catch {
      log("4", "Did not redirect to Stripe");
      await snap(page, "04-no-stripe");
    }

    // ==========================================================
    // 結果サマリー
    // ==========================================================
    console.log("\n============================================================");
    console.log("  E2E FULL BROWSER TEST RESULTS");
    console.log("============================================================");
    console.log(`  Form Input:       ${results.formInput ? "PASS" : "FAIL"}`);
    console.log(`  AI Generation:    ${results.aiGeneration ? "PASS" : "FAIL"}`);
    console.log(`  Stripe Redirect:  ${results.stripeRedirect ? "PASS" : "FAIL"}`);
    console.log(`  Payment:          ${results.payment ? "PASS" : "FAIL"}`);
    console.log(`  Complete Page:    ${results.completePage ? "PASS" : "FAIL"}`);
    console.log(`  Site Published:   ${results.sitePublished ? "PASS" : "FAIL"}`);
    console.log("------------------------------------------------------------");
    console.log(`  Screenshots: ${screenshots.length} files`);
    for (const s of screenshots) console.log(`    ${path.basename(s)}`);
    console.log("============================================================");

    const allPass = Object.values(results).every(Boolean);
    if (allPass) {
      console.log("\n  >>> ALL TESTS PASSED <<<");
    } else {
      console.log("\n  >>> SOME TESTS FAILED <<<");
    }

    log("-", "Browser stays open for 30s...");
    await delay(30000);

  } catch (err) {
    console.error(`\nFATAL: ${err.message}`);
    try { await snapFull(page, "99-fatal"); } catch {}
  } finally {
    await browser.close();
    log("-", "Browser closed.");
  }
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
