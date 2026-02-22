/**
 * Supabase PostgreSQL 接続モジュール
 *
 * ai-fudosan / ai-shoken が使用する Supabase PostgreSQL への接続。
 * db.ts と同じ Proxy 遅延初期化パターンを採用。
 * 環境変数 SUPABASE_DATABASE_URL が未設定でもビルドを通す。
 *
 * 接続形式: 個別パラメータ方式（connection string ではなく host/port/user/password を個別指定）
 * 理由: Supabase直接接続のパスワードに $, & 等の特殊文字が含まれ、
 *       connection string のURLエンコード/デコードで問題が起きるため。
 */

import { Pool, QueryResult, QueryResultRow } from "pg";
import dns from "dns";

// Supabase は IPv6 のみの場合があり、Render (Oregon) からの接続で
// ENETUNREACH が発生する。IPv4 を優先して解決する。
dns.setDefaultResultOrder("ipv4first");

// ---------------------------------------------------------------------------
// コネクションプール（遅延初期化）
// ---------------------------------------------------------------------------

const globalForSupaPg = globalThis as unknown as { supabasePgPool?: Pool };

function getSupabasePool(): Pool {
  if (globalForSupaPg.supabasePgPool) return globalForSupaPg.supabasePgPool;

  const host = process.env.SUPABASE_DB_HOST;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!host || !password) {
    throw new Error(
      "Missing environment variable: SUPABASE_DB_HOST and/or SUPABASE_DB_PASSWORD"
    );
  }

  const pool = new Pool({
    host,
    port: parseInt(process.env.SUPABASE_DB_PORT || "5432", 10),
    database: process.env.SUPABASE_DB_NAME || "postgres",
    user: process.env.SUPABASE_DB_USER || "postgres",
    password,
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
