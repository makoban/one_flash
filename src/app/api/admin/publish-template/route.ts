/**
 * API Route: POST /api/admin/publish-template
 *
 * テンプレートベースでLP生成→即時公開する。
 * Gemini不要。テンプレートエンジンで変数置換のみ。
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureTablesExist,
  findOrCreateUser,
  createCoconalaSubscription,
  createSite,
  getSiteBySubdomain,
} from "@/lib/db";
import { renderTemplate, generateMapEmbedUrl } from "@/lib/template-engine";
import type { TemplateInput } from "@/lib/template-engine";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { pw, data, coconalaOrderId } = body;

  // 認証
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || pw !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // バリデーション
  if (!data?.siteName || !data?.catchphrase || !data?.theme) {
    return NextResponse.json(
      { error: "Missing required: siteName, catchphrase, theme" },
      { status: 400 }
    );
  }

  // サブドメイン生成（屋号からローマ字変換 or ランダム）
  const subdomain = data.subdomain ||
    data.siteName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") ||
    `site-${Date.now()}`;

  // サブドメイン形式チェック（最低3文字）
  if (subdomain.length < 3 || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain)) {
    const fallback = `site-${Date.now().toString(36)}`;
    // fallbackを使う
    return await processPublish(body, fallback, data, coconalaOrderId, pw);
  }

  // 重複チェック
  try {
    await ensureTablesExist();
    const existing = await getSiteBySubdomain(subdomain);
    if (existing) {
      return NextResponse.json(
        { error: `Subdomain "${subdomain}" is already taken` },
        { status: 409 }
      );
    }
  } catch {}

  return await processPublish(body, subdomain, data, coconalaOrderId, pw);
}

async function processPublish(
  body: Record<string, unknown>,
  subdomain: string,
  data: Record<string, unknown>,
  coconalaOrderId: string | undefined,
  pw: string
): Promise<NextResponse> {
  try {
    await ensureTablesExist();

    // マップURL生成
    const mapEmbedUrl = data.mapEnabled && data.address
      ? generateMapEmbedUrl(data.address as string)
      : "";

    // テンプレート入力組み立て
    const templateInput: TemplateInput = {
      theme: data.theme as string,
      siteName: data.siteName as string,
      catchphrase: data.catchphrase as string,
      descriptionShort: (data.descriptionShort as string) || "",
      heroImageOption: (data.heroImageOption as "default" | "custom" | "none") || "default",
      heroImageCustomUrl: data.heroImageCustomUrl as string | undefined,
      phone: data.phone as string | undefined,
      email: data.email as string | undefined,
      address: data.address as string | undefined,
      hours: data.hours as string | undefined,
      holiday: data.holiday as string | undefined,
      services: (data.services as Array<{ title: string; desc: string }>) || [],
      features: (data.features as Array<{ title: string; desc: string }>) || [],
      formEnabled: data.formEnabled !== false,
      formActionUrl: data.formActionUrl as string | undefined,
      mapEnabled: !!data.mapEnabled,
      mapEmbedUrl: mapEmbedUrl,
      instagramUrl: data.instagramUrl as string | undefined,
      youtubeUrl: data.youtubeUrl as string | undefined,
      xUrl: data.xUrl as string | undefined,
      lineUrl: data.lineUrl as string | undefined,
      facebookUrl: data.facebookUrl as string | undefined,
    };

    // HTML生成（テンプレートエンジン）
    const html = renderTemplate(templateInput);

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
        formData: { siteName: data.siteName },
        email: "",
      }),
    });

    if (!publishResponse.ok) {
      const errorData = (await publishResponse.json().catch(() => ({}))) as { error?: string };
      throw new Error(`R2 publish failed: ${errorData.error ?? publishResponse.statusText}`);
    }

    // DB登録
    const userEmail = (data.customerEmail as string) || `${subdomain}@coconala.local`;
    const user = await findOrCreateUser(userEmail);
    const subscription = await createCoconalaSubscription({
      userId: user.id,
      coconalaOrderId: coconalaOrderId || undefined,
    });
    const siteRecord = await createSite({
      userId: user.id,
      subscriptionId: subscription.id,
      subdomain,
      siteName: data.siteName as string,
      inputSnapshot: data as Record<string, unknown>,
    });

    const publicUrl = `${workerUrl}/s/${subdomain}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://oneflash.bantex.jp";
    const revisionUrl = `${appUrl}/revise?token=${siteRecord.revision_token}`;

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
    console.error("[admin/publish-template] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
