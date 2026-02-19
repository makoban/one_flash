/**
 * API Route: POST /api/track
 *
 * コンバージョンイベントを opf_ad_events テーブルに記録する。
 *
 * イベント種別:
 *   - page_view      : LP到達
 *   - form_start     : 入力フォーム最初の入力
 *   - checkout_start  : Stripe Checkoutへ遷移直前
 *   - subscribed      : 決済完了（Webhook側で記録）
 */

import { NextRequest, NextResponse } from "next/server";
import { insertAdEvent } from "@/lib/db";

const ALLOWED_EVENTS = ["page_view", "form_start", "checkout_start"];

interface TrackRequestBody {
  eventType: string;
  sessionId?: string;
  pageUrl?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as TrackRequestBody;
    const { eventType } = body;

    if (!eventType || !ALLOWED_EVENTS.includes(eventType)) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    const userAgent = request.headers.get("user-agent") ?? undefined;

    await insertAdEvent({
      eventType: body.eventType,
      sessionId: body.sessionId,
      pageUrl: body.pageUrl,
      referrer: body.referrer,
      userAgent,
      utmSource: body.utm_source,
      utmMedium: body.utm_medium,
      utmCampaign: body.utm_campaign,
      utmContent: body.utm_content,
      utmTerm: body.utm_term,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("[track] Error:", error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
