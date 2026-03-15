/**
 * テンプレートエンジン
 *
 * antigravity制作のHTMLテンプレートに対して:
 * 1. {{変数名}} を実データに置換
 * 2. <!--SECTION_START-->〜<!--SECTION_END--> のON/OFF制御
 * 3. サービス4件・特徴3件の動的表示
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export interface TemplateInput {
  // テーマ選択
  theme: string;

  // 基本情報
  siteName: string;
  catchphrase: string;
  descriptionShort: string;

  // 画像
  heroImageOption: "default" | "custom" | "none";
  heroImageCustomUrl?: string;

  // 連絡先
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  holiday?: string;

  // サービス（2〜4件）
  services: Array<{ title: string; desc: string }>;

  // 特徴（3件）
  features: Array<{ title: string; desc: string }>;

  // ON/OFF
  formEnabled: boolean;
  formActionUrl?: string;
  mapEnabled: boolean;
  mapEmbedUrl?: string;

  // SNS
  instagramUrl?: string;
  youtubeUrl?: string;
  xUrl?: string;
  lineUrl?: string;
  facebookUrl?: string;
}

// ---------------------------------------------------------------------------
// テーマ別デフォルト画像URL（R2にアップロード済みの画像パス）
// ---------------------------------------------------------------------------

const DEFAULT_HERO_IMAGES: Record<string, string> = {
  "clean-light": "/images/clean-light-hero.png",
  "royal-navy": "/images/royal-navy-hero.png",
  "bloom-pink": "/images/bloom-pink-hero.png",
  "soft-blossom": "/images/soft-blossom-hero.png",
  "sunset-cafe": "/images/sunset-cafe-hero.png",
  "dark-dining": "/images/dark-dining-hero.png",
  "trust-blue": "/images/trust-blue-hero.png",
  "modern-minimal": "/images/modern-minimal-hero.png",
  "pop-school": "/images/pop-school-hero.png",
  "blueprint": "/images/blueprint-hero.png",
  "free-wave": "/images/free-wave-hero.png",
  "executive": "/images/executive-hero.png",
  "gentle-green": "/images/gentle-green-hero.png",
  "botanical-bloom": "/images/botanical-bloom-hero.png",
  "power-red": "/images/power-red-hero.png",
  "wa-traditional": "/images/wa-traditional-hero.png",
  "tech-neon": "/images/tech-neon-hero.png",
  "realestate-white": "/images/realestate-white-hero.png",
  "pastel-kids": "/images/pastel-kids-hero.png",
  "metal-garage": "/images/metal-garage-hero.png",
  "elegant-music": "/images/elegant-music-hero.png",
  "earth-farm": "/images/earth-farm-hero.png",
  "calm-purple": "/images/calm-purple-hero.png",
  "dynamic-sports": "/images/dynamic-sports-hero.png",
};

// ---------------------------------------------------------------------------
// テンプレート読み込み
// ---------------------------------------------------------------------------

export function loadTemplate(theme: string): string {
  const templatePath = path.join(process.cwd(), "src", "templates", `${theme}.html`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${theme}`);
  }
  return fs.readFileSync(templatePath, "utf-8");
}

export function getAvailableThemes(): string[] {
  const templatesDir = path.join(process.cwd(), "src", "templates");
  return fs.readdirSync(templatesDir)
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(".html", ""));
}

// ---------------------------------------------------------------------------
// メインエンジン
// ---------------------------------------------------------------------------

export function renderTemplate(input: TemplateInput): string {
  let html = loadTemplate(input.theme);

  // --- Step 1: 画像URL決定 ---
  let heroImageUrl = "";
  if (input.heroImageOption === "custom" && input.heroImageCustomUrl) {
    heroImageUrl = input.heroImageCustomUrl;
  } else if (input.heroImageOption === "default") {
    heroImageUrl = DEFAULT_HERO_IMAGES[input.theme] || "";
  }
  // "none" の場合は空文字（テンプレート側でデフォルトグラデーション表示になる）

  // --- Step 2: 変数置換 ---
  const vars: Record<string, string> = {
    "{{SITE_NAME}}": input.siteName,
    "{{CATCHPHRASE}}": input.catchphrase,
    "{{DESCRIPTION_SHORT}}": input.descriptionShort,
    "{{HERO_IMAGE_URL}}": heroImageUrl,
    "{{PHONE}}": input.phone || "",
    "{{EMAIL}}": input.email || "",
    "{{ADDRESS}}": (input.address || "").replace(/\n/g, "<br>"),
    "{{HOURS}}": (input.hours || "").replace(/\n/g, "<br>"),
    "{{HOLIDAY}}": input.holiday || "",
    "{{MAP_EMBED_URL}}": input.mapEnabled && input.mapEmbedUrl ? input.mapEmbedUrl : "",
    "{{FORM_ACTION_URL}}": input.formEnabled && input.formActionUrl ? input.formActionUrl : "https://formspree.io/f/xpwddjaw",
    "{{INSTAGRAM_URL}}": input.instagramUrl || "",
    "{{YOUTUBE_URL}}": input.youtubeUrl || "",
    "{{X_URL}}": input.xUrl || "",
    "{{LINE_URL}}": input.lineUrl || "",
    "{{FACEBOOK_URL}}": input.facebookUrl || "",
  };

  // サービス（1〜4）
  for (let i = 0; i < 4; i++) {
    const svc = input.services[i];
    vars[`{{SERVICE_${i + 1}_TITLE}}`] = svc?.title || "";
    vars[`{{SERVICE_${i + 1}_DESC}}`] = svc?.desc || "";
  }

  // 特徴（1〜3）
  for (let i = 0; i < 3; i++) {
    const feat = input.features[i];
    vars[`{{FEATURE_${i + 1}_TITLE}}`] = feat?.title || "";
    vars[`{{FEATURE_${i + 1}_DESC}}`] = feat?.desc || "";
  }

  for (const [placeholder, value] of Object.entries(vars)) {
    html = html.split(placeholder).join(value);
  }

  // --- Step 3: ON/OFF制御 ---

  // フォーム
  if (!input.formEnabled) {
    html = removeBlock(html, "FORM_START", "FORM_END");
  }

  // マップ
  if (!input.mapEnabled || !input.mapEmbedUrl) {
    html = removeBlock(html, "MAP_START", "MAP_END");
  }

  // SNS（個別）
  if (!input.instagramUrl) html = removeBlock(html, "SNS_INSTAGRAM_START", "SNS_INSTAGRAM_END");
  if (!input.youtubeUrl) html = removeBlock(html, "SNS_YOUTUBE_START", "SNS_YOUTUBE_END");
  if (!input.xUrl) html = removeBlock(html, "SNS_X_START", "SNS_X_END");
  if (!input.lineUrl) html = removeBlock(html, "SNS_LINE_START", "SNS_LINE_END");
  if (!input.facebookUrl) html = removeBlock(html, "SNS_FACEBOOK_START", "SNS_FACEBOOK_END");

  // 全SNSが空なら親コンテナも削除
  const hasAnySns = input.instagramUrl || input.youtubeUrl || input.xUrl || input.lineUrl || input.facebookUrl;
  if (!hasAnySns) {
    html = removeBlock(html, "SNS_START", "SNS_END");
  }

  // --- Step 4: 未使用サービスカードの削除 ---
  // サービスが3個以下の場合、4個目のカードHTML要素を削除
  // テンプレートのサービスカードは <!-- サービスN --> コメントで区切られている
  if (input.services.length < 4) {
    html = removeServiceCard(html, 4);
  }
  if (input.services.length < 3) {
    html = removeServiceCard(html, 3);
  }

  // --- Step 5: 画像なしの場合、imgタグを非表示にする ---
  if (input.heroImageOption === "none") {
    // imgタグのsrcが空の場合、非表示にするスタイルを追加
    html = html.replace(
      /<img\s+src=""\s+alt="[^"]*"\s+class="([^"]*)"/g,
      '<img src="" alt="" style="display:none" class="$1"'
    );
  }

  return html;
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function removeBlock(html: string, startMarker: string, endMarker: string): string {
  const startComment = `<!--${startMarker}-->`;
  const endComment = `<!--${endMarker}-->`;
  const startIdx = html.indexOf(startComment);
  const endIdx = html.indexOf(endComment);
  if (startIdx === -1 || endIdx === -1) return html;
  return html.substring(0, startIdx) + html.substring(endIdx + endComment.length);
}

function removeServiceCard(html: string, serviceNum: number): string {
  // テンプレートのサービスカードを「<!-- サービスN -->」コメントで検出して削除
  const marker = `<!-- サービス${serviceNum} -->`;
  const idx = html.indexOf(marker);
  if (idx === -1) return html;

  // マーカーの前の空白を含めた開始位置
  let start = idx;
  while (start > 0 && html[start - 1] === " ") start--;
  if (start > 0 && html[start - 1] === "\n") start--;

  // 次のサービスマーカーまたは</div>の閉じタグまでを探す
  const nextMarker = `<!-- サービス${serviceNum + 1} -->`;
  const nextIdx = html.indexOf(nextMarker, idx);
  let end: number;

  if (nextIdx !== -1) {
    end = nextIdx;
  } else {
    // 最後のサービスカード：次の </div> の閉じタグまでを探す
    // カードのdiv閉じタグを見つける（</div> の後の改行まで）
    const closingDiv = "</div>";
    let searchPos = idx;
    let depth = 0;
    let found = false;

    for (let i = idx; i < html.length; i++) {
      if (html.substring(i, i + 5) === "<div ") depth++;
      if (html.substring(i, i + 6) === closingDiv) {
        if (depth === 0) {
          end = i + closingDiv.length;
          // 改行もスキップ
          while (end < html.length && (html[end] === "\n" || html[end] === "\r" || html[end] === " ")) end++;
          found = true;
          break;
        }
        depth--;
      }
    }
    if (!found) return html;
  }

  return html.substring(0, start) + html.substring(end!);
}

// ---------------------------------------------------------------------------
// Googleマップ埋め込みURL生成
// ---------------------------------------------------------------------------

export function generateMapEmbedUrl(address: string): string {
  if (!address) return "";
  const encoded = encodeURIComponent(address.replace(/<br>/g, " ").replace(/\n/g, " "));
  return `https://maps.google.com/maps?q=${encoded}&output=embed`;
}
