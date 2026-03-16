#!/usr/bin/env node
/**
 * E2E ブラウザテスト: adminモードでサイト作成（美容室）
 */
import puppeteer from "puppeteer-core";
import path from "path";

const BASE_URL = "https://oneflash.bantex.jp";
const ADMIN_PW = "Passpass7200";
const SCREENSHOT_DIR = "C:\\Users\\banma\\Pictures\\Screenshots";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const TEST_DATA = {
  siteName: "テスト美容室 Bella",
  catchphrase: "あなたらしい美しさを、引き出す場所",
  description:
    "名古屋市栄にあるプライベートヘアサロンです。マンツーマン施術で、カット・カラー・トリートメントをお一人おひとりに合わせてご提案します。オーガニック製品を使用し、髪と頭皮に優しい施術を心がけています。",
  contactInfo:
    "電話: 052-000-8888\n住所: 名古屋市中区栄3-5-1\n営業時間: 10:00-20:00\n定休日: 火曜日",
  email: "e2e-admin-test@example.com",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function log(step, msg) {
  console.log(`[${new Date().toLocaleTimeString("ja-JP")}] [${step}] ${msg}`);
}
async function snap(page, name) {
  const p = path.join(SCREENSHOT_DIR, `e2e-admin-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  log("-", `Screenshot: e2e-admin-${name}.png`);
}

// 「次へ」ボタンをクリック
async function clickNext(page) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const next = btns.find((b) => b.textContent.trim() === "次へ");
    if (next) next.click();
  });
}

// 現在のステップのinputまたはtextareaに入力
async function typeIntoField(page, text, isTextarea = false) {
  const selector = isTextarea ? "textarea" : 'input[type="text"]';
  await page.waitForSelector(selector, { visible: true });
  await delay(500);
  // フィールドをクリアしてから入力
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) { el.value = ""; el.focus(); }
  }, selector);
  await page.type(selector, text, { delay: 15 });
}

async function main() {
  console.log("===========================================");
  console.log("  E2E: adminモード サイト作成（ブラウザ）");
  console.log("===========================================\n");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(120_000);

  try {
    // Step 1: adminモード アクセス → Q1 屋号入力
    log(1, "adminモードでアクセス...");
    await page.goto(`${BASE_URL}/create?mode=admin&pw=${ADMIN_PW}`, { waitUntil: "networkidle2" });
    await delay(2000);
    log(1, `Q1: 屋号 → "${TEST_DATA.siteName}"`);
    await typeIntoField(page, TEST_DATA.siteName);
    await delay(300);
    await snap(page, "01-q1");
    await clickNext(page);
    await delay(2000);

    // Step 2: Q2 キャッチコピー
    log(2, `Q2: キャッチコピー → "${TEST_DATA.catchphrase}"`);
    await typeIntoField(page, TEST_DATA.catchphrase);
    await delay(300);
    await snap(page, "02-q2");
    await clickNext(page);
    await delay(4000); // モデレーションチェック待ち

    // Step 3: Q3 説明文
    log(3, "Q3: 説明文入力...");
    await typeIntoField(page, TEST_DATA.description, true);
    await delay(300);
    await snap(page, "03-q3");
    await clickNext(page);
    await delay(4000); // モデレーションチェック待ち

    // Step 4: Q4 連絡先
    log(4, "Q4: 連絡先入力...");
    await typeIntoField(page, TEST_DATA.contactInfo, true);
    await delay(300);
    await snap(page, "04-q4");
    await clickNext(page);
    await delay(2000);

    // Step 5: Q5 テーマ選択（adminモードではメール不要・最終ステップ）
    log(5, "Q5: テーマ選択...");
    await snap(page, "05-q5-before");

    // テーマ選択（ソフトブロッサム）
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll("button, div, label")];
      const blossom = cards.find((c) => c.textContent.includes("ソフトブロッサム"));
      if (blossom) blossom.click();
    });
    await delay(1000);
    await snap(page, "06-q5-selected");

    // 「AIで作成する」ボタン（adminモードではstep5が最終）
    log(5, "作成ボタンをクリック...");
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const create = btns.find((b) => {
        const t = b.textContent.trim();
        return t.includes("作成") || t.includes("生成");
      });
      if (create) create.click();
    });

    // Step 6: AI生成待機
    log(6, "AI生成中...（最大120秒）");
    await delay(5000);
    await snap(page, "07-generating");

    // プレビューページまたは公開ボタンが出るまで待機
    for (let i = 0; i < 24; i++) {
      const url = page.url();
      const html = await page.content();
      if (url.includes("preview") || html.includes("公開する") || html.includes("サイトを公開")) {
        log(6, `生成完了！ (${(i + 1) * 5}秒)`);
        break;
      }
      if (i === 23) log(6, "⚠ タイムアウト - 続行");
      await delay(5000);
    }
    await snap(page, "08-preview");

    // Step 7: 公開ボタンをクリック
    log(7, "公開ボタンを探してクリック...");
    await delay(2000);
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button, a")];
      const pub = btns.find((b) => {
        const t = b.textContent.trim();
        return t.includes("公開する") || t.includes("サイトを公開");
      });
      if (pub) pub.click();
    });

    // 公開完了待機
    await delay(15000);
    await snap(page, "09-published");

    // Step 8: 結果
    log(8, `最終URL: ${page.url()}`);
    const finalHtml = await page.content();
    const urlMatch = finalHtml.match(/https?:\/\/[^\s"'<>]*(?:oneflash|workers\.dev)[^\s"'<>]*/);
    if (urlMatch) log(8, `公開URL: ${urlMatch[0]}`);
    await snap(page, "10-final");

    console.log("\n=== E2E 完了 ===");
    console.log("ブラウザは開いたままです。確認後 Ctrl+C で終了。");
    await new Promise(() => {});

  } catch (err) {
    console.error("\n❌ エラー:", err.message);
    await snap(page, "error");
    console.log("ブラウザは開いたままです。確認後 Ctrl+C で終了。");
    await new Promise(() => {});
  }
}

main().catch(console.error);
