/**
 * API Route: POST /api/migrate
 *
 * opf_* テーブルをPostgreSQLに作成するマイグレーションエンドポイント。
 * 初回デプロイ時に1回実行する。CREATE TABLE IF NOT EXISTS のため冪等。
 */

import { NextResponse } from "next/server";
import { ensureTablesExist } from "@/lib/db";

export async function POST(): Promise<NextResponse> {
  try {
    await ensureTablesExist();
    return NextResponse.json({ message: "Migration completed successfully" }, { status: 200 });
  } catch (error: unknown) {
    console.error("[migrate] Error:", error);
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
