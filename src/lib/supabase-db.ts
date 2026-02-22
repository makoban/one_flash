/**
 * Supabase PostgreSQL 接続モジュール
 *
 * ai-fudosan / ai-shoken が使用する Supabase PostgreSQL への接続。
 * db.ts と同じ Proxy 遅延初期化パターンを採用。
 * 環境変数 SUPABASE_DATABASE_URL が未設定でもビルドを通す。
 */

import { Pool, QueryResult, QueryResultRow } from "pg";

// ---------------------------------------------------------------------------
// コネクションプール（遅延初期化）
// ---------------------------------------------------------------------------

const globalForSupaPg = globalThis as unknown as { supabasePgPool?: Pool };

function getSupabasePool(): Pool {
  if (globalForSupaPg.supabasePgPool) return globalForSupaPg.supabasePgPool;

  const databaseUrl = process.env.SUPABASE_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing environment variable: SUPABASE_DATABASE_URL");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  globalForSupaPg.supabasePgPool = pool;
  return pool;
}

// ---------------------------------------------------------------------------
// クエリヘルパー
// ---------------------------------------------------------------------------

/**
 * Supabase PostgreSQL にクエリを発行するヘルパー関数
 *
 * @param text - SQLクエリ文字列
 * @param params - プレースホルダーに対応するパラメータ配列
 * @returns QueryResult
 */
export async function supabaseQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getSupabasePool().query<T>(text, params);
}
