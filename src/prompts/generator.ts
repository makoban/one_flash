/**
 * プロンプトB: HTML/CSS ジェネレーター
 *
 * ユーザーのフォーム入力からレスポンシブな1ページHTMLを生成する。
 *
 * 制約:
 *   - 外部画像は使用しない（URLが無効になる可能性があるため）
 *   - Tailwind CSS (CDN) を使用
 *   - Google Fonts を使用（3書体: 日本語本文 + 英字見出し + 英字ラベル）
 *   - Lucide Icons (CDN) を使用
 *   - 完全な自己完結型HTML（<!DOCTYPE html>から</html>まで）
 *   - JavaScriptは最小限（Lucide初期化のみ）
 *
 * 使用モデル: geminiModel（temperature: 0.7）
 */

import type { SiteFormData } from "@/lib/gemini";

// ---------------------------------------------------------------------------
// カラーテーマ定義（拡張版）
// ---------------------------------------------------------------------------

const COLOR_THEMES = {
  minimal: {
    label: "ミニマル・モダン",
    heroStyle: "洗練されたダーク背景にクリーンなタイポグラフィ。余白を贅沢に使い、DM Serif Displayの優雅なセリフ体で高級感を演出。モノトーン＋インディゴのアクセントで知的な印象。",
    palette: {
      primary: "#111827",
      accent: "#6366f1",
      accentLight: "#a5b4fc",
      heroBg: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)",
      heroText: "#ffffff",
      sectionBg1: "#ffffff",
      sectionBg2: "#fafafa",
      sectionBgDark: "#0f0f0f",
      cardBg: "#ffffff",
      cardBorder: "#f0f0f0",
      textPrimary: "#111111",
      textSecondary: "#555555",
      textMuted: "#999999",
    },
    fonts: {
      display: "DM Serif Display",
      label: "Space Grotesk",
      body: "Noto Sans JP",
      googleFontsUrl: "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Noto+Sans+JP:wght@300;400;500;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap",
    },
  },
  business: {
    label: "ビジネス・プロフェッショナル",
    heroStyle: "深みのあるネイビー〜ダークブルーのグラデーション。Playfair Displayのクラシカルなセリフ体で格式と信頼感を演出。ゴールドに近い暖色アクセントで上質さをプラス。",
    palette: {
      primary: "#0c1524",
      accent: "#c9a96e",
      accentLight: "#e2cf9e",
      heroBg: "linear-gradient(160deg, #0c1524 0%, #162544 50%, #1a3a5c 100%)",
      heroText: "#ffffff",
      sectionBg1: "#f8f9fb",
      sectionBg2: "#ffffff",
      sectionBgDark: "#0c1524",
      cardBg: "#ffffff",
      cardBorder: "#e8ecf1",
      textPrimary: "#0c1524",
      textSecondary: "#4a5568",
      textMuted: "#a0aec0",
    },
    fonts: {
      display: "Playfair Display",
      label: "Montserrat",
      body: "Noto Serif JP",
      googleFontsUrl: "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Noto+Serif+JP:wght@300;400;500;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap",
    },
  },
  casual: {
    label: "カジュアル・フレンドリー",
    heroStyle: "温かみのあるアースカラー。Loraの柔らかいセリフ体とZen Maru Gothicの丸ゴシックで親しみやすさと洗練を両立。カフェやサロンのような心地よい雰囲気。",
    palette: {
      primary: "#3d3229",
      accent: "#b87333",
      accentLight: "#daa06d",
      heroBg: "linear-gradient(160deg, #3d3229 0%, #5c4a3a 50%, #8b7355 100%)",
      heroText: "#ffffff",
      sectionBg1: "#faf7f2",
      sectionBg2: "#f3ede4",
      sectionBgDark: "#2c2420",
      cardBg: "#ffffff",
      cardBorder: "#e8e2d9",
      textPrimary: "#2c2420",
      textSecondary: "#6b5e53",
      textMuted: "#a89e93",
    },
    fonts: {
      display: "Lora",
      label: "Poppins",
      body: "Zen Maru Gothic",
      googleFontsUrl: "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Poppins:wght@300;400;500;600;700&family=Zen+Maru+Gothic:wght@300;400;500;700&display=swap",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// プロンプト生成関数
// ---------------------------------------------------------------------------

export function buildGeneratorPrompt(formData: SiteFormData): string {
  const theme = COLOR_THEMES[formData.colorTheme];
  const p = theme.palette;
  const f = theme.fonts;

  return `
あなたは受賞歴のある一流Webデザイナーです。以下のサイト情報をもとに、
デザインスタジオが50万円で制作したような、息をのむほど美しい1ページHTMLを生成してください。

## 最重要ルール: テキストの扱い方

### 絶対に守ること
- サイト名・キャッチコピー・連絡先はユーザーが書いた文言を**そのまま**使う
- ユーザーが書いていない**事実**を捏造しない（架空の料金、口コミ、実績年数、統計数値、電話番号、住所、サービス名等）
- ダミーテキスト（Lorem ipsum、「テキストテキスト」等）は絶対に使わない

### やってよいこと（自然な文章にするために推奨）
- ユーザーの説明文を、**自然で読みやすい文章に言い換える・整理する**（意味を変えない範囲で）
- 説明文の内容を分割して、各セクションの見出しや短い紹介文として再構成する
- 英字セクションラベル（"ABOUT", "SERVICE", "CONTACT" 等）を追加する
- CTAボタンのラベル（「お問い合わせはこちら」「詳しく見る」等）を追加する
- セクション見出しに**短い日本語コピー**を添える（例: 「私たちについて」「選ばれる理由」「ご相談ください」等）
- 説明文の内容が少ない場合は**セクション数を3〜4つに減らし**、各セクションを丁寧に作る

## サイト情報
- サイト名: ${formData.siteName}
- キャッチコピー: ${formData.catchphrase}
- 説明・本文: ${formData.description}
- 連絡先情報: ${formData.contactInfo}
- テーマ: ${theme.label}

## 技術仕様

### CDN読み込み（head内に記述）
\`\`\`html
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${f.googleFontsUrl}" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
\`\`\`

### Tailwind Config（head内の<script>で設定）
tailwind.config に以下を設定すること:
- fontFamily を拡張: sans='${f.body}, sans-serif', display='${f.display}, serif', label='${f.label}, sans-serif'
- テーマカラーを拡張: brand色として50〜900のカラースケールを定義（アクセント色 ${p.accent} を500として展開）

### Lucideアイコン
- \`<i data-lucide="icon-name"></i>\` 形式で使用
- body閉じタグ直前で \`lucide.createIcons();\` を実行
- アイコンは各セクションで適切に使用し、ビジュアルのアクセントにする

### 絶対禁止事項
- img タグでの外部URL画像の使用（一切禁止）
- base64エンコード画像の埋め込み
- インラインSVGの画像的使用（アイコン程度は可）

## デザイン仕様（最重要: ここに魂を込めること）

### カラーパレット
- ヒーロー背景: ${p.heroBg}
- ヒーローテキスト: ${p.heroText}
- セクション背景（明）: ${p.sectionBg1}
- セクション背景（交互）: ${p.sectionBg2}
- ダークセクション: ${p.sectionBgDark}
- アクセント色: ${p.accent} / ライトアクセント: ${p.accentLight}
- テキスト色: ${p.textPrimary} / ${p.textSecondary} / ${p.textMuted}
- カード: 背景 ${p.cardBg} / ボーダー ${p.cardBorder}

### デザイン方向性
${theme.heroStyle}

### タイポグラフィ（デザインの命）
- **見出し（${f.display}）**: セクション見出しに使用。イタリック体を積極的に使い、大きなサイズ（text-4xl〜text-6xl）で圧倒的な存在感を出す。letter-spacing: -0.02em で詰めるとモダンになる
- **ラベル（${f.label}）**: 英字ラベル（"ABOUT" 等）に使用。font-weight: 500〜600, tracking-[0.2em]〜tracking-[0.3em], text-xs〜text-sm, uppercase, アクセント色
- **本文（${f.body}）**: 日本語本文に使用。font-weight: 300〜400の細めが洗練された印象。leading-relaxed〜leading-loose で余裕のある行間

### ヒーローセクション（サイトの顔）
- min-height: 100vh または大きなパディング（py-24〜py-40）
- CSSグラデーション背景 + radial-gradientオーバーレイで光の表現（例: radial-gradient(circle at 30% 50%, rgba(255,255,255,0.08) 0%, transparent 50%)）
- 背景に大きな装飾: CSSのみで幾何学模様やグラデーション円を重ねる（position: absolute + opacity低め）
- 英字サブラベル（font-label, tracking-[0.3em], text-xs, opacity-70）をキャッチコピーの上に配置
- キャッチコピーは font-display で大胆に大きく（text-3xl sm:text-5xl lg:text-6xl）
- キャッチコピーの下に1〜2行の短い説明文（font-sans, text-base, opacity-80）
- CTAボタン: px-8 py-4 rounded-full, アクセント色背景, font-weight: 600, hover時にscale(1.05)とshadow増加
- ヒーロー下部にスクロールインジケーター（小さなアニメーション矢印）

### 各セクション共通ルール
- セクション冒頭: 英字ラベル（小さく、ラベルフォント、アクセント色）→ 日本語見出し（大きく、ディスプレイフォント、イタリック可）→ 装飾線（width: 60px, height: 2px, アクセント色のグラデーション）
- セクション間のパディング: py-20〜py-28 でゆったり
- **余白を贅沢に使うこと**。詰め込まない。呼吸できる空間を作る
- カード要素: rounded-2xl, shadow-sm, hover時にtranslateY(-8px) + shadow-xl, transition duration-300
- アイコンは丸い背景（w-14 h-14 rounded-2xl）の中に配置し、背景はアクセント色の薄い版（opacity-10）

### セクション構成（ユーザーの情報量に応じて3〜6セクション）
1. **ヘッダー**: fixed top-0, backdrop-blur-md, bg-white/80（ダークテーマはbg-black/80）, z-50, サイト名 + ナビ + CTAボタン（小さめ）
2. **ヒーローセクション**: 上記の仕様に従い、圧倒的なファーストインプレッション
3. **概要・強み**: ユーザーの説明文から要点を抽出して2〜3つのポイントカードで表示。またはテキスト＋装飾の2カラム
4. **サービス/メニュー**（情報がある場合のみ）: カードグリッド、各カードにLucideアイコン + 見出し + 説明
5. **お問い合わせ/連絡先**: ダークセクション背景、連絡先情報をアイコン付きカードで表示 + 大きなCTAバナー
6. **フッター**: ダーク背景、サイト名 + コピーライト「© 2026 ${formData.siteName}」 + 小さく "Powered by OnePage-Flash"

### レスポンシブ（必須）
- body に overflow-x: hidden を設定
- モバイル（320px）でも美しく表示されること
- グリッドは grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-3
- 見出しテキストサイズ: text-2xl sm:text-4xl lg:text-5xl のようにブレークポイントで調整
- タッチターゲットは最小 44px

### CSS装飾テクニック（<style>内に定義）
- @keyframes fadeUp: opacity 0→1, translateY(30px)→0, ease-out 0.8s
- @keyframes float: translateY(0)→translateY(-10px)→translateY(0), ease-in-out 3s infinite（装飾要素用）
- カードホバー: transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
- スムーズスクロール: html { scroll-behavior: smooth; }
- ヘッダー: backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.1)
- グラデーションテキスト: background: linear-gradient() + -webkit-background-clip: text + color: transparent（アクセント部分に使用可）
- 装飾的なドット/グリッドパターン: radial-gradient(circle, color 1px, transparent 1px) でbackgroundに薄く敷く

## 出力形式
HTMLコードのみを出力してください。
\`\`\`html のようなコードブロック記法は不要です。
説明文やコメントも不要です。
<!DOCTYPE html> から始まり </html> で終わる完全なHTMLのみを返してください。
  `.trim();
}

// ---------------------------------------------------------------------------
// レスポンスパース関数
// ---------------------------------------------------------------------------

export function parseGeneratorResponse(rawResponse: string): string {
  let html = rawResponse
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!html.toLowerCase().startsWith("<!doctype html")) {
    const doctypeIndex = html.toLowerCase().indexOf("<!doctype html");
    if (doctypeIndex === -1) {
      throw new Error("Generated HTML does not contain DOCTYPE declaration");
    }
    html = html.substring(doctypeIndex);
  }

  if (!html.toLowerCase().endsWith("</html>")) {
    const htmlEndIndex = html.toLowerCase().lastIndexOf("</html>");
    if (htmlEndIndex === -1) {
      throw new Error("Generated HTML does not contain closing </html> tag");
    }
    html = html.substring(0, htmlEndIndex + 7);
  }

  return html;
}
