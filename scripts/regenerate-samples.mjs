/**
 * サンプルサイト再生成スクリプト
 *
 * 本番APIを使用して5業種のサンプルHTMLを再生成し、
 * R2にpublish、スクリーンショットを取得してpublic/samplesに保存する。
 *
 * Usage: node scripts/regenerate-samples.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(__dirname, "../public/samples");

const BASE_URL = "https://onepage-flash.onrender.com";

const SAMPLES = [
  {
    slug: "sample-tax",
    imgIndex: 1,
    formData: {
      siteName: "山田太郎税理士事務所",
      catchphrase: "創業30年の信頼と実績。あなたの事業を税務のプロが全力サポートします。",
      description: "名古屋市天白区にある山田太郎税理士事務所です。法人・個人の確定申告、記帳代行、税務相談、会社設立支援まで幅広く対応。「わかりやすい説明」をモットーに、初回相談無料で承っております。開業届の書き方から節税対策まで、何でもお気軽にご相談ください。",
      contactInfo: "電話: 052-123-4567\nメール: info@yamada-tax.example.com\n住所: 愛知県名古屋市天白区原3-304-1\n営業時間: 平日 9:00〜18:00",
      colorTheme: "business",
      email: "sample@example.com",
      subdomain: "sample-tax",
    },
  },
  {
    slug: "sample-bloom",
    imgIndex: 2,
    formData: {
      siteName: "hair salon Bloom",
      catchphrase: "あなたらしさが花開く、特別なひととき。",
      description: "名古屋市千種区の美容室Bloomです。カット・カラー・パーマ・トリートメントなど、お客様一人ひとりの髪質やライフスタイルに合わせたスタイルをご提案します。オーガニックカラー取り扱い店。完全予約制で、ゆったりとした空間で施術をお楽しみいただけます。ヘッドスパも人気です。",
      contactInfo: "電話: 052-765-4321\nメール: info@bloom-hair.example.com\n住所: 名古屋市千種区今池1-2-3\n営業時間: 火〜日 10:00〜19:00（月曜定休）",
      colorTheme: "colorful",
      email: "sample@example.com",
      subdomain: "sample-bloom",
    },
  },
  {
    slug: "sample-karada",
    imgIndex: 3,
    formData: {
      siteName: "からだ整体院",
      catchphrase: "つらい痛みを根本から改善。10年以上の施術実績。",
      description: "名古屋市緑区のからだ整体院です。腰痛・肩こり・頭痛・膝の痛みなど、お身体の不調を根本原因からアプローチいたします。国家資格保有の院長が一人ひとり丁寧にカウンセリング。骨盤矯正・猫背矯正・産後ケアも好評です。初回限定クーポンあり。お子様連れも歓迎です。",
      contactInfo: "電話: 052-876-5432\nメール: info@karada-seitai.example.com\n住所: 名古屋市緑区大高台2-5-10\n営業時間: 月〜土 9:00〜20:00（日祝休み）",
      colorTheme: "simple",
      email: "sample@example.com",
      subdomain: "sample-karada",
    },
  },
  {
    slug: "sample-komorebi",
    imgIndex: 4,
    formData: {
      siteName: "Cafe こもれび",
      catchphrase: "木漏れ日のような、あたたかいひとときを。",
      description: "名古屋市昭和区の隠れ家カフェ「こもれび」です。自家焙煎のスペシャルティコーヒーと手作りスイーツをお楽しみいただけます。モーニングセットは7:30から。ランチはパスタ・サンドイッチ・週替わりプレートをご用意。Wi-Fi完備、電源席あり。お一人様でもグループでもくつろげる空間です。",
      contactInfo: "電話: 052-345-6789\nメール: info@cafe-komorebi.example.com\n住所: 名古屋市昭和区御器所3-15-8\n営業時間: 7:30〜18:00（水曜定休）",
      colorTheme: "colorful",
      email: "sample@example.com",
      subdomain: "sample-komorebi",
    },
  },
  {
    slug: "sample-shanti",
    imgIndex: 5,
    formData: {
      siteName: "Yoga Studio Shanti",
      catchphrase: "心も身体も、本来の自分に還る場所。",
      description: "名古屋市名東区のヨガスタジオShantiです。初心者から上級者まで楽しめるクラスを毎日開催。ハタヨガ・ヴィンヤサ・リストラティブ・マタニティヨガなど、多彩なプログラムをご用意しています。少人数制で丁寧な指導。体験レッスン1,000円。オンラインクラスも対応中。レンタルマットあり、手ぶらでOK。",
      contactInfo: "電話: 052-234-5678\nメール: info@shanti-yoga.example.com\n住所: 名古屋市名東区藤が丘2-8-15\n営業時間: 月〜日 8:00〜21:00（不定休）",
      colorTheme: "simple",
      email: "sample@example.com",
      subdomain: "sample-shanti",
    },
  },
];

async function regenerateSample(sample, index) {
  const total = SAMPLES.length;
  console.log(`\n[${ index + 1}/${total}] ${sample.formData.siteName} (${sample.slug})`);

  // Step 1: Generate HTML
  console.log("  -> Generating HTML via Gemini...");
  const genRes = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formData: sample.formData }),
  });

  if (!genRes.ok) {
    const err = await genRes.json();
    throw new Error(`Generate failed for ${sample.slug}: ${JSON.stringify(err)}`);
  }

  const { html } = await genRes.json();
  console.log(`  -> HTML generated (${html.length} chars)`);

  // Step 2: Publish to R2
  console.log("  -> Publishing to R2...");
  const pubRes = await fetch(`${BASE_URL}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      subdomain: sample.slug,
      formData: sample.formData,
      email: sample.formData.email,
    }),
  });

  if (!pubRes.ok) {
    const err = await pubRes.json();
    throw new Error(`Publish failed for ${sample.slug}: ${JSON.stringify(err)}`);
  }

  const pubResult = await pubRes.json();
  console.log(`  -> Published: ${pubResult.url}`);

  // Step 3: Screenshot
  console.log("  -> Taking screenshot...");
  const ssRes = await fetch(`${BASE_URL}/api/screenshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });

  if (!ssRes.ok) {
    const err = await ssRes.json();
    console.warn(`  ⚠ Screenshot failed for ${sample.slug}: ${JSON.stringify(err)}`);
    console.warn("  -> Skipping screenshot, HTML was still published successfully.");
    return;
  }

  const { pcImage } = await ssRes.json();

  // Save PC screenshot
  const base64Data = pcImage.replace(/^data:image\/png;base64,/, "");
  const outPath = path.join(SAMPLES_DIR, `pc-${sample.imgIndex}.png`);
  fs.writeFileSync(outPath, Buffer.from(base64Data, "base64"));
  console.log(`  -> Screenshot saved: ${outPath}`);
}

async function main() {
  console.log("=== OnePage-Flash サンプル再生成 ===");
  console.log(`Production URL: ${BASE_URL}`);
  console.log(`Output dir: ${SAMPLES_DIR}`);

  // Ensure output dir exists
  if (!fs.existsSync(SAMPLES_DIR)) {
    fs.mkdirSync(SAMPLES_DIR, { recursive: true });
  }

  for (let i = 0; i < SAMPLES.length; i++) {
    try {
      await regenerateSample(SAMPLES[i], i);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      console.error("  -> Continuing to next sample...");
    }
  }

  console.log("\n=== 完了 ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
