/**
 * API Route: POST /api/verify
 *
 * サブドメイン + パスワードで認証し、サイトデータを返す。
 *
 * Request:  { subdomain: string, password: string }
 * Response: { subdomain, email, formData, html }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      subdomain?: string;
      password?: string;
    };
    const { subdomain, password } = body;

    if (!subdomain || !password) {
      return NextResponse.json(
        { error: "サブドメインとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const workerUrl = process.env.WORKER_URL;
    const uploadSecret = process.env.UPLOAD_SECRET;

    if (!workerUrl || !uploadSecret) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const workerResponse = await fetch(`${workerUrl}/_api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subdomain, password, secret: uploadSecret }),
    });

    const result = await workerResponse.json();

    if (!workerResponse.ok) {
      return NextResponse.json(
        { error: (result as { error?: string }).error ?? "認証に失敗しました" },
        { status: workerResponse.status }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error("[verify] Error:", error);
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
