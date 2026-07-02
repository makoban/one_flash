/**
 * API Route: POST /api/migrate
 *
 * opf_* テーブルをPostgreSQLに作成するマイグレーションエンドポイント。
 * 初回デプロイ時に1回実行する。CREATE TABLE IF NOT EXISTS のため冪等。
 *
 * 認証: ADMIN_PASSWORD が必須。
 *   ?pw=<ADMIN_PASSWORD> または Authorization: Bearer <ADMIN_PASSWORD>
 */

import { NextRequest, NextResponse } from "next/server";
import { ensureTablesExist } from "@/lib/db";

function isAuthorized(request: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === adminPassword) {
    return true;
  }
  const pw = request.nextUrl.searchParams.get("pw");
  return pw === adminPassword;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureTablesExist();
    return NextResponse.json({ message: "Migration completed successfully" }, { status: 200 });
  } catch (error: unknown) {
    console.error("[migrate] Error:", error);
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
