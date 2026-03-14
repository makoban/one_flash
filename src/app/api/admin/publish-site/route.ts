/**
 * API Route: POST /api/admin/publish-site
 *
 * adminモードでサイトを直接公開する（Stripe決済スキップ）。
 * ココナラ経由の顧客対応用。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureTablesExist,
  findOrCreateUser,
  createCoconalaSubscription,
  createSite,
  getSiteBySubdomain,
} from "@/lib/db";
import { uploadSiteHTML } from "@/lib/r2";
import { sendSiteCompletionEmail } from "@/lib/email";
import { notifyCustomerError } from "@/lib/slack";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { pw, formData, html, coconalaOrderId, sendEmail = true } = body;

  // 認証
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || pw !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // バリデーション
  if (!formData?.siteName || !formData?.email || !formData?.subdomain || !html) {
    return NextResponse.json(
      { error: "Missing required fields: siteName, email, subdomain, html" },
      { status: 400 }
    );
  }

  const { siteName, catchphrase, description, contactInfo, colorTheme, email, subdomain } = formData;

  // サブドメイン形式チェック
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(subdomain)) {
    return NextResponse.json(
      { error: "Invalid subdomain format" },
      { status: 400 }
    );
  }

  try {
    await ensureTablesExist();

    // サブドメイン重複チェック
    const existing = await getSiteBySubdomain(subdomain);
    if (existing) {
      return NextResponse.json(
        { error: `Subdomain "${subdomain}" is already taken` },
        { status: 409 }
      );
    }

    // R2にアップロード
    const workerUrl = process.env.WORKER_URL;
    const uploadSecret = process.env.UPLOAD_SECRET;
    if (!workerUrl || !uploadSecret) {
      return NextResponse.json(
        { error: "WORKER_URL or UPLOAD_SECRET not configured" },
        { status: 500 }
      );
    }

    const publishResponse = await fetch(`${workerUrl}/_api/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subdomain,
        html,
        secret: uploadSecret,
        formData: { siteName, catchphrase, description, contactInfo, colorTheme },
        email,
      }),
    });

    if (!publishResponse.ok) {
      const errorData = (await publishResponse.json().catch(() => ({}))) as { error?: string };
      throw new Error(`R2 publish failed: ${errorData.error ?? publishResponse.statusText}`);
    }

    // DB登録
    const user = await findOrCreateUser(email);
    const subscription = await createCoconalaSubscription({
      userId: user.id,
      coconalaOrderId: coconalaOrderId || undefined,
    });
    const siteRecord = await createSite({
      userId: user.id,
      subscriptionId: subscription.id,
      subdomain,
      siteName,
      inputSnapshot: { siteName, catchphrase, description, contactInfo, colorTheme, email },
    });

    const publicUrl = `${workerUrl}/s/${subdomain}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oneflash.bantex.jp";
    const revisionUrl = `${appUrl}/revise?token=${siteRecord.revision_token}`;

    // メール送信
    if (sendEmail && email) {
      try {
        await sendSiteCompletionEmail({
          to: email,
          siteName,
          publicUrl,
          revisionUrl,
          // billingPortalUrl は含めない（ココナラ顧客のため）
        });
      } catch (err) {
        console.error("[admin/publish-site] Email send failed:", err);
        await notifyCustomerError("admin/publish-site", "完了メール送信失敗", {
          subdomain, email,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      site: {
        subdomain,
        publicUrl,
        revisionUrl,
        revisionToken: siteRecord.revision_token,
      },
      subscription: {
        id: subscription.id,
        paymentSource: "coconala",
        expiresAt: subscription.expires_at?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[admin/publish-site] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
