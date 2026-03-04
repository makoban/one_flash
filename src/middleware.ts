/**
 * Next.js Middleware: APIレート制限
 *
 * in-memory Map ベース（Render 単一インスタンス対応）
 * サーバー再起動でリセットされるが、単一インスタンスなら十分。
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// レート制限設定
// ---------------------------------------------------------------------------

interface RateLimitConfig {
  windowMs: number;  // ウィンドウ期間（ミリ秒）
  maxRequests: number; // ウィンドウ内の最大リクエスト数
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/generate": { windowMs: 60_000, maxRequests: 5 },
  "/api/create-checkout-session": { windowMs: 60_000, maxRequests: 3 },
  "/api/revise": { windowMs: 60_000, maxRequests: 5 },
};

// ---------------------------------------------------------------------------
// in-memory ストア
// ---------------------------------------------------------------------------

interface RequestRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RequestRecord>();

// 5分ごとに古いエントリをクリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store) {
    if (record.resetAt < now) {
      store.delete(key);
    }
  }
}, 300_000);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname;
  const config = RATE_LIMITS[pathname];

  if (!config) return undefined;

  // クライアントIP取得（Render/Cloudflare 対応）
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const key = `${ip}:${pathname}`;
  const now = Date.now();

  let record = store.get(key);

  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + config.windowMs };
    store.set(key, record);
  }

  record.count++;

  if (record.count > config.maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return NextResponse.json(
      { error: `リクエスト回数の上限に達しました。${retryAfter}秒後にお試しください。` },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(record.resetAt),
        },
      }
    );
  }

  return undefined;
}

export const config = {
  matcher: ["/api/generate", "/api/create-checkout-session", "/api/revise"],
};
