/**
 * API Route: POST /api/publish
 *
 * HTMLをCloudflare Worker経由でR2にアップロードし、
 * メタデータ（formData, email, パスワード）も保存する。
 *
 * Request:  { html, subdomain, formData, email, password? }
 * Response: { url, subdomain, password? }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      html?: string;
      subdomain?: string;
      formData?: Record<string, unknown>;
      email?: string;
      password?: string;
    };
    const { html, subdomain, formData, email, password } = body;

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
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
