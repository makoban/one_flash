# 作業記録 / 引き継ぎメモ（Codex 併読用）

このファイルは Claude Code セッションで行った変更の記録です。Codex も参照します。
対象リポジトリ: `one_flash-deploy`（OnePage-Flash / Next.js 16 + Cloudflare Worker + Postgres + Stripe + Gemini + R2）

最終更新: 2026-07-02

---

## 全体サマリー

セキュリティ修正、Webhook 整合性、revise 上限、そして「完成しました！から進まない」UX/スクリーンショット
不具合を修正した。**いずれも既存顧客に影響が出ないこと**を最優先に、冪等・後方互換な形で実装している。

デプロイは **Render の再デプロイのみ**で反映される（Cloudflare Worker の変更は不要）。
`ADMIN_PASSWORD` は既存の環境変数で追加設定不要。既存 DB へのマイグレーション操作も不要（冪等）。

---

## 1. セキュリティ修正

### 1-1. `/api/publish` に認証を追加（重大: サイト乗っ取り防止）
- ファイル: `src/app/api/publish/route.ts`
- 背景: このルートは無認証で、サーバ側が `UPLOAD_SECRET` を付けて Worker に転送していた。
  Worker の `handlePublish` は `password` 未指定/任意指定で既存サイトを上書きしパスワードを再生成する
  （`workers/site-router.js` の該当ロジック）。そのため**任意のサブドメインを乗っ取り可能**だった。
- 修正内容:
  - 管理者パスワード（`pw === ADMIN_PASSWORD`）が一致する場合のみ無条件公開（スクリプト/admin 用）。
  - それ以外は Worker `/_api/verify` でサイトパスワードを照合し、一致した時だけ公開を許可。
    - verify 404（サイト無）→ 匿名新規公開は不可として拒否。
    - verify 403（誤パスワード）→ 拒否。
  - **正規の編集フロー**（`/edit` → `/api/verify` 認証 → 同じ password を再送）は影響なし。
- 呼び出し元: `src/app/edit/page.tsx`（再公開）、`scripts/regenerate-samples.mjs`（新規＝管理者 pw を送るよう更新済み）。

### 1-2. `/api/migrate` に管理者認証を追加
- ファイル: `src/app/api/migrate/route.ts`
- 無認証で `ensureTablesExist()` を叩けた。`ADMIN_PASSWORD` を必須化
  （`?pw=` または `Authorization: Bearer`）。冪等なので既存 DB には無害。

### 1-3. レート制限の対象拡張（総当たり防止）
- ファイル: `src/middleware.ts`
- `/api/verify`（10/分）と `/api/publish`（10/分）を追加。サイトパスワード（英大文字＋数字8桁）の
  ブルートフォースを抑止。既存の `/api/generate`(5) `/api/create-checkout-session`(3) `/api/revise`(5) は据え置き。
- 注意: middleware のレート制限は in-memory Map。Render 単一インスタンス前提。スケールアウト時は
  外部ストア（Redis 等）への移行が必要（既知の設計上の制約）。

### 1-4. マイグレーション SQL の欠落補完（新規 DB 構築時のみ効果）
- ファイル: `src/lib/db.ts`（`MIGRATION_SQL`）
- コードが使用しているが CREATE 文が無かったものを冪等に追加:
  - `opf_subscriptions` に `payment_source`（既定 'stripe'）/ `coconala_order_id` / `expires_at` / `notes`
    を `ADD COLUMN IF NOT EXISTS` で追加。
  - `opf_payment_logs` テーブルを `CREATE TABLE IF NOT EXISTS` で追加（+ index）。
- 既存本番 DB は手動 ALTER 済みのため完全な no-op。新規 DB でココナラ連携/顧客一覧が壊れないようにする目的。

---

## 2. Stripe Webhook の整合性修正

ファイル: `src/app/api/webhook/stripe/route.ts`

### 2-1. サブドメイン衝突ガード（既存顧客サイトの上書き事故防止）
- 背景: 通常フローのサブドメインは `CardStepForm` が `Math.random()` で採番（`site-xxxxxxxx`）。
  Webhook は **R2 公開 → DB 登録**の順で、公開が先。衝突すると Worker が既存サイトを上書きし
  パスワード再生成してしまう（＝既存顧客に実害）。
- 修正: 公開前に `getSiteHTML(subdomain)` で存在確認し、使用中なら別サブドメインを再採番
  （`ensureFreeSubdomain` / `generateSubdomainCandidate`）。以降の R2 公開・`createSite`・公開 URL・
  完了メールは `publishSubdomain` を使用。
- 衝突で採番し直した場合は `stripe.checkout.sessions.update` で `metadata.subdomain` を更新し、
  `/complete` の `check-site-status` ポーリングが正しいサイトを検出できるようにした（ベストエフォート）。

### 2-2. `invoice.payment_succeeded` の期間更新の行選択
- 背景: 初回請求は「初期制作費（単発）」＋「月額（継続）」の2行を含む。従来 `lines.data[0]` 固定で、
  単発行の期間で上書きする恐れがあった。
- 修正: `price.recurring` を持つ行を優先 → period 完備の行 → `data[0]` の順で選択。

---

## 3. revise（修正機能）の行き止まり解消

ファイル: `src/app/api/revise/route.ts`, `src/app/revise/page.tsx`

- 背景: 3回目以降は 402 `requiresPayment` を返すだけで決済導線が無く、実際には修正不能な行き止まり。
  かつ「500円の決済が必要」という**存在しない支払い**を案内していた。
- 方針（ユーザー決定）: **有料化はせず、無料回数を増やす**。
- 修正:
  - `FREE_REVISION_LIMIT` を `2` → `5`。
  - 上限超過時は 403 ＋ 正直な文言（「無料修正の上限（5回）に達しました。追加の修正をご希望の場合はお問い合わせください。」）。
  - フロントの受け取り（402/`requiresPayment` → 403/`limitReached`）と注意書きも整合。
  - 未使用 import（`findOrCreateUser`, `OpfSiteRow`）を削除。
- 注意: `src/components/StepForm.tsx` は「¥5,000 買い切り / 無料修正2回付き」等、実商品
  （初期¥3,980＋月額¥480）と全く異なる**未使用の旧コンポーネント**（どこからも import されていない）。
  今回は触っていない。整理する場合は削除候補。

---

## 4. 「完成しました！から進まない」UX / スクリーンショット不具合（本セッションの主対応）

### 症状
スマホで生成中に「完成しました！」表示後に長時間進まず、`navigation timeout ... exceeded` で失敗することがある。

### 原因
1. **UX**: `src/app/create/page.tsx` の生成中メッセージが**時間ベース**（2秒間隔）で、8秒で
   「完成しました！」に到達して固定されていた。実処理（AI 生成 + Puppeteer スクショ2枚）は
   それより遥かに長いため、完了前に「完成しました！」と嘘表示 → 壊れて見える。
2. **スクショのハング/失敗**: `src/app/api/screenshot/route.ts` が `waitUntil: "networkidle0"`
   （接続が完全に 0 になるまで待機）を使用。生成 HTML は Google Fonts / lucide / 外部画像などの
   CDN を読み込むため、これらが滞留すると成立せずタイムアウト（＝navigation timeout）で全体失敗。

### 修正
- `src/app/api/screenshot/route.ts`:
  - `networkidle0` → `networkidle2` に変更。
  - `setContent` を try/catch で囲み、**タイムアウトしてもレンダリング済み内容でスクショを続行**。
  - `document.fonts.ready` を最大2秒で打ち切る `Promise.race` にしてハング防止。
- `src/app/create/page.tsx`（UX）:
  - 生成中メッセージを「作業中」文言の**ループ表示**に変更（`% length`）。時間で「完成」に到達しない。
  - `COMPLETED_MESSAGE`（"完成しました！"）は**実処理完了の瞬間だけ**表示。`handleFormSubmit` で
    生成完了後 `generationCompleted=true` にし、`COMPLETION_FLASH_MS`(900ms) 見せてから `preview` へ遷移。
  - `GeneratingView` に `completed` prop を追加。完了時は緑チェック＋「完成しました！」、
    作業中はスピナー＋ループ文言。所要目安（30秒〜1分）も明記。

### 補足（Codex 向け設計メモ）
- ユーザー要望は「HP デザイン完了後にサーバーにアップしていますなど“何かしている”お知らせ」。
  ただし**実際のサーバー公開（R2 アップロード）は決済後の Webhook で行われる**ため、生成フェーズで
  「サーバーにアップ中」と出すのは不正確。そこで生成フェーズでは実態に即した
  「プレビュー画像を生成しています…」「仕上げの調整をしています…」等の“作業中”ループ文言にした。
- もし決済後の `/complete`（`src/app/complete/page.tsx`）側の進捗表示も強化したい場合は別途対応可能
  （現状は「通常1〜3分で完成します（自動で更新されます）」を表示、`check-site-status` をポーリング）。

---

## 検証（デプロイ前）

- `next build`: 全36ルート + middleware 正常コンパイル（複数回）。
- `tsc --noEmit`: エラー 0。
- `eslint`（変更ファイル）: 警告 0（既存の `db.ts` Proxy default-export 警告のみ、変更と無関係）。
- ロジック単体（複製ハーネス, 22 アサーション）: invoice 行選択 / 衝突ガード / publish 認証分岐 / revise 上限 → 全通過。
- 実 HTTP（`next start` + fetch, 9件）: `/api/migrate` 無認証→401、各種バリデーション→400、`/api/track` 正常→200。
- レート制限: `/api/revise`(上限5) と `/api/verify`(上限10) で上限超過が 429 になることを実測。

### 未検証（本番接続/秘密鍵が必要 → デプロイ後に要確認）
- Stripe 決済 → Webhook → R2 公開 → メールの一連フロー（`scripts/e2e-full-prod.mjs`, test-mode 鍵が必要）。
- `/api/publish` のパスワード照合分岐の実通信（WORKER_URL 必須。ロジックは検証済み）。
- 実 Postgres でのマイグレーション適用（冪等。構文はビルドで通過）。
- **スマホ実機で生成 → プレビュー遷移**（今回の UX/スクショ修正の体感確認）。

---

## デプロイ後の推奨手順
1. Render 再デプロイ（Worker 変更不要）。
2. `ADMIN_PASSWORD` を使い `POST /api/migrate` を1回叩く（新テーブル/カラムの冪等反映確認）。
3. `scripts/e2e-full-prod.mjs`（test-mode Stripe 鍵）で決済〜公開を1回通す。
4. `/edit` で既存サイトにログイン → 修正 → 再公開（既存顧客フロー無影響の確認）。
5. スマホ実機で `/create` から生成し、「完成しました！」が最後に一瞬だけ出てプレビューへ遷移することを確認。

## 変更ファイル一覧
- `src/app/api/publish/route.ts`
- `src/app/api/migrate/route.ts`
- `src/middleware.ts`
- `src/lib/db.ts`
- `scripts/regenerate-samples.mjs`
- `src/app/api/webhook/stripe/route.ts`
- `src/app/api/revise/route.ts`
- `src/app/revise/page.tsx`
- `src/app/api/screenshot/route.ts`
- `src/app/create/page.tsx`

---

## 5. 本番デプロイ後の E2E 計測（2026-07-02, 本番 = oneflash.bantex.jp）

master へ push → Render 自動デプロイ（約1分で反映確認: `/api/migrate` が 200→401）。
本番 `/api/generate` + `/api/screenshot` を業種別に実測（いずれもステートレス。DB/Stripe/顧客データ非影響）。

| 業種 | 生成(AI) | 画像化(2枚) | 合計 | モデル |
|---|---|---|---|---|
| 税理士 | 75.2s | 28.4s | 103.5s | flash-lite |
| 美容室 | 73.6s | 16.5s | 90.1s | flash-lite |
| 整体院 | 73.1s | 19.7s | 92.8s | flash-lite |
| カフェ | 72.9s | 17.0s | 89.8s | flash-lite |
| 学習塾 | 75.4s | 16.4s | 91.8s | flash-lite |

- **結果: 5/5 成功（画像化まで完了、navigation timeout 失敗ゼロ）** → スクショ堅牢化・UX 修正は本番で有効。
- **合計 約90〜103秒（生成AIだけで73〜75秒）。** UX の目安表示は「30秒〜1分」→「1〜2分」に修正済み。

### ✅ 解決済み: 第一候補モデルが毎回フォールバックしていた原因（確定）
- 本番診断（`/api/generate` の `meta.fallbackReason` を一時的に追加して取得）で確定した実エラー:
  **`gemini-2.5-flash: Generated HTML does not contain closing </html> tag`**
- 原因: `GENERATION_MODEL_CONFIG.maxOutputTokens = 8192` が小さすぎ、第一候補 `gemini-2.5-flash` の
  リッチで長い HTML が `</html>` 到達前に**トークン上限で打ち切られ**、`parseGeneratorResponse`
  （`src/prompts/generator.ts`）が「closing </html> tag が無い」で throw → `isRetryableGeminiError` の
  `"generated html does not contain"` に該当 → リトライ扱いで予備 `flash-lite` に交代していた
  （flash-lite は簡素な出力で 8192 に収まり成功、20,435 字で `</html>` 到達）。
- **影響は速度だけでなく品質にも波及**: 常に能力の低い flash-lite で生成 → 指示（ダミー禁止・
  レスポンシブ）を守りにくく、ダミー連絡先やスマホ崩れの一因になっていた可能性が高い。
- 対応: `src/lib/gemini.ts` の `maxOutputTokens` を **8192 → 32768** に引き上げ（gemini-2.5 系は最大 65536）。
  これで flash が完走し、第一候補（高性能モデル）が使われるようになる想定。
- 診断コードは `src/app/api/generate/route.ts` に残置（`meta.fallbackReason`。今後の監視に有用）。

## 6. 生成内容の品質修正（2026-07-02, ユーザー報告対応）— `src/prompts/generator.ts`
ユーザー報告: (a) スマホ幅で電話ボタン等が見切れる、(b) 未入力の連絡先/営業時間がダミーで表示される、
(c) 書かれていない要素を出さないでほしい。
- **ダミー撲滅**: 「【最優先・絶対厳守】書かれていない項目は一切表示しない」ルールを追加。
  【連絡先情報】に実在する項目のみ表示、無い項目は行/アイコン/セクションごと省略、
  ダミー値（03-1234-5678, info@example.com, 9:00〜18:00 等）を明示的に禁止。住所が無ければ地図も出さない。
  矛盾していた FOOD の「営業時間・定休日は必ず表示」を「記載がある場合のみ」に修正。
- **スマホ見切れ**: レスポンシブ節を強化。CTA/電話ボタンは 320px でもはみ出さない
  （white-space:nowrap 禁止、max-width:100%、狭幅は w-full sm:w-auto で縦積み、装飾特大文字は
  overflow:hidden でクリップ、iframe は width:100%）。本番レンダリングで 320/375/414px 横スクロール無し・電話ボタン収まりを確認。

### 追加修正: ヒーローのキャッチコピー先頭が消える「で健やかな毎日を」現象（2026-07-02, ユーザー報告）
- 症状: ヒーロー見出しの先頭語が消え、助詞から始まる（例: 「笑顔で健やかな毎日を」→「で健やかな毎日を」）。
- 原因: プロンプトが「キャッチコピーの一部にグラデーションテキストを使う」よう促し、AI が
  コピーを分割して一部に独自クラス `.text-gradient`（`color:transparent; background-clip:text;`
  ＋ Tailwind CDN の `from-brand-300`/`to-white` = `var(--tw-gradient-from/to)` 依存）を適用。
  brand スケール未定義等で変数が解決されないと背景が消え、**透明の文字＝消える**。分割の前半が消えて
  助詞だけ残る。本番再現で `.text-gradient { ... color: transparent }` を確認。
- 対応（`src/prompts/generator.ts`）: キャッチコピーは**全文を単色（heroText色）で表示・分割禁止・
  透明/background-clip禁止**に変更。グラデーション文字は装飾見出し限定＋実色コード指定＋透明放置禁止に。
