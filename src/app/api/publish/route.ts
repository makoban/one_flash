/**
 * API Route: POST /api/publish
 *
 * HTMLをCloudflare Worker経由でR2にアップロードし、
 * メタデータ（formData, email, パスワード）も保存する。
 *
 * 認証（既存顧客サイトの乗っ取り防止）:
 *   - 既存サイトの上書き（再公開）: そのサイトのパスワード（password）が必須。
 *     Worker /_api/verify で照合し、一致しなければ拒否する。
 *   - 新規サイトの公開: 管理者パスワード（pw === ADMIN_PASSWORD）が必須。
 *     （通常の顧客作成フローは Stripe Webhook / admin API 経由で公開されるため、
 *      この公開エンドポイントを匿名で新規作成に使うことはできない）
 *
 * Request:  { html, subdomain, formData, email, password?, pw? }
 * Response: { url, subdomain, password? }
 */

import { NextRequest, NextResponse } from "next/server";
import { notifyCustomerError } from "@/lib/slack";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { html?: string; subdomain?: string; formData?: Record<string, unknown>; email?: string; password?: string; pw?: string } | undefined;
  try {
    body = (await request.json()) as {
      html?: string;
      subdomain?: string;
      formData?: Record<string, unknown>;
      email?: string;
      password?: string;
      pw?: string;
    };
    const { html, subdomain, formData, email, password, pw } = body;

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "html is required" }, { status: 400 });
    }
    if (!subdomain || typeof subdomain !== "string") {
      return NextResponse.json({ error: "subdomain is required" }, { status: 400 });
    }
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(subdomain)) {
      return NextResponse.json({ error: "Invalid subdomain format" }, { status: 400 });
    }

    const workerUrl = process.env.WORKER_URL;
    const uploadSecret = process.env.UPLOAD_SECRET;

    if (!workerUrl || !uploadSecret) {
      return NextResponse.json(
        { error: "WORKER_URL and UPLOAD_SECRET must be configured" },
        { status: 500 }
      );
    }

    // --- 認証チェック ---
    const adminPassword = process.env.ADMIN_PASSWORD;
    const isAdmin = Boolean(adminPassword && pw && pw === adminPassword);

    if (!isAdmin) {
      // 既存サイトの再公開: サイトパスワードの照合を必須にする。
      if (!password || typeof password !== "string") {
        return NextResponse.json(
          { error: "サイトのパスワードが必要です" },
          { status: 401 }
        );
      }

      const verifyRes = await fetch(`${workerUrl}/_api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain, password, secret: uploadSecret }),
      });

      if (verifyRes.status === 404) {
        // サイトが存在しない = 新規公開。匿名での新規公開は許可しない。
        return NextResponse.json(
          { error: "対象のサイトが見つかりません" },
          { status: 404 }
        );
      }
      if (verifyRes.status === 403) {
        return NextResponse.json(
          { error: "パスワードが正しくありません" },
          { status: 403 }
        );
      }
      if (!verifyRes.ok) {
        return NextResponse.json(
          { error: "認証に失敗しました" },
          { status: 500 }
        );
      }
    }

    console.log(`[publish] Uploading site: ${subdomain}`);
    const workerResponse = await fetch(`${workerUrl}/_api/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subdomain,
        html,
        secret: uploadSecret,
        formData,
        email,
        password,
      }),
    });

    if (!workerResponse.ok) {
      const errorData = (await workerResponse.json()) as { error?: string };
      throw new Error(errorData.error ?? "Worker upload failed");
    }

    const result = (await workerResponse.json()) as {
      url: string;
      subdomain: string;
      password?: string;
    };

    // デモ用パスベースURL
    const demoUrl = `${workerUrl}/s/${subdomain}`;

    console.log(`[publish] Upload complete: ${demoUrl}`);

    return NextResponse.json(
      { url: demoUrl, productionUrl: result.url, subdomain, password: result.password },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[publish] Error:", error);
    await notifyCustomerError("publish", "サイト公開失敗", {
      subdomain: body?.subdomain,
      error: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
