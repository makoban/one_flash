/**
 * API Route: POST /api/admin/update-site-status
 *
 * サイトの公開/非公開を切り替える。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureTablesExist,
  getSiteBySubdomain,
  updateSiteIsActive,
} from "@/lib/db";
import { deactivateSite, reactivateSite } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { pw, subdomain, action } = body;

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || pw !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!subdomain || !action || !["deactivate", "reactivate"].includes(action)) {
    return NextResponse.json(
      { error: "Missing or invalid subdomain/action" },
      { status: 400 }
    );
  }

  try {
    await ensureTablesExist();

    const site = await getSiteBySubdomain(subdomain);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    if (action === "deactivate") {
      await deactivateSite(subdomain, site.site_name ?? "");
      await updateSiteIsActive(subdomain, false);
      return NextResponse.json({ success: true, action: "deactivated", subdomain });
    } else {
      const restored = await reactivateSite(subdomain);
      if (!restored) {
        return NextResponse.json(
          { error: "Backup HTML not found for reactivation" },
          { status: 404 }
        );
      }
      await updateSiteIsActive(subdomain, true);
      return NextResponse.json({ success: true, action: "reactivated", subdomain });
    }
  } catch (error) {
    console.error("[admin/update-site-status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
