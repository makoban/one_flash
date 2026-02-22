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

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
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
  const result = await query<OpfSiteRow>(
    `INSERT INTO opf_sites (user_id, subscription_id, subdomain, r2_key, site_name, is_active, is_published, input_snapshot)
     VALUES ($1, $2, $3, $4, $5, true, true, $6)
     RETURNING *`,
    [params.userId, params.subscriptionId, params.subdomain, `${params.subdomain}/index.html`, params.siteName, JSON.stringify(params.inputSnapshot)]
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

export async function updateSiteIsActive(subdomain: string, isActive: boolean): Promise<void> {
  await query(
    `UPDATE opf_sites SET is_active = $2, updated_at = NOW() WHERE subdomain = $1`,
    [subdomain, isActive]
  );
}

// ---------------------------------------------------------------------------
// opf_ad_events CRUD
// ---------------------------------------------------------------------------

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
}): Promise<void> {
  await query(
    `INSERT INTO opf_ad_events (event_type, user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, session_id, page_url, referrer, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      params.eventType,
      params.userId ?? null,
      params.utmSource ?? null,
      params.utmMedium ?? null,
      params.utmCampaign ?? null,
      params.utmContent ?? null,
      params.utmTerm ?? null,
      params.sessionId ?? null,
      params.pageUrl ?? null,
      params.referrer ?? null,
      params.userAgent ?? null,
    ]
  );
}
