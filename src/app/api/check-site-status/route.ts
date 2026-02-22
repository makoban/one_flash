/**
 * API Route: GET /api/check-site-status?session_id=cs_xxx
 *
 * Stripe Checkout Session ID からサイトの公開状態を確認する。
 * /complete ページからポーリングで呼び出される。
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const subdomain = session.metadata?.subdomain;
    if (!subdomain) {
      return NextResponse.json({ status: "pending", message: "Waiting for processing..." });
    }

    // Worker URL でサイトにアクセスして公開状態を確認
    const workerUrl = process.env.WORKER_URL;
    if (!workerUrl) {
      return NextResponse.json({
        status: "complete",
        subdomain,
        publicUrl: null,
        message: "WORKER_URL not configured",
      });
    }

    const siteUrl = `${workerUrl}/s/${subdomain}`;
    try {
      const res = await fetch(siteUrl, { method: "HEAD" });
      if (res.ok) {
        // サイトの公開ドメインURL
        const siteDomain = process.env.SITE_DOMAIN ?? "oneflash.net";
        const publicUrl = `https://${subdomain}.${siteDomain}`;

        return NextResponse.json({
          status: "complete",
          subdomain,
          publicUrl,
          workerUrl: siteUrl,
          siteName: session.metadata?.siteName ?? "",
        });
      }
    } catch {
      // Worker unreachable, fall through
    }

    return NextResponse.json({
      status: "pending",
      subdomain,
      message: "Site is being published...",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
