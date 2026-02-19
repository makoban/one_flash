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
// 環境変数のバリデーション
// ---------------------------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing environment variable: DATABASE_URL");
}

// ---------------------------------------------------------------------------
// コネクションプール初期化
// ---------------------------------------------------------------------------

/**
 * PostgreSQL コネクションプール
 *
 * Next.js の開発環境ではホットリロードのたびにモジュールが再評価されるため、
 * グローバルキャッシュを使ってプールの多重生成を防ぐ。
 */
const globalForPg = globalThis as unknown as { pgPool?: Pool };

const pool: Pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    // 最大コネクション数（Vercel Serverless Functions の制約を考慮）
    max: 10,
    // アイドルタイムアウト: 30秒
    idleTimeoutMillis: 30_000,
    // 接続タイムアウト: 10秒
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export default pool;

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
  return pool.query<T>(text, params);
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
  const client = await pool.connect();
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

/** sites テーブルの行型（QueryResultRow 互換） */
export interface SiteRow {
  id: string;
  slug: string;
  site_name: string;
  email: string;
  revision_token: string;
  revision_count: number;
  stripe_session_id: string;
  color_theme: "minimal" | "business" | "casual";
  created_at: Date;
  updated_at: Date;
  // QueryResultRow の index signature に対応
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// TODO: 本格実装時に追加するクエリ関数
// ---------------------------------------------------------------------------
// export async function getSiteBySlug(slug: string): Promise<SiteRow | null> { ... }
// export async function getSiteByRevisionToken(token: string): Promise<SiteRow | null> { ... }
// export async function createSite(data: Omit<SiteRow, 'id' | 'created_at' | 'updated_at'>): Promise<SiteRow> { ... }
// export async function incrementRevisionCount(slug: string): Promise<void> { ... }
