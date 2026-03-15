/**
 * PostgreSQL 接続モジュール
 *
 * pg Pool を使用してコネクションプーリングを行う。
 * Render や Railway などの外部PostgreSQLサービスに接続する際は SSL が必要。
 *
 * 使用するテーブル:
 *   - sites: 生成済みサイトの情報（slug, email, revision_token, revision_count など）
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// コネクションプール（遅延初期化: 環境変数未設定でもビルドを通す）
// ---------------------------------------------------------------------------

const globalForPg = globalThis as unknown as { pgPool?: Pool };

function getPool(): Pool {
  if (globalForPg.pgPool) return globalForPg.pgPool;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing environment variable: DATABASE_URL");
  }

  // Render PostgreSQL は SSL 必須。DATABASE_URL に localhost が含まれる場合のみ SSL を無効化
  const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  globalForPg.pgPool = pool;
  return pool;
}

export default new Proxy({} as Pool, {
  get(_, prop) {
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ---------------------------------------------------------------------------
// ヘルパー関数
// ---------------------------------------------------------------------------

/**
 * クエリを実行するヘルパー関数
 *
 * @param text - SQLクエリ文字列（プレースホルダーは $1, $2, ... 形式）
 * @param params - プレースホルダーに対応するパラメータ配列
 * @returns QueryResult
 *
 * @example
 * const result = await query(
 *   'SELECT * FROM sites WHERE slug = $1',
 *   ['my-site']
 * );
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * トランザクションを実行するヘルパー関数
 *
 * @param fn - トランザクション内で実行するコールバック
 * @returns コールバックの戻り値
 *
 * @example
 * const result = await withTransaction(async (client) => {
 *   await client.query('UPDATE sites SET revision_count = $1 WHERE slug = $2', [count, slug]);
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 旧 sites テーブル型（後方互換: revise/route.ts 等で使用）
// ---------------------------------------------------------------------------

/** @deprecated opf_sites に移行予定 */
export interface SiteRow {
  id: string;
  slug: string;
  site_name: string;
  email: string;
  revision_token: string;
  revision_count: number;
  stripe_session_id: string;
  color_theme: "simple" | "colorful" | "business";
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// opf_* テーブル型定義
// ---------------------------------------------------------------------------

export interface OpfUserRow {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

export interface OpfSubscriptionRow {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  status: "active" | "past_due" | "canceled" | "trialing";
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
  payment_source: "stripe" | "coconala";
  coconala_order_id: string | null;
  expires_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

export interface OpfSiteRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  subdomain: string;
  r2_key: string | null;
  site_name: string | null;
  is_active: boolean;
  is_published: boolean;
  input_snapshot: Record<string, unknown> | null;
  revision_token: string | null;
  revision_token_expires_at: Date | null;
  revision_count: number;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// テーブルマイグレーション
// ---------------------------------------------------------------------------

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS opf_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opf_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES opf_users(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opf_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES opf_users(id),
  subscription_id UUID REFERENCES opf_subscriptions(id),
  subdomain VARCHAR(63) UNIQUE NOT NULL,
  r2_key VARCHAR(255),
  site_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,
  input_snapshot JSONB,
  revision_token VARCHAR(255),
  revision_token_expires_at TIMESTAMPTZ,
  revision_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opf_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES opf_sites(id),
  instruction TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opf_ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES opf_users(id),
  event_type TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  session_id TEXT,
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opf_ad_events_event_type ON opf_ad_events(event_type);
CREATE INDEX IF NOT EXISTS idx_opf_ad_events_created_at ON opf_ad_events(created_at);
CREATE INDEX IF NOT EXISTS idx_opf_ad_events_session_id ON opf_ad_events(session_id);

CREATE TABLE IF NOT EXISTS opf_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id VARCHAR(255) UNIQUE NOT NULL,
  html TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE TABLE IF NOT EXISTS opf_html_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain VARCHAR(63) UNIQUE NOT NULL,
  html TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opf_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opf_error_logs_api_name ON opf_error_logs(api_name);
CREATE INDEX IF NOT EXISTS idx_opf_error_logs_created_at ON opf_error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_opf_error_logs_level ON opf_error_logs(level);
`;

/** opf_* テーブルが存在しなければ作成する */
export async function ensureTablesExist(): Promise<void> {
  await query(MIGRATION_SQL);
}

// ---------------------------------------------------------------------------
// opf_users CRUD
// ---------------------------------------------------------------------------

export async function findOrCreateUser(email: string, stripeCustomerId?: string): Promise<OpfUserRow> {
  // UPSERT: emailが既存ならそのまま返す、なければ作成
  const result = await query<OpfUserRow>(
    `INSERT INTO opf_users (email, stripe_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET
       stripe_customer_id = COALESCE(opf_users.stripe_customer_id, EXCLUDED.stripe_customer_id),
       updated_at = NOW()
     RETURNING *`,
    [email, stripeCustomerId ?? null]
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// opf_subscriptions CRUD
// ---------------------------------------------------------------------------

export async function createSubscription(params: {
  userId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}): Promise<OpfSubscriptionRow> {
  const result = await query<OpfSubscriptionRow>(
    `INSERT INTO opf_subscriptions (user_id, stripe_subscription_id, status, current_period_start, current_period_end)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.userId, params.stripeSubscriptionId, params.status, params.currentPeriodStart ?? null, params.currentPeriodEnd ?? null]
  );
  return result.rows[0];
}

export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<OpfSubscriptionRow | null> {
  const result = await query<OpfSubscriptionRow>(
    `SELECT * FROM opf_subscriptions WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId]
  );
  return result.rows[0] ?? null;
}

export async function updateSubscriptionStatus(stripeSubscriptionId: string, status: string, canceledAt?: Date): Promise<void> {
  await query(
    `UPDATE opf_subscriptions SET status = $2, canceled_at = $3, updated_at = NOW() WHERE stripe_subscription_id = $1`,
    [stripeSubscriptionId, status, canceledAt ?? null]
  );
}

// ---------------------------------------------------------------------------
// opf_sites CRUD
// ---------------------------------------------------------------------------

export async function createSite(params: {
  userId: string;
  subscriptionId: string;
  subdomain: string;
  siteName: string;
  inputSnapshot: Record<string, unknown>;
}): Promise<OpfSiteRow> {
  const revisionToken = crypto.randomUUID();
  const result = await query<OpfSiteRow>(
    `INSERT INTO opf_sites (user_id, subscription_id, subdomain, r2_key, site_name, is_active, is_published, input_snapshot, revision_token, revision_token_expires_at, revision_count)
     VALUES ($1, $2, $3, $4, $5, true, true, $6, $7, NOW() + INTERVAL '30 days', 0)
     RETURNING *`,
    [params.userId, params.subscriptionId, params.subdomain, `${params.subdomain}/index.html`, params.siteName, JSON.stringify(params.inputSnapshot), revisionToken]
  );
  return result.rows[0];
}

export async function getSiteBySubscriptionId(subscriptionId: string): Promise<OpfSiteRow | null> {
  const result = await query<OpfSiteRow>(
    `SELECT * FROM opf_sites WHERE subscription_id = $1`,
    [subscriptionId]
  );
  return result.rows[0] ?? null;
}

export async function getSiteBySubdomain(subdomain: string): Promise<OpfSiteRow | null> {
  const result = await query<OpfSiteRow>(
    `SELECT * FROM opf_sites WHERE subdomain = $1`,
    [subdomain]
  );
  return result.rows[0] ?? null;
}

export async function getSiteByRevisionToken(token: string): Promise<{ site: OpfSiteRow | null; expired: boolean }> {
  const result = await query<OpfSiteRow>(
    `SELECT * FROM opf_sites WHERE revision_token = $1`,
    [token]
  );
  const site = result.rows[0] ?? null;
  if (!site) return { site: null, expired: false };
  const expired = site.revision_token_expires_at
    ? new Date(site.revision_token_expires_at) < new Date()
    : false;
  return { site, expired };
}

export async function updateSiteIsActive(subdomain: string, isActive: boolean): Promise<void> {
  await query(
    `UPDATE opf_sites SET is_active = $2, updated_at = NOW() WHERE subdomain = $1`,
    [subdomain, isActive]
  );
}

export interface OpfAdEventRow {
  id: string;
  user_id: string | null;
  event_type: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  session_id: string | null;
  page_url: string | null;
  referrer: string | null;
  user_agent: string | null;
  created_at: Date;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// opf_error_logs CRUD
// ---------------------------------------------------------------------------

export interface OpfErrorLogRow {
  id: string;
  api_name: string;
  level: string;
  message: string;
  context: Record<string, unknown> | null;
  created_at: Date;
}

export async function insertErrorLog(params: {
  apiName: string;
  level?: "error" | "warn" | "info";
  message: string;
  context?: Record<string, string | number | undefined>;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO opf_error_logs (api_name, level, message, context)
       VALUES ($1, $2, $3, $4)`,
      [
        params.apiName,
        params.level ?? "error",
        params.message,
        params.context ? JSON.stringify(params.context) : null,
      ]
    );
  } catch {
    // DB書き込み失敗でもアプリは止めない
  }
}

// ---------------------------------------------------------------------------
// opf_ad_events CRUD
// ---------------------------------------------------------------------------

export async function insertAdEvent(params: {
  eventType: string;
  userId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  sessionId?: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  gclid?: string;
  step?: string;
}): Promise<void> {
  // form_step イベントの場合、event_type を "form_step_N" 形式で保存
  const eventType = params.step
    ? `${params.eventType}_${params.step}`
    : params.eventType;

  // gclid は utm_content カラムに "(gclid:xxx)" として付与（DBスキーマ変更不要）
  let utmContent = params.utmContent ?? null;
  if (params.gclid && !utmContent) {
    utmContent = `gclid:${params.gclid}`;
  } else if (params.gclid && utmContent) {
    utmContent = `${utmContent}|gclid:${params.gclid}`;
  }

  await query(
    `INSERT INTO opf_ad_events (event_type, user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, session_id, page_url, referrer, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      eventType,
      params.userId ?? null,
      params.utmSource ?? null,
      params.utmMedium ?? null,
      params.utmCampaign ?? null,
      utmContent,
      params.utmTerm ?? null,
      params.sessionId ?? null,
      params.pageUrl ?? null,
      params.referrer ?? null,
      params.userAgent ?? null,
    ]
  );
}

// ---------------------------------------------------------------------------
// ココナラ連携: サブスクリプション・課金管理
// ---------------------------------------------------------------------------

export async function createCoconalaSubscription(params: {
  userId: string;
  coconalaOrderId?: string;
  notes?: string;
  expiryDays?: number;
}): Promise<OpfSubscriptionRow> {
  const fakeSubId = params.coconalaOrderId
    ? `coconala_${params.coconalaOrderId}`
    : `coconala_${crypto.randomUUID()}`;
  const days = params.expiryDays ?? 365;
  const result = await query<OpfSubscriptionRow>(
    `INSERT INTO opf_subscriptions (user_id, stripe_subscription_id, status, payment_source, coconala_order_id, expires_at, notes)
     VALUES ($1, $2, 'active', 'coconala', $3, NOW() + INTERVAL '${days} days', $4)
     RETURNING *`,
    [params.userId, fakeSubId, params.coconalaOrderId ?? null, params.notes ?? null]
  );
  return result.rows[0];
}

export async function extendSubscriptionExpiry(
  subscriptionId: string,
  days: number = 35
): Promise<{ newExpiresAt: Date }> {
  const result = await query<{ expires_at: Date }>(
    `UPDATE opf_subscriptions
     SET expires_at = GREATEST(expires_at, NOW()) + ($2 || ' days')::INTERVAL,
         status = 'active',
         updated_at = NOW()
     WHERE id = $1
     RETURNING expires_at`,
    [subscriptionId, days.toString()]
  );
  return { newExpiresAt: result.rows[0].expires_at };
}

export interface OpfPaymentLogRow {
  id: string;
  subscription_id: string;
  confirmed_at: Date;
  period_start: Date;
  period_end: Date;
  amount: number;
  source: string;
  memo: string | null;
  created_at: Date;
}

export async function insertPaymentLog(params: {
  subscriptionId: string;
  amount?: number;
  source?: string;
  memo?: string;
}): Promise<{ id: string; confirmedAt: Date; periodStart: Date; periodEnd: Date }> {
  const result = await query<OpfPaymentLogRow>(
    `INSERT INTO opf_payment_logs (subscription_id, period_start, period_end, amount, source, memo)
     VALUES ($1, CURRENT_DATE, CURRENT_DATE + INTERVAL '35 days', $2, $3, $4)
     RETURNING *`,
    [params.subscriptionId, params.amount ?? 1000, params.source ?? "coconala", params.memo ?? null]
  );
  const row = result.rows[0];
  return { id: row.id, confirmedAt: row.confirmed_at, periodStart: row.period_start, periodEnd: row.period_end };
}

// ---------------------------------------------------------------------------
// 顧客一覧（Stripe + ココナラ統合）
// ---------------------------------------------------------------------------

export interface CustomerListItem {
  siteId: string;
  subdomain: string;
  siteName: string | null;
  email: string;
  paymentSource: "stripe" | "coconala";
  coconalaOrderId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string;
  isActive: boolean;
  expiresAt: Date | null;
  daysRemaining: number | null;
  createdAt: Date;
  lastPaymentConfirmedAt: Date | null;
}

export async function getCustomerList(params?: {
  filter?: "all" | "active" | "inactive" | "expiring";
  search?: string;
}): Promise<{ customers: CustomerListItem[]; summary: { total: number; active: number; inactive: number; stripeCount: number; coconalaCount: number; expiringCount: number } }> {
  const filter = params?.filter ?? "all";
  const search = params?.search?.trim() ?? "";

  let whereClause = "WHERE 1=1";
  const queryParams: unknown[] = [];
  let paramIndex = 1;

  if (filter === "active") {
    whereClause += ` AND s.is_active = true`;
  } else if (filter === "inactive") {
    whereClause += ` AND s.is_active = false`;
  } else if (filter === "expiring") {
    whereClause += ` AND sub.payment_source = 'coconala' AND sub.expires_at IS NOT NULL AND sub.expires_at < NOW() + INTERVAL '7 days' AND s.is_active = true`;
  }

  if (search) {
    whereClause += ` AND (s.site_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  const result = await query<{
    site_id: string;
    subdomain: string;
    site_name: string | null;
    email: string;
    payment_source: string | null;
    coconala_order_id: string | null;
    subscription_id: string | null;
    subscription_status: string | null;
    is_active: boolean;
    expires_at: Date | null;
    days_remaining: number | null;
    created_at: Date;
    last_payment_confirmed_at: Date | null;
  }>(
    `SELECT
       s.id as site_id,
       s.subdomain,
       s.site_name,
       u.email,
       COALESCE(sub.payment_source, 'stripe') as payment_source,
       sub.coconala_order_id,
       sub.id as subscription_id,
       sub.status as subscription_status,
       s.is_active,
       sub.expires_at,
       CASE WHEN sub.expires_at IS NOT NULL THEN EXTRACT(DAY FROM sub.expires_at - NOW())::INT ELSE NULL END as days_remaining,
       s.created_at,
       (SELECT MAX(pl.confirmed_at) FROM opf_payment_logs pl WHERE pl.subscription_id = sub.id) as last_payment_confirmed_at
     FROM opf_sites s
     LEFT JOIN opf_subscriptions sub ON s.subscription_id = sub.id
     LEFT JOIN opf_users u ON s.user_id = u.id
     ${whereClause}
     ORDER BY s.created_at DESC`,
    queryParams
  );

  const customers: CustomerListItem[] = result.rows.map((r) => ({
    siteId: r.site_id,
    subdomain: r.subdomain,
    siteName: r.site_name,
    email: r.email,
    paymentSource: (r.payment_source === "coconala" ? "coconala" : "stripe") as "stripe" | "coconala",
    coconalaOrderId: r.coconala_order_id,
    subscriptionId: r.subscription_id,
    subscriptionStatus: r.subscription_status ?? "unknown",
    isActive: r.is_active,
    expiresAt: r.expires_at,
    daysRemaining: r.days_remaining,
    createdAt: r.created_at,
    lastPaymentConfirmedAt: r.last_payment_confirmed_at,
  }));

  // Summary counts (from all data, not filtered)
  const summaryResult = await query<{
    total: string;
    active: string;
    inactive: string;
    stripe_count: string;
    coconala_count: string;
    expiring_count: string;
  }>(
    `SELECT
       COUNT(*)::TEXT as total,
       COUNT(*) FILTER (WHERE s.is_active = true)::TEXT as active,
       COUNT(*) FILTER (WHERE s.is_active = false)::TEXT as inactive,
       COUNT(*) FILTER (WHERE COALESCE(sub.payment_source, 'stripe') = 'stripe')::TEXT as stripe_count,
       COUNT(*) FILTER (WHERE sub.payment_source = 'coconala')::TEXT as coconala_count,
       COUNT(*) FILTER (WHERE sub.payment_source = 'coconala' AND sub.expires_at IS NOT NULL AND sub.expires_at < NOW() + INTERVAL '7 days' AND s.is_active = true)::TEXT as expiring_count
     FROM opf_sites s
     LEFT JOIN opf_subscriptions sub ON s.subscription_id = sub.id`
  );

  const sr = summaryResult.rows[0];
  return {
    customers,
    summary: {
      total: parseInt(sr.total),
      active: parseInt(sr.active),
      inactive: parseInt(sr.inactive),
      stripeCount: parseInt(sr.stripe_count),
      coconalaCount: parseInt(sr.coconala_count),
      expiringCount: parseInt(sr.expiring_count),
    },
  };
}
