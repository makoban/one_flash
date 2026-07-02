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
  "clean-light": {
    label: "クリーンライト",
    heroStyle:
      "白を基調としたクリーンで清潔感のあるデザイン。Noto Sans JPのすっきりしたゴシック体で読みやすさと信頼感を両立。余白を贅沢に使い、必要最小限の色で洗練された印象。十字モチーフの控えめな装飾。",
    palette: {
      primary: "#111827",
      accent: "#374151",
      accentLight: "#9ca3af",
      heroBg: "linear-gradient(135deg, #ffffff 0%, #f9fafb 50%, #f3f4f6 100%)",
      heroText: "#111827",
      sectionBg1: "#ffffff",
      sectionBg2: "#f9fafb",
      sectionBgDark: "#111827",
      cardBg: "#ffffff",
      cardBorder: "#e5e7eb",
      textPrimary: "#111827",
      textSecondary: "#4b5563",
      textMuted: "#9ca3af",
    },
    fonts: {
      display: "Noto Sans JP",
      label: "Inter",
      body: "Noto Sans JP",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap",
    },
  },
  "royal-navy": {
    label: "ロイヤルネイビー",
    heroStyle:
      "深みのあるネイビー〜ダークブルーのグラデーション。Playfair Displayのクラシカルなセリフ体で格式と信頼感を演出。ゴールドに近い暖色アクセントで上質さをプラス。同心円リング装飾。",
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
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Noto+Serif+JP:wght@300;400;500;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap",
    },
  },
  "bloom-pink": {
    label: "ブルームピンク",
    heroStyle:
      "紫→ピンク→オレンジの華やかなグラデーションで目を引くデザイン。Zen Maru Gothicの丸ゴシックとPoppinsで、カジュアルで華やかな雰囲気。有機的なブロブと光の粒子の装飾。",
    palette: {
      primary: "#1e1b4b",
      accent: "#7c3aed",
      accentLight: "#c4b5fd",
      heroBg: "linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)",
      heroText: "#ffffff",
      sectionBg1: "#fefce8",
      sectionBg2: "#fdf4ff",
      sectionBgDark: "#1e1b4b",
      cardBg: "#ffffff",
      cardBorder: "#e9d5ff",
      textPrimary: "#1e1b4b",
      textSecondary: "#6b21a8",
      textMuted: "#a78bfa",
    },
    fonts: {
      display: "Zen Maru Gothic",
      label: "Poppins",
      body: "Zen Maru Gothic",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Zen+Maru+Gothic:wght@300;400;500;700&display=swap",
    },
  },
  "soft-blossom": {
    label: "ソフトブロッサム",
    heroStyle:
      "やさしいピンクのグラデーションで、ナチュラルで落ち着いた印象。Noto Sans JPのすっきりしたゴシック体にピンクアクセント。楕円リングと流線の装飾。",
    palette: {
      primary: "#111827",
      accent: "#ec4899",
      accentLight: "#f9a8d4",
      heroBg: "linear-gradient(135deg, #ffffff 0%, #fdf2f8 50%, #fce7f3 100%)",
      heroText: "#111827",
      sectionBg1: "#ffffff",
      sectionBg2: "#fdf2f8",
      sectionBgDark: "#831843",
      cardBg: "#ffffff",
      cardBorder: "#fce7f3",
      textPrimary: "#111827",
      textSecondary: "#9d174d",
      textMuted: "#f472b6",
    },
    fonts: {
      display: "Noto Sans JP",
      label: "Inter",
      body: "Noto Sans JP",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap",
    },
  },
  "sunset-cafe": {
    label: "サンセットカフェ",
    heroStyle:
      "温かみのあるオレンジ〜イエローのグラデーションで食欲と親しみを演出。Zen Maru Gothicの丸ゴシックで手作り感。湯気の曲線とプレート円の装飾。",
    palette: {
      primary: "#431407",
      accent: "#ea580c",
      accentLight: "#fdba74",
      heroBg: "linear-gradient(135deg, #ea580c 0%, #f59e0b 50%, #fbbf24 100%)",
      heroText: "#ffffff",
      sectionBg1: "#fffbeb",
      sectionBg2: "#fff7ed",
      sectionBgDark: "#431407",
      cardBg: "#ffffff",
      cardBorder: "#fed7aa",
      textPrimary: "#431407",
      textSecondary: "#9a3412",
      textMuted: "#fb923c",
    },
    fonts: {
      display: "Zen Maru Gothic",
      label: "Poppins",
      body: "Zen Maru Gothic",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Zen+Maru+Gothic:wght@300;400;500;700&display=swap",
    },
  },
  "dark-dining": {
    label: "ダークダイニング",
    heroStyle:
      "深いダーク×ゴールドで高級感と特別感。Playfair Displayのセリフ体で上質なダイニング体験を演出。エレガントなプレート輪郭と湯気の装飾。",
    palette: {
      primary: "#0c1524",
      accent: "#c9a96e",
      accentLight: "#e2cf9e",
      heroBg: "linear-gradient(160deg, #0c1524 0%, #1a1a2e 50%, #16213e 100%)",
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
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Noto+Serif+JP:wght@300;400;500;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap",
    },
  },
  "trust-blue": {
    label: "トラストブルー",
    heroStyle:
      "ネイビー×ゴールドで知性と信頼感。Playfair Displayで格式を演出。縦ストライプと天秤モチーフ、ナンバリング装飾。",
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
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Noto+Serif+JP:wght@300;400;500;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap",
    },
  },
  "modern-minimal": {
    label: "モダンミニマル",
    heroStyle:
      "無駄のないシャープな白基調デザイン。Noto Sans JPで清潔感。幾何学ラインとナンバリングの装飾。",
    palette: {
      primary: "#111827",
      accent: "#374151",
      accentLight: "#9ca3af",
      heroBg: "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)",
      heroText: "#111827",
      sectionBg1: "#ffffff",
      sectionBg2: "#f8fafc",
      sectionBgDark: "#111827",
      cardBg: "#ffffff",
      cardBorder: "#e2e8f0",
      textPrimary: "#111827",
      textSecondary: "#475569",
      textMuted: "#94a3b8",
    },
    fonts: {
      display: "Noto Sans JP",
      label: "Inter",
      body: "Noto Sans JP",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap",
    },
  },
  "pop-school": {
    label: "ポップスクール",
    heroStyle:
      "青→紫→ピンクの楽しいグラデーションで、学ぶ楽しさを表現。Zen Maru Gothicの丸ゴシックで親しみやすさ。浮遊する幾何学シェイプの装飾。",
    palette: {
      primary: "#1e1b4b",
      accent: "#2563eb",
      accentLight: "#93c5fd",
      heroBg: "linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #ec4899 100%)",
      heroText: "#ffffff",
      sectionBg1: "#eff6ff",
      sectionBg2: "#fdf4ff",
      sectionBgDark: "#1e1b4b",
      cardBg: "#ffffff",
      cardBorder: "#bfdbfe",
      textPrimary: "#1e1b4b",
      textSecondary: "#1d4ed8",
      textMuted: "#60a5fa",
    },
    fonts: {
      display: "Zen Maru Gothic",
      label: "Poppins",
      body: "Zen Maru Gothic",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Zen+Maru+Gothic:wght@300;400;500;700&display=swap",
    },
  },
  "blueprint": {
    label: "ブループリント",
    heroStyle:
      "白基調に設計図モチーフのデザイン。Noto Sans JPのすっきりしたゴシック体で安心感。建物のアウトラインと寸法線の装飾。",
    palette: {
      primary: "#111827",
      accent: "#374151",
      accentLight: "#9ca3af",
      heroBg: "linear-gradient(135deg, #ffffff 0%, #f9fafb 50%, #f3f4f6 100%)",
      heroText: "#111827",
      sectionBg1: "#ffffff",
      sectionBg2: "#f9fafb",
      sectionBgDark: "#111827",
      cardBg: "#ffffff",
      cardBorder: "#e5e7eb",
      textPrimary: "#111827",
      textSecondary: "#4b5563",
      textMuted: "#9ca3af",
    },
    fonts: {
      display: "Noto Sans JP",
      label: "Inter",
      body: "Noto Sans JP",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap",
    },
  },
  "free-wave": {
    label: "フリーウェーブ",
    heroStyle:
      "紫→ピンク→オレンジの自由なグラデーション。Zen Maru Gothicの丸ゴシックとPoppinsでカジュアルな雰囲気。ウェーブレイヤーとボケドットの装飾。",
    palette: {
      primary: "#1e1b4b",
      accent: "#7c3aed",
      accentLight: "#c4b5fd",
      heroBg: "linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)",
      heroText: "#ffffff",
      sectionBg1: "#fefce8",
      sectionBg2: "#fdf4ff",
      sectionBgDark: "#1e1b4b",
      cardBg: "#ffffff",
      cardBorder: "#e9d5ff",
      textPrimary: "#1e1b4b",
      textSecondary: "#6b21a8",
      textMuted: "#a78bfa",
    },
    fonts: {
      display: "Zen Maru Gothic",
      label: "Poppins",
      body: "Zen Maru Gothic",
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Zen+Maru+Gothic:wght@300;400;500;700&display=swap",
    },
  },
  "executive": {
    label: "エグゼクティブ",
    heroStyle:
      "紺×ゴールドのプレミアムデザイン。Playfair Displayの格式高いセリフ体にMontserratのモダンラベル。ダイヤモンドグリッドの洗練された装飾。",
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
      googleFontsUrl:
        "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Noto+Serif+JP:wght@300;400;500;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap",
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

  // descriptionの文字数でページ長ルールを判定
  const descLen = formData.description.length;
  const pageLengthRule =
    descLen < 200
      ? "最大6セクション（ヘッダー＋フッターは含まない。お問い合わせフォーム・マップセクション含む）。各セクションのパディングは py-16。"
      : descLen < 500
        ? "最大7セクション（ヘッダー＋フッターは含まない。お問い合わせフォーム・マップセクション含む）。各セクションのパディングは py-20。"
        : "最大8セクション（ヘッダー＋フッターは含まない。お問い合わせフォーム・マップセクション含む）。各セクションのパディングは py-24。";

  return `
あなたは受賞歴のある一流Webデザイナー兼フロントエンドエンジニアです。
以下のサイト情報をもとに、デザインスタジオが50万円で制作したような、息をのむほど美しい1ページHTMLを生成してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【STEP 1】業種推定（最初にこれを行うこと）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

サイト名・キャッチコピー・説明文から、以下の7カテゴリのうち最も適切な業種を推定する。
推定結果をHTMLコメント <!-- INDUSTRY: XXX --> としてHTML冒頭（DOCTYPE直後）に1行だけ出力すること。

業種カテゴリ一覧:
- MEDICAL  : 整体院・整骨院・歯科・鍼灸・クリニック・接骨院・カイロプラクティック
- BEAUTY   : 美容院・エステ・ネイル・まつ毛・脱毛・ヘアサロン・アイラッシュ
- FOOD     : カフェ・レストラン・居酒屋・パン屋・スイーツ・料理店・飲食
- LEGAL    : 弁護士・税理士・社労士・行政書士・司法書士・コンサルタント・士業
- SCHOOL   : 塾・習い事・料理教室・ヨガ・音楽教室・スクール・フィットネス・カルチャー
- CONSTRUCTION : 建設・リフォーム・内装・外壁・水道工事・大工・工務店・塗装
- GENERAL  : 上記いずれにも当てはまらない場合

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【STEP 2】業種別デザインルールの適用
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP1で推定した業種に対応するルールを以下から選択し、そのまま適用すること。

------------------------------------------------------------
■ MEDICAL（整体院・整骨院・歯科・クリニック等）
------------------------------------------------------------
セクション構成（この順番で生成）:
  1. ヘッダー（院名 + 電話番号を目立つ位置に配置）
  2. ヒーロー（min-height: 80vh。安心感・清潔感を前面に。画像は使わずCSS装飾のみ）
  3. 治療案内・メニュー（2〜3カードグリッド）
  4. 当院の特徴（3ポイントカード）
  5. お問い合わせフォーム
  6. アクセス・連絡先（Googleマップ埋め込み）
  7. フッター

推奨アイコン（Lucide）: heart-pulse, activity, shield-check, clock, map-pin, phone, badge-check, stethoscope, thermometer
デザイン特性:
  - イタリック体は使わない（医療機関の信頼感を損なうため）
  - 電話番号をCTAの最優先に置く（tel:リンク必須）
  - カードタイプ: Aタイプ（左に4px border, accent色, rounded-lg）
  - simpleテーマが選ばれている場合: accent色を #2a7ae4（ブルー系）にオーバーライド
  - businessテーマが選ばれている場合: accent色を #2a7ae4（ブルー系）にオーバーライド
  - 英字ラベルで「TREATMENT」「ABOUT」「ACCESS」等を使用
  - ヒーロー背景のオーバーレイに薄いグリッドまたは斜め線パターン（CSS only）

------------------------------------------------------------
■ BEAUTY（美容院・エステ・ネイル・まつ毛・脱毛等）
------------------------------------------------------------
セクション構成（この順番で生成）:
  1. ヘッダー（予約CTAを最優先。tel:リンクまたは予約ボタン）
  2. ヒーロー（詩的な表現・余白を多めに取る。画像は使わずCSS装飾のみ）
  3. メニュー・施術内容（2〜4カードグリッド）
  4. こだわり・強み（3ポイントカード）
  5. お問い合わせフォーム
  6. 予約・連絡先（Googleマップ埋め込み）
  7. フッター

推奨アイコン（Lucide）: sparkles, scissors, star, gem, crown, wand-sparkles, heart, smile, calendar
デザイン特性:
  - イタリック体（font-style: italic）を積極的に使用（見出し・キャッチコピー）
  - グラデーションテキスト（background-clip: text）を見出しの一部に使用
  - CTAボタンはアウトラインスタイル（background: transparent, border 2px, hover時に塗り）
  - カードタイプ: Bタイプ（shadow-lg, rounded-2xl, hover時にtranslateY）
  - colorfulテーマが選ばれている場合: accent色を #c9748a（ローズ）にオーバーライド
  - simpleテーマが選ばれている場合: accent色を #9b8ec4（ラベンダー）にオーバーライド
  - ヒーロー背景に細い斜め線または水玉パターンを薄く（opacity: 0.04）

------------------------------------------------------------
■ FOOD（カフェ・レストラン・居酒屋・パン屋・スイーツ等）
------------------------------------------------------------
セクション構成（4セクション完結・この順番で生成）:
  1. ヘッダー（店名 + 営業時間 + 電話番号を1行に並べる）
  2. ヒーロー（min-height: 90vh。温かみと食欲をそそる雰囲気。画像は使わずCSS装飾のみ）
  3. メニュー・特徴（3カードグリッド）
  4. お問い合わせフォーム
  5. 店舗情報（営業時間・定休日・住所・電話番号・Googleマップ埋め込み）
  6. フッター

推奨アイコン（Lucide）: utensils, coffee, wine, leaf, flame, heart, map-pin, clock, calendar, star
デザイン特性:
  - 背景全体に大きな装飾英字（例: "CAFE", "RESTAURANT"）をopacity: 0.035〜0.05で薄く表示
  - 温かみ・手作り感を優先したセクション間隔
  - カードタイプ: Cタイプ（アイコン上置き, rounded-xl, shadow-sm）
  - simpleテーマが選ばれている場合: accent色を #7a9e6e（オリーブグリーン）にオーバーライド
  - businessテーマが選ばれている場合: accent色を #7a9e6e（オリーブグリーン）にオーバーライド
  - セクション背景を交互に変え、同じ背景色を連続させない
  - 営業時間・定休日は【連絡先情報】に記載がある場合のみ clock / calendar-x アイコン付きで表示（無ければ省略・捏造禁止）

------------------------------------------------------------
■ LEGAL（弁護士・税理士・社労士・行政書士・コンサル等）
------------------------------------------------------------
セクション構成（この順番で生成）:
  1. ヘッダー（事務所名 + 電話番号を大きく）
  2. ヒーロー（min-height: 80vh。お客様への語りかけ形式のコピー）
  3. 業務内容（カードグリッド）
  4. 選ばれる理由・特徴（3ポイント）
  5. 費用・相談方法
  6. 連絡先（CTA2つ横並び: 電話ボタン + メールボタン）
  7. フッター

推奨アイコン（Lucide）: scale, briefcase, file-text, gavel, shield, building, badge-check, award, phone, mail
デザイン特性:
  - CTA2つ横並び必須（電話CTAとメールCTAを並べる）
  - 英字ラベルで「SERVICE」「WHY」「CONTACT」等を使用
  - 大きなナンバリング（01, 02, 03）を薄く表示（opacity: 0.06, font-size: clamp(80px,15vw,200px)）
  - カードタイプ: Aタイプ（左に4px border, accent色, rounded-lg）
  - businessテーマが最も適切。ゴールドアクセント #c9a96e をそのまま活かす
  - ヒーロー背景は重厚感のあるグラデーション（businessテーマのheroBgそのまま使用）

------------------------------------------------------------
■ SCHOOL（塾・習い事・料理教室・ヨガ・音楽教室等）
------------------------------------------------------------
セクション構成（この順番で生成）:
  1. ヘッダー（教室名 + 体験申込CTAボタン）
  2. ヒーロー（前向き・明るいコピー）
  3. コース・メニュー内容（カードグリッド）
  4. 教室の特徴（3ポイント）
  5. 体験レッスン・申込案内
  6. 連絡先
  7. フッター

推奨アイコン（Lucide）: book-open, pencil, graduation-cap, music, palette, dumbbell, smile, users, star, heart
デザイン特性:
  - colorfulテーマが最も適切
  - 背景にCSSドットパターン（radial-gradient で小さなドット）でポップさを表現
  - カードタイプ: Bタイプ（shadow-lg, rounded-2xl）
  - 体験申込ボタンを複数箇所に配置（ヘッダー・ヒーロー・体験案内セクション）
  - セクション背景を明→暗→明と変化させる

------------------------------------------------------------
■ CONSTRUCTION（建設・リフォーム・内装・外壁・水道工事等）
------------------------------------------------------------
セクション構成（この順番で生成）:
  1. ヘッダー（会社名 + 電話番号を大きく）
  2. ヒーロー（力強さ・頼れる印象）
  3. サービス内容（3〜4項目カードグリッド）
  4. 選ばれる理由（3ポイント）
  5. 問い合わせ（CTA2つ横並び: 無料見積ボタン + 電話ボタン）
  6. フッター

推奨アイコン（Lucide）: hammer, wrench, house, paint-bucket, layers, zap, shield-check, hard-hat, tool, check-circle
デザイン特性:
  - CTA2つ横並び必須（「無料見積もり依頼」ボタン + 電話CTAボタン）
  - businessテーマが最も適切
  - accent色を #ef9b20（オレンジ）にオーバーライド（全テーマ共通）
  - ヒーロー見出しは太字・大文字気味で力強く
  - カードタイプ: Cタイプ（アイコン上置き, rounded-xl）

------------------------------------------------------------
■ GENERAL（上記以外の業種）
------------------------------------------------------------
セクション構成（シンプル・この順番で生成）:
  1. ヘッダー
  2. ヒーロー（シンプルで印象的なファーストビュー）
  3. 事業概要（2〜3ポイント）
  4. 連絡先
  5. フッター

デザイン特性:
  - カードタイプ: Bタイプ（shadow, rounded-2xl）
  - 情報が少ない場合は各セクションを丁寧に大きく作る
  - ユーザーのテーマ指定に忠実に従う

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【実現不可能な要求の扱い方】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このサービスは静的な1ページHTML（Tailwind CSS + Lucide Icons）のみを生成します。
以下のような要求がユーザーの説明文に含まれていても、**無視してHTMLで実現可能な範囲で最善のページを生成**してください。

実現不可能な要求の例:
- 予約サイトURLへのリンク → 実現可能。連絡先・予約CTAとして必ずリンクボタンを設置
- 予約システム構築・予約フォーム作成 → 電話番号・メール・外部予約サイトURLでの予約案内に置換
- ショッピングカート・EC機能 → メニュー/料金表として静的に表示
- ログイン・会員登録機能 → 記載しない
- ブログ・お知らせ更新機能 → 記載しない
- SNSフィード連携・チャット → SNSへのリンクアイコンに置換
- 複数ページ構成 → 1ページ内のセクション分けで対応
- データベース・検索・フィルター → 記載しない

これらの要求は**エラーにせず、黙って可能な形に置換**すること。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【最重要ルール】テキストの扱い方
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 絶対に守ること
- サイト名・キャッチコピー・連絡先はユーザーが書いた文言を**そのまま**使う
- 連絡先情報にURL（http/https、wwwから始まるURL、予約サイトURL）が含まれる場合、そのURLを必ず <a href="..."> の外部リンクとして掲載する
- ユーザーが書いていない**事実**を捏造しない（架空の料金・口コミ・実績年数・統計数値・電話番号・住所・サービス名等）
- ダミーテキスト（Lorem ipsum・「テキストテキスト」等）は絶対に使わない

### 【最優先・絶対厳守】書かれていない項目は一切表示しない
- 連絡先・営業時間・住所・定休日・メール・SNS・FAX などは、**【連絡先情報】に実際に文字として書かれている項目だけ**を表示する。
- 書かれていない連絡手段・情報は、**その行・アイコン・ラベル・カード・セクションごと完全に省略**する（空欄やアイコンだけを残さない）。
- ダミー値・プレースホルダ・例示値を**絶対に**入れない。以下は禁止例（これらを出力してはいけない）:
  - 電話「03-1234-5678」「000-0000-0000」「XXX-XXXX-XXXX」
  - メール「info@example.com」「example@example.com」「sample@…」
  - 住所「東京都〇〇区…」「〒000-0000」など未提供の住所
  - 営業時間「9:00〜18:00」「平日10:00-19:00」など未提供の時間、定休日「日曜定休」など
- 判断に迷う項目は**表示しない**（捏造より省略を常に優先）。
- 例: 【連絡先情報】に電話番号しか無ければ、電話だけを表示し、メール・住所・営業時間・地図・定休日は**出さない**。
- お問い合わせフォーム（formspree）は機能要素なので設置してよい（これはダミーの連絡先データではない）。
- 住所が提供されていない場合は Googleマップ（iframe）も出さない。

### やってよいこと（自然な文章にするために推奨）
- ユーザーの説明文を、自然で読みやすい文章に言い換える・整理する（意味を変えない範囲で）
- 説明文の内容を分割して、各セクションの見出しや短い紹介文として再構成する
- 英字セクションラベル（"ABOUT"・"SERVICE"・"CONTACT" 等）を追加する
- CTAボタンのラベル（「お問い合わせはこちら」「詳しく見る」等）を追加する
- セクション見出しに短い日本語コピーを添える（例: 「私たちについて」「選ばれる理由」「ご相談ください」等）
- 説明文の内容が少ない場合はセクション数を3〜4つに減らし、各セクションを丁寧に作る

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【サイト情報】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- サイト名: ${formData.siteName}
- キャッチコピー: ${formData.catchphrase}
- 説明・本文: ${formData.description}
- 連絡先情報: ${formData.contactInfo}
- テーマ: ${theme.label}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【ページ長ルール】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${pageLengthRule}
同じ背景色のセクションを連続させないこと（例: sectionBg1 → sectionBg2 → sectionBg1 のように交互に）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【技術仕様】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### CDN読み込み（head内に記述）
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${f.googleFontsUrl}" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>

### Tailwind Config（head内の<script>で設定）
tailwind.config に以下を設定すること:
- fontFamily を拡張: sans='${f.body}, sans-serif'、display='${f.display}, ${f.body}, serif'、label='${f.label}, ${f.body}, sans-serif'
- テーマカラーを拡張: brand色として50〜900のカラースケールを定義（アクセント色 ${p.accent} を500として展開）

### Lucideアイコンの使用方法
- <i data-lucide="icon-name"></i> 形式で使用
- body閉じタグ直前で lucide.createIcons(); を実行
- アイコンはSTEP2で指定した業種の推奨アイコンリストから選ぶ
- 1つのカードに2個以上のアイコンを配置しないこと

### 画像は一切使わない（最重要）
このサービスは画像なしで洗練されたデザインを実現する方針です。以下を厳守:
- <img> タグは一切使用禁止（ヒーロー・本文・装飾すべて）
- Unsplash, Pexels, その他外部画像URL完全禁止
- base64エンコード画像の埋め込み禁止
- インラインSVGで画像的な表現をするのも禁止（Lucideアイコンとロゴ的マーク程度は可）
- 背景画像(background-image: url(...))も外部URLは禁止

画像の代わりに使う装飾テクニック（ヒーロー・セクション背景で必ず活用）:
- 複層CSSグラデーション（linear-gradient + radial-gradient を重ねる）
- ぼかし円(radial-gradient + filter: blur(60px))を複数配置して光の滲み表現
- 業種英字の超大型タイポグラフィ装飾（clamp(120px,22vw,320px), opacity:0.04〜0.07）
- CSSパターン: ドット(radial-gradient)、斜め線(repeating-linear-gradient)、グリッド(linear-gradient 2方向)
- アクセント色の半透明ぼかし円を「光」として複数配置
- Lucideアイコンを大きめに装飾として配置（opacity: 0.08〜0.15、rotate angle変化）
- 見出しグラデーションテキスト（background-clip: text）
- 細い装飾線・装飾フレーム（rounded-full, 細いborder, 数字/記号の装飾）
- mix-blend-mode: overlay, screen などで深みを出す

ヒーローセクションの推奨構造（画像なしで圧倒的な存在感）:
1. 背景: 複層グラデーション（linear-gradient で基調色、radial-gradient で光の滲み2〜3箇所）
2. 装飾: 業種英字超大型テキスト（背面、opacity 0.04〜0.06）+ 細いグリッドまたはドットパターン（opacity 0.1以下）
3. 中央コンテンツ: 英字サブラベル → 日本語キャッチコピー（font-display, 超大型） → 短い説明文 → CTAボタン
4. 補助装飾: アクセント色のぼかし円を左右非対称に2〜3個配置、またはCSSで描いた幾何図形（三角・円弧・斜め線）
5. 下部: スクロールインジケーター（Lucideアイコン + アニメーション）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【デザイン仕様】（最重要: ここに魂を込めること）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### カラーパレット（業種別オーバーライドが指定されている場合はそちらを優先）
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

### タイポグラフィ
- 見出し（${f.display}）: セクション見出しに使用。業種がBEAUTY・FOODの場合はイタリック体を積極的に使い、大きなサイズ（text-4xl〜text-6xl）で圧倒的な存在感を出す。LEGAL・MEDICALの場合はイタリックを避け、font-weight: 700で重厚感を出す。letter-spacing: -0.02em でモダンに。
- ラベル（${f.label}）: 英字ラベル（"ABOUT" 等）に使用。font-weight: 500〜600、tracking-[0.2em]〜tracking-[0.3em]、text-xs〜text-sm、uppercase、アクセント色。
- 本文（${f.body}）: 日本語本文に使用。font-weight: 300〜400の細めが洗練された印象。leading-relaxed〜leading-loose で余裕のある行間。

### ヒーローセクション（サイトの顔・画像なしで作る）
- 業種別のmin-height指定（STEP2のルールを優先）
- 背景は**画像を使わず**、以下をすべて組み合わせて奥行きと存在感を出す:
  * 複層CSSグラデーション: 基調となるlinear-gradient(135deg, heroBg系の濃淡)
  * 光の滲み: radial-gradient(circle at 25% 30%, アクセント色/0.18, transparent 50%)、もう1つ反対側に（circle at 75% 70%, アクセント色違い/0.12, transparent 45%）
  * 繊細なパターン重ね: 細いグリッド（linear-gradient 2方向、1px線、opacity 0.05以下）または ドット（radial-gradient 1px, 間隔28px, opacity 0.06以下）
- 業種英字の超大型装飾テキスト（例: MEDICAL・BEAUTY・CAFE 等をfont-size: clamp(120px,22vw,320px)、opacity: 0.04〜0.06 で背景に薄く敷く・letter-spacing: 0.1em）
- アクセントとして、ぼかし円（position: absolute, 幅300〜500px, background: radial-gradient(circle, アクセント色 0%, transparent 70%), filter: blur(40px), opacity: 0.4〜0.6）を左右非対称に2〜3個配置
- 英字サブラベル（font-label、tracking-[0.3em]、text-xs、opacity-70）をキャッチコピーの上に配置（先頭にLucideアイコンw-4 h-4を添える）
- キャッチコピーはfont-displayで大胆に大きく（text-4xl sm:text-6xl lg:text-7xl）、一部にグラデーションテキストを使って洗練感を出す
- キャッチコピーの下に1〜2行の短い説明文（font-sans、text-base〜text-lg、opacity-80、max-w-2xl）
- CTAボタン: px-8 py-4 rounded-full、アクセント色背景、font-weight: 600、hover時にscale(1.05)とshadow増加、テキスト左にLucideアイコン（phone, arrow-right等）（BEAUTYのみアウトラインスタイル）
- ヒーロー下部にスクロールインジケーター（chevron-downアイコン、scrollBounceアニメーション）
- ヒーローテキストの最大幅: max-w-2xl（640px）
- すべてのz-indexを明示: 装飾背景 z-0、パターン z-1、ぼかし円 z-2、業種英字 z-3、コンテンツ z-10

### 各セクション共通ルール
- セクション冒頭: 英字ラベル（小さく、ラベルフォント、アクセント色）→ 日本語見出し（大きく、ディスプレイフォント）→ 装飾線（w-12 h-[3px] bg-gradient accent→accentLight）
- セクション間パディング: ページ長ルールで指定されたpy値を使用
- 余白を贅沢に使うこと。詰め込まない。呼吸できる空間を作る
- セクションヘッダーとコンテンツの間: mb-12〜mb-16
- カード間のgap: gap-6〜gap-8
- 説明文の最大幅: max-w-2xl〜max-w-3xl
- モバイル: px-5 py-14 / タブレット: sm:px-8 sm:py-20 / デスクトップ: lg:px-16 lg:py-28

### カードデザイン（業種別タイプ）
- Aタイプ（LEGAL・MEDICAL）: border-left 4px solid accent色、padding: 1.5rem、rounded-lg、bg-cardBg
- Bタイプ（BEAUTY・SCHOOL・GENERAL）: shadow-lg、rounded-2xl、bg-cardBg、hover時にtranslateY(-6px) + shadow-xl
- Cタイプ（FOOD・CONSTRUCTION）: アイコンを上部に配置（アイコン背景: w-12 h-12 rounded-xl bg-accent/12）、rounded-xl、shadow-sm

### アイコン装飾ルール（リッチに使うこと）
- 特徴カード内のアイコン: w-14 h-14 rounded-2xl、背景アクセント色opacity-12%（例: background: rgba(accent_rgb, 0.12)）、アイコン自体は w-7 h-7 アクセント色
- 連絡先アイコン: w-5 h-5 + テキスト を flex items-center gap-3 で横並び
- ヘッダー: サイト名の左にブランドアイコン（業種推奨アイコンの1つ）を配置
- フッター: 連絡先各項目にアイコンを付与（phone, mail, map-pin, clock 等）
- セクション見出し: 英字ラベルの左に小さなアイコン（w-4 h-4）を添える
- CTAボタン: テキスト左にアイコン（例: phone, mail, arrow-right）を配置
- ヒーローセクション: スクロールインジケーターに chevron-down アイコンを使用
- 各セクションに最低1つはLucideアイコンを使用すること（装飾含む）
- 1カードに2個以上のアイコンは禁止（ただしCTAボタンのアイコンは別カウント）

### 連絡先アイコンマッピング（【連絡先情報】に実際にある項目だけ使用。無い項目は出さない）
- 電話番号 → phone（tel:リンク必須）
- 携帯番号 → smartphone（tel:リンク必須）
- メールアドレス → mail（mailto:リンク必須）
- 住所 → map-pin
- 営業時間 → clock
- 定休日 → calendar-x
- LINEアカウント → message-circle
- FAX → printer
- 予約サイトURL・外部予約ページ → calendar-check または external-link（hrefリンク必須）

### 特徴カードのアイコン選択指針
- 実績・経験・認定 → award または badge-check
- 安心・安全・保証 → shield-check または heart-handshake
- スピード・即日 → zap または timer
- 丁寧・親切・サポート → heart または smile
- 専門性・技術 → wrench または microscope
- アクセス・駅近 → map-pin または train
- 価格・コスパ → tag または coins
- 予約・事前確認 → calendar または clock

### LEGAL系で使うナンバリング装飾
- 01, 02, 03 を大きく薄く表示（opacity: 0.06、font-size: clamp(80px,15vw,200px)）
- position: absolute で対応するカード・セクション背景に重ねる

### 縦書きテキスト（writing-mode: vertical-rl）の制約（必須）
- 縦書きテキストはキャッチコピーなど短いテキスト（15文字以内）にのみ使用すること。説明文のような長文を縦書きにしてはいけない
- 縦書きテキストのfont-sizeは max-height: 65vh で収まるサイズにすること。目安: text-2xl md:text-3xl lg:text-4xl + tracking-[0.2em] なら15文字程度が収まる
- letter-spacingは 0.2em 以下にすること（0.3em以上だとすぐはみ出す）
- 長文の説明文は必ず横書き（通常レイアウト）で配置すること
- モバイル（md未満）では縦書きを使わず、横書きに切り替えること（hidden md:block / md:hidden で出し分け）
- overflow: hidden で切り捨てるのは禁止（テキストが読めなくなるため）

### ホワイトスペース
- ヘッダーは fixed top-0、backdrop-blur-md、bg-white/80（ダークテーマはbg-black/80）、z-50、サイト名 + CTA（small）
- ヒーローはヘッダー分の上パディングを確保（pt-24 程度）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【CSS装飾テクニック（<style>内に定義）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- @keyframes fadeUp: opacity 0→1、translateY(30px)→0、ease-out 0.8s
- @keyframes float: translateY(0)→translateY(-10px)→translateY(0)、ease-in-out 3s infinite（装飾要素用）
- @keyframes scrollBounce: translateY(0)→translateY(8px)→translateY(0)、ease-in-out 1.5s infinite（スクロールインジケーター用）
- カードホバー: transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
- スムーズスクロール: html { scroll-behavior: smooth; }
- ヘッダー: backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.1)
- グラデーションテキスト（BEAUTYで積極使用）: background: linear-gradient() + -webkit-background-clip: text + color: transparent
- ドットパターン背景（SCHOOL推奨）: background-image: radial-gradient(circle, ${p.accent}22 1px, transparent 1px); background-size: 24px 24px
- overflow-x: hidden を body に設定
- フッター: ダーク背景（${p.sectionBgDark}）、サイト名 + コピーライト「© 2026 ${formData.siteName}」+ 小さく "Powered by OnePage-Flash"

### 追加リッチ装飾（必ず取り入れること）
- セクション区切り: セクション間に装飾的な区切り要素を入れる。以下のいずれかを使用:
  - SVGウェーブ区切り: CSSで曲線的な区切り線（::before / ::after で表現）
  - グラデーションライン: 横幅40%の細いグラデーションライン（mx-auto, h-px, accent→transparent）
  - ドット区切り: 3つの小さなドット（w-1.5 h-1.5 rounded-full）を横並びで配置
- アイコンバッジ: 特徴カードのアイコンは単なる丸背景ではなく、グラデーション背景やリング装飾（ring-2 ring-accent/20）を加えてリッチに
- 見出しの装飾: セクション見出しの下に装飾ライン（w-16 h-1 bg-gradient-to-r from-accent to-accentLight rounded-full）を配置
- ヒーロー装飾: ヒーロー内に複数の装飾要素を配置（薄い円形グラデーション、radial-gradient重ね、幾何学的なCSS図形をopacity: 0.03〜0.08で）
- カード装飾: カードの左上または右上に小さなアクセント装飾（w-12 h-12 の薄いグラデーション円）を配置（position: absolute）
- 統計・実績数字がある場合: 大きなフォントサイズ（text-4xl〜text-5xl）+ font-weight: 700 で目立たせ、単位は小さく表示
- CTAセクション: CTAボタンの周囲に薄いリング装飾やパルスアニメーション（@keyframes pulse）を追加

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【日本語テキスト品質ルール（必須）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 文字・テキストの扱い
- 日本語テキストが途中で途切れたり、文字化けしたりしないこと
- HTMLエンティティ（&amp; &lt; &gt; 等）を不必要に使わない。日本語テキストはそのまま記述
- 全角・半角の混在に注意: 電話番号は半角数字、日本語の括弧は全角「」を使用
- lang="ja" を html タグに必ず設定

### 改行・レイアウト
- 長い日本語テキストは適切な箇所で改行（word-break: break-all は使わない）
- overflow-wrap: break-word を body に設定（長いURLやメールアドレスの折り返し）
- テーブルレイアウトは使わない（すべてFlexboxまたはGrid）
- 日本語テキストの幅: max-w-prose（65ch）またはmax-w-2xl を設定し、一行が長くなりすぎないようにする
- 連絡先情報の各項目（電話・メール・住所・営業時間）は改行して見やすく整理する

### フォントレンダリング
- -webkit-font-smoothing: antialiased を body に設定
- text-rendering: optimizeLegibility を body に設定
- font-feature-settings: "palt" を日本語フォントに設定（プロポーショナルメトリクス）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【レスポンシブ（必須）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- body に overflow-x: hidden を設定
- モバイル（320px）でも美しく表示されること（横スクロール一切禁止）
- グリッドは grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-3
- 見出しテキストサイズ: text-2xl sm:text-4xl lg:text-5xl のようにブレークポイントで調整
- タッチターゲットは最小44px

### 【必須】ボタン・CTA・連絡先がスマホ幅で見切れないこと
- 電話番号・メール・予約などの CTA ボタンは、スマホ幅（最小320px）で**絶対にはみ出さない**こと。
- ボタンに white-space: nowrap を使わない（長い電話番号やラベルで画面外に飛び出す原因）。
- ボタンは max-width:100% とし、テキストは折り返し可（overflow-wrap:anywhere）にする。横パディングは過大にしない（モバイルは px-5〜px-6 程度）。
- CTA を横並びにする場合は flex-wrap（flex-col sm:flex-row 等）で、狭い画面では縦積みにする。各ボタンは幅いっぱい（w-full sm:w-auto）にしてはみ出しを防ぐ。
- ヒーローや見出しの英字超大型装飾テキスト（clamp や text-[〇vw]）は、はみ出しても body の overflow-x:hidden で切り、**横スクロールを発生させない**。装飾は position:absolute + overflow:hidden の親でクリップする。
- 固定ヘッダー内のサイト名 + CTA も、狭い画面で重ならない・はみ出さないように（サイト名は truncate 可、CTA は小さめ）。
- 表・長いURL・メールアドレスは overflow-wrap:break-word で折り返す。
- 画像は使わないが、iframe（地図）は width:100% + 親 max-w-full で画面幅に収める。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【SEO・構造化データ（head内に必ず含めること）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

以下のメタタグと構造化データを <head> 内に必ず含めること（既存のtitle・descriptionに加えて）:

### 必須メタタグ
- <meta name="robots" content="index, follow">
- <meta property="og:type" content="website">
- <meta property="og:title" content="[サイト名 - キャッチコピー]">
- <meta property="og:description" content="[サイトの説明（80文字以内）]">
- <meta property="og:locale" content="ja_JP">
- <meta name="twitter:card" content="summary">
- <meta name="twitter:title" content="[サイト名]">
- <meta name="twitter:description" content="[サイトの説明（80文字以内）]">

### JSON-LD構造化データ（<script type="application/ld+json">で記述）
業種推定結果に基づいて、以下のいずれかのスキーマを生成すること:

- MEDICAL → LocalBusiness + MedicalBusiness
- BEAUTY → LocalBusiness + HealthAndBeautyBusiness
- FOOD → LocalBusiness + FoodEstablishment
- LEGAL → LocalBusiness + ProfessionalService
- SCHOOL → LocalBusiness + EducationalOrganization
- CONSTRUCTION → LocalBusiness + HomeAndConstructionBusiness
- GENERAL → LocalBusiness

JSON-LDに含めるフィールド（連絡先情報から抽出）:
- name: サイト名
- description: キャッチコピーまたは説明文の要約（100文字以内）
- telephone: 電話番号（あれば）
- email: メールアドレス（あれば）
- address: 住所（あれば、PostalAddress型で）
- openingHours: 営業時間（あれば）

※ 連絡先情報に含まれていない項目は省略すること（捏造禁止）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【お問い合わせフォーム（必須）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

連絡先セクションまたは専用セクションに、お問い合わせフォームを必ず1つ設置すること。

HTMLフォーム仕様:
- <form action="https://formspree.io/f/xpwddjaw" method="POST"> を使用
- フィールド:
  1. お名前: <input type="text" name="name" required placeholder="お名前">
  2. メール: <input type="email" name="email" required placeholder="メールアドレス">
  3. お問い合わせ内容: <textarea name="message" required placeholder="お問い合わせ内容" rows="4"></textarea>
  4. 送信ボタン: <button type="submit">送信する</button>
- 各フィールドにラベル（<label>）を付けること
- Tailwindでスタイリング: 入力欄は w-full px-4 py-3 border rounded-lg、ボタンはアクセント色背景
- フォームの上に「お気軽にお問い合わせください」等の見出しを配置

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【Googleマップ埋め込み（住所がある場合は必須）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

連絡先情報に住所が含まれている場合、Googleマップを埋め込むこと。

埋め込み方法:
- <iframe src="https://maps.google.com/maps?q={住所をURLエンコード}&output=embed" width="100%" height="300" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
- 住所の日本語をそのままURLエンコードして使用（例: 名古屋市天白区原3-1-1 → %E5%90%8D%E5%8F%A4%E5%B1%8B...）
- レスポンシブ対応: width="100%", rounded-xl, overflow-hidden のdivで囲む
- アクセスセクションまたは連絡先セクションに配置
- 住所が連絡先情報に含まれていない場合は省略してよい

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【出力形式】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HTMLコードのみを出力してください。
\`\`\`html のようなコードブロック記法は不要です。
説明文やコメント（業種推定HTMLコメントを除く）も不要です。
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
