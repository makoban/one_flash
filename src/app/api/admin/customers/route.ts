/**
 * API Route: GET /api/admin/customers
 *
 * Stripe + ココナラ顧客の統合一覧を返す。
 */

import { NextRequest, NextResponse } from "next/server";
import { ensureTablesExist, getCustomerList } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const pw = request.nextUrl.searchParams.get("pw") ?? "";
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || pw !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filter = (request.nextUrl.searchParams.get("filter") ?? "all") as "all" | "active" | "inactive" | "expiring";
  const search = request.nextUrl.searchParams.get("search") ?? undefined;

  try {
    await ensureTablesExist();
    const data = await getCustomerList({ filter, search });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin/customers] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
