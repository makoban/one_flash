#!/usr/bin/env node
/**
 * E2E ブラウザテスト: Puppeteer で実際のブラウザを操作してフルフローをテスト
 *
 * 使い方:
 *   node scripts/e2e-browser-test.mjs [url]
 *
 * デフォルト: https://onepage-flash.onrender.com
 *
 * ステップ:
 *   1. /create ページにアクセス
 *   2. 6問カードフォームに入力
 *   3. AI生成を待機（最大120秒）
 *   4. プレビュー画面のスクリーンショット撮影
 *   5. 「公開する」ボタンをクリック
 *   6. Stripe Checkout への遷移を確認
 *   7. テストカードで決済
 *   8. 完了画面のスクリーンショット撮影
 *
 * スクリーンショット保存先: C:\Users\banma\Pictures\Screenshots
 */

import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------
const BASE_URL = process.argv[2] || "https://onepage-flash.onrender.com";
const SCREENSHOT_DIR = "C:\\Users\\banma\\Pictures\\Screenshots";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// テストデータ
const TEST_DATA = {
  siteName: "E2Eテスト整体院さくら",
  catchphrase: "体の痛みを根本から改善する10年以上の実績",
  description:
    "当院は名古屋市栄にある整体院です。肩こり・腰痛・頭痛でお悩みの方はお気軽にご相談ください。丁寧なカウンセリングで一人ひとりに合った施術を提供します。完全予約制で待ち時間なし。",
  contactInfo:
    "電話: 052-000-9999\n住所: 名古屋市中区栄1-1-1\n営業時間: 9:00-20:00（日祝休み）",
  email: "e2e-browser-test@example.com",
};

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function log(step, msg) {
  const ts = new Date().toLocaleTimeString("ja-JP");
  console.log(`[${ts}] [Step ${step}] ${msg}`);
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `e2e-${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  log("-", `Screenshot: ${filePath}`);
  return filePath;
}

async function screenshotFull(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `e2e-${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  log("-", `Full screenshot: ${filePath}`);
  return filePath;
}

/** ページ上のボタンのうち、指定テキストを含むものをクリック */
async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((t) => {
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (btn.textContent && btn.textContent.includes(t) && !btn.disabled) {
        btn.click();
        return btn.textContent.trim();
      }
    }
    return null;
  }, text);
  return clicked;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------
async function main() {
  console.log("============================================================");
  console.log("  E2E Browser Test (Puppeteer + Chrome)");
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Screenshots: ${SCREENSHOT_DIR}`);
  console.log("============================================================\n");

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(CHROME_PATH)) {
    console.error(`ERROR: Chrome not found at ${CHROME_PATH}`);
    process.exit(1);
  }

  // ===== ブラウザ起動 =====
  log("0", "Launching Chrome (visible window)...");
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

  const screenshots = [];

  try {
    // ================================================================
    // Step 1: /create ページにアクセス
    // ================================================================
    log("1", `Opening ${BASE_URL}/create ...`);
    await page.goto(`${BASE_URL}/create`, { waitUntil: "networkidle2", timeout: 60000 });
    log("1", "Page loaded successfully");
    screenshots.push(await screenshot(page, "01-create-page"));

    // ================================================================
    // Step 2: 6問カードフォーム入力
    // ================================================================
    log("2", "=== Starting 6-step form ===");

    // --- Q1: 屋号・業種（input[type=text]） ---
    log("2", "Q1: Typing siteName...");
    await page.waitForSelector('input[type="text"]', { visible: true, timeout: 10000 });
    await page.type('input[type="text"]', TEST_DATA.siteName, { delay: 40 });
    await delay(300);
    screenshots.push(await screenshot(page, "02-q1-filled"));

    let clicked = await clickButtonByText(page, "次へ");
    log("2", `Q1 → Clicked: ${clicked}`);
    await delay(800);

    // --- Q2: キャッチコピー（input[type=text]） ---
    log("2", "Q2: Typing catchphrase...");
    await page.waitForSelector('input[type="text"]', { visible: true, timeout: 5000 });
    // Q2の入力欄は新しく表示されるので、空であることを確認してtype
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"]');
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) lastInput.focus();
    });
    await delay(200);
    await page.keyboard.type(TEST_DATA.catchphrase, { delay: 20 });
    await delay(300);

    clicked = await clickButtonByText(page, "次へ");
    log("2", `Q2 → Clicked: ${clicked}`);
    await delay(800);

    // --- Q3: 説明文（textarea rows=5） ---
    log("2", "Q3: Typing description...");
    await page.waitForSelector("textarea", { visible: true, timeout: 5000 });
    await page.evaluate(() => {
      const ta = document.querySelector("textarea");
      if (ta) ta.focus();
    });
    await delay(200);
    await page.keyboard.type(TEST_DATA.description, { delay: 10 });
    await delay(300);

    clicked = await clickButtonByText(page, "次へ");
    log("2", `Q3 → Clicked: ${clicked}`);
    await delay(800);

    // --- Q4: 連絡先（textarea rows=4） ---
    log("2", "Q4: Typing contactInfo...");
    await page.waitForSelector("textarea", { visible: true, timeout: 5000 });
    await page.evaluate(() => {
      const ta = document.querySelector("textarea");
      if (ta) ta.focus();
    });
    await delay(200);
    await page.keyboard.type(TEST_DATA.contactInfo, { delay: 10 });
    await delay(300);
    screenshots.push(await screenshot(page, "03-q4-filled"));

    clicked = await clickButtonByText(page, "次へ");
    log("2", `Q4 → Clicked: ${clicked}`);
    await delay(800);

    // --- Q5: カラーテーマ選択 ---
    log("2", "Q5: Selecting 'シンプル' theme...");
    // 「シンプル」を含むボタンをクリック
    const themeClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.includes("シンプル")) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    log("2", `Theme selected: ${themeClicked}`);
    await delay(500);
    screenshots.push(await screenshot(page, "04-q5-theme"));

    clicked = await clickButtonByText(page, "次へ");
    log("2", `Q5 → Clicked: ${clicked}`);
    await delay(800);

    // --- Q6: メールアドレス（input[type=email]） ---
    log("2", "Q6: Typing email...");
    await page.waitForSelector('input[type="email"]', { visible: true, timeout: 5000 });
    await page.type('input[type="email"]', TEST_DATA.email, { delay: 30 });
    await delay(300);
    screenshots.push(await screenshot(page, "05-q6-email"));

    // ================================================================
    // Step 3: 「サイトを生成する」ボタンをクリック → AI生成待機
    // ================================================================
    log("3", "Clicking 'サイトを生成する' button...");
    clicked = await clickButtonByText(page, "サイトを生成する");
    log("3", `Clicked: ${clicked}`);

    // AI生成の完了を待機（プレビュー画像が表示されるまで最大120秒）
    log("3", "Waiting for AI generation (up to 120s)...");
    const genStart = Date.now();

    try {
      await page.waitForFunction(
        () => {
          // data:image のsrcを持つimgが表示されたか
          const imgs = document.querySelectorAll("img");
          for (const img of imgs) {
            if (img.src && img.src.startsWith("data:image") && img.naturalWidth > 100) {
              return true;
            }
          }
          // または「公開する」「決済へ進む」ボタンが出現したか
          const btns = document.querySelectorAll("button");
          for (const btn of btns) {
            if (btn.textContent && btn.textContent.includes("公開")) return true;
          }
          // エラー表示があるか
          const body = document.body.innerText;
          if (body.includes("エラーが発生") || body.includes("生成に失敗")) return true;
          return false;
        },
        { timeout: 120000 }
      );
    } catch {
      log("3", "WARNING: Timed out waiting for generation.");
    }

    const genTime = ((Date.now() - genStart) / 1000).toFixed(1);
    log("3", `AI generation phase completed in ${genTime}s`);

    // ページの状態確認
    const state = await page.evaluate(() => {
      const imgs = document.querySelectorAll("img");
      let previewCount = 0;
      for (const img of imgs) {
        if (img.src && img.src.startsWith("data:image")) previewCount++;
      }
      const btns = [...document.querySelectorAll("button")];
      const publishBtn = btns.find((b) => b.textContent && b.textContent.includes("公開"));
      const errorText = document.body.innerText.includes("エラー");
      return {
        previewCount,
        hasPublishButton: !!publishBtn,
        publishButtonText: publishBtn?.textContent?.trim() ?? "",
        hasError: errorText,
        url: window.location.href,
      };
    });

    log("3", `State: previews=${state.previewCount}, publish=${state.hasPublishButton}, error=${state.hasError}`);

    screenshots.push(await screenshot(page, "06-after-generation"));
    screenshots.push(await screenshotFull(page, "06-after-generation-full"));

    if (state.hasError) {
      log("3", "ERROR detected! Taking error screenshot.");
      screenshots.push(await screenshotFull(page, "07-error-detail"));
    }

    // ================================================================
    // Step 4: プレビュー確認
    // ================================================================
    if (state.previewCount > 0) {
      log("4", `Preview images found: ${state.previewCount}`);
      await delay(1000);
      screenshots.push(await screenshot(page, "07-preview"));
    } else {
      log("4", "No preview images found. Checking page content...");
      const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      log("4", `Page text: ${pageText.substring(0, 200)}...`);
    }

    // ================================================================
    // Step 5: 「公開する」ボタンをクリック → Stripe Checkout遷移
    // ================================================================
    if (state.hasPublishButton) {
      log("5", `Clicking publish button: "${state.publishButtonText}"`);
      clicked = await clickButtonByText(page, "公開");
      log("5", `Clicked: ${clicked}`);

      // Stripe Checkout リダイレクト待ち
      log("5", "Waiting for Stripe Checkout redirect (up to 30s)...");
      try {
        await page.waitForFunction(() => window.location.href.includes("checkout.stripe.com"), {
          timeout: 30000,
        });
        const stripeUrl = page.url();
        log("6", `Redirected to Stripe Checkout!`);
        log("6", `URL: ${stripeUrl}`);
        await delay(3000); // Stripe UI 読み込み待ち
        screenshots.push(await screenshot(page, "08-stripe-checkout"));

        // ================================================================
        // Step 6: Stripe テストカード入力
        // ================================================================
        log("7", "Attempting Stripe test card entry...");

        // メールアドレス入力（Stripe Checkout画面のメールフィールド）
        try {
          const emailInput = await page.$('input#email, input[name="email"], input[autocomplete="email"]');
          if (emailInput) {
            await emailInput.click({ clickCount: 3 }); // 既存テキスト選択
            await emailInput.type(TEST_DATA.email, { delay: 30 });
            log("7", "Email entered on Stripe");
          }
        } catch {
          log("7", "Email field not found or pre-filled");
        }

        // カード番号（Stripe Elementsは iframe の中）
        try {
          // Stripe Checkout ではカード入力が iframe 内にある
          await delay(2000);
          const frames = page.frames();
          log("7", `Found ${frames.length} frames`);

          for (const frame of frames) {
            try {
              const cardInput = await frame.$(
                'input[name="cardnumber"], input[name="number"], input[placeholder*="card number"]'
              );
              if (cardInput) {
                await cardInput.type("4242424242424242", { delay: 60 });
                log("7", "Card number entered via iframe");
                break;
              }
            } catch {}
          }

          // 有効期限
          for (const frame of frames) {
            try {
              const expiryInput = await frame.$(
                'input[name="exp-date"], input[name="expiry"], input[placeholder*="MM"]'
              );
              if (expiryInput) {
                await expiryInput.type("1230", { delay: 60 });
                log("7", "Expiry entered");
                break;
              }
            } catch {}
          }

          // CVC
          for (const frame of frames) {
            try {
              const cvcInput = await frame.$('input[name="cvc"], input[placeholder*="CVC"]');
              if (cvcInput) {
                await cvcInput.type("123", { delay: 60 });
                log("7", "CVC entered");
                break;
              }
            } catch {}
          }

          // 名前
          try {
            const nameInput = await page.$(
              'input#billingName, input[name="billingName"], input[autocomplete="name"]'
            );
            if (nameInput) {
              await nameInput.click({ clickCount: 3 });
              await nameInput.type("Test User", { delay: 30 });
              log("7", "Billing name entered");
            }
          } catch {}
        } catch (err) {
          log("7", `Stripe card input issue: ${err.message}`);
        }

        await delay(1000);
        screenshots.push(await screenshot(page, "09-stripe-filled"));

        // 「申し込む」/「Subscribe」ボタンをクリック
        log("7", "Looking for Stripe submit button...");
        try {
          const submitBtn = await page.$('button[type="submit"], .SubmitButton');
          if (submitBtn) {
            const btnText = await page.evaluate((el) => el.textContent, submitBtn);
            log("7", `Found submit button: "${btnText}"`);
            // 実際に押すかどうかはユーザーの判断に任せる
            // 自動で押す場合:
            // await submitBtn.click();
            // log("7", "Clicked Stripe submit button");
            log("7", "NOT clicking submit (manual confirmation recommended)");
          }
        } catch {}

        screenshots.push(await screenshot(page, "10-stripe-ready"));

      } catch {
        log("5", "Did NOT redirect to Stripe Checkout.");
        const currentUrl = page.url();
        log("5", `Current URL: ${currentUrl}`);
        screenshots.push(await screenshot(page, "08-no-stripe"));
      }
    } else {
      log("5", "No publish button found. Cannot proceed to payment.");
    }

    // ================================================================
    // 結果サマリー
    // ================================================================
    console.log("\n============================================================");
    console.log("  E2E Browser Test Result");
    console.log("============================================================");
    console.log(`  Target:       ${BASE_URL}/create`);
    console.log(`  Final URL:    ${page.url()}`);
    console.log(`  Screenshots:  ${screenshots.length} files saved`);
    console.log(`  Save dir:     ${SCREENSHOT_DIR}`);
    console.log("------------------------------------------------------------");
    for (const s of screenshots) {
      console.log(`    ${path.basename(s)}`);
    }
    console.log("============================================================");

    // ブラウザを60秒間開いたままにする
    log("-", "Browser stays open for 60s. Press Ctrl+C to close.");
    await delay(60000);

  } catch (err) {
    console.error(`\nFATAL ERROR: ${err.message}`);
    try {
      await screenshotFull(page, "99-fatal-error");
    } catch {}
  } finally {
    await browser.close();
    log("-", "Browser closed.");
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
