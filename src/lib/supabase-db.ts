/**
 * Supabase クライアント モジュール
 *
 * ai-fudosan / ai-shoken が使用する Supabase への接続。
 * @supabase/supabase-js を使用（HTTPS経由・IPv4/IPv6問題なし）。
 *
 * 環境変数:
 *   SUPABASE_URL       - Supabase Project URL
 *   SUPABASE_SECRET_KEY - Service Role Key（RLSバイパス）
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase クライアント（遅延初期化）
// ---------------------------------------------------------------------------

const globalForSupa = globalThis as unknown as { supabaseClient?: SupabaseClient };

function getSupabaseClient(): SupabaseClient {
  if (globalForSupa.supabaseClient) return globalForSupa.supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL and/or SUPABASE_SECRET_KEY");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  globalForSupa.supabaseClient = client;
  return client;
}

// ---------------------------------------------------------------------------
// purchasesテーブル取得ヘルパー
// ---------------------------------------------------------------------------

export interface PurchaseRow {
  id: string;
  user_id: string;
  area_code: string | null;
  area_name: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  amount: number;
  service_name: string;
  purchased_at: string;
}

/**
 * 指定サービスの全購入データを取得（最大1000件）
 */
export async function fetchPurchases(
  serviceName: string
): Promise<PurchaseRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("purchases")
    .select(
      "id, user_id, area_code, area_name, stripe_session_id, stripe_payment_intent_id, amount, service_name, purchased_at"
    )
    .eq("service_name", serviceName)
    .order("purchased_at", { ascending: false })
    .limit(1000);

  if (error) throw new Error(`Supabase query error: ${error.message}`);
  return (data ?? []) as PurchaseRow[];
}

/**
 * auth.users テーブルからメールアドレスをまとめて取得
 */
export async function fetchUserEmails(
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const client = getSupabaseClient();
  const emailMap = new Map<string, string>();

  // Supabase Admin API を使ってユーザー一覧を取得
  const {
    data: { users },
    error,
  } = await client.auth.admin.listUsers({ perPage: 1000 });

  if (error || !users) return emailMap;

  for (const u of users) {
    if (userIds.includes(u.id) && u.email) {
      emailMap.set(u.id, u.email);
    }
  }
  return emailMap;
}
