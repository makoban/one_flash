/**
 * API Route: POST /api/revise
 *
 * 修正指示を受け取ってHTMLを更新する。
 *
 * 処理フロー:
 *   1. revision_token で対象サイトを特定
 *   2. 無料修正回数チェック（0回なら Stripe 決済へリダイレクト）
 *   3. R2 から現在の HTML を取得
 *   4. Gemini でHTML修正
 *   5. R2 の HTML を上書き保存
 *   6. DB の revision_count をインクリメント
 *   7. 修正完了メール送信
 */

import { NextRequest, NextResponse } from "next/server";
import { geminiModel } from "@/lib/gemini";
import { uploadSiteHTML, getSiteHTML, getSitePublicUrl } from "@/lib/r2";
import { query } from "@/lib/db";
import { sendRevisionCompletionEmail } from "@/lib/email";
import { buildRefinerPrompt, parseRefinerResponse, validateRevisionInstruction } from "@/prompts/refiner";
import type { SiteRow } from "@/lib/db";

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** 無料修正可能な最大回数 */
const FREE_REVISION_LIMIT = 2;

// ---------------------------------------------------------------------------
// ハンドラー
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      token: string;
      instruction: string;
    };

    const { token, instruction } = body;

    // --- 入力バリデーション ---
    if (!token || token.trim().length === 0) {
      return NextResponse.json(
        { error: "修正用トークンが必要です" },
        { status: 400 }
      );
    }

    const validation = validateRevisionInstruction(instruction);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // --- DBでサイト情報を取得 ---
    const result = await query<SiteRow>(
      "SELECT * FROM sites WHERE revision_token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "無効な修正用トークンです" },
        { status: 404 }
      );
    }

    const site = result.rows[0];

    // --- 無料修正回数チェック ---
    const remainingFreeRevisions = Math.max(
      0,
      FREE_REVISION_LIMIT - site.revision_count
    );

    if (remainingFreeRevisions === 0) {
      // 有料修正が必要: フロントエンドに決済URLを返す
      // TODO: Stripe 有料修正 Checkout セッション作成
      return NextResponse.json(
        {
          requiresPayment: true,
          message: "無料修正回数を使い切りました。500円の決済が必要です。",
          // TODO: checkoutUrl: await createRevisionCheckoutSession(...)
        },
        { status: 402 }
      );
    }

    // --- R2 から現在の HTML を取得 ---
    const currentHtml = await getSiteHTML(site.slug);

    if (!currentHtml) {
      return NextResponse.json(
        { error: "サイトのHTMLが見つかりません" },
        { status: 404 }
      );
    }

    // --- Gemini でHTML修正（リトライ最大3回） ---
    let refinedHtml = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const refinerPrompt = buildRefinerPrompt(currentHtml, instruction);
        const result = await geminiModel.generateContent(refinerPrompt);
        const rawHtml = result.response.text();

        refinedHtml = parseRefinerResponse(rawHtml);
        break; // 成功
      } catch (error) {
        console.warn(`[revise] Refinement attempt ${attempt} failed:`, error);
        if (attempt === 3) {
          return NextResponse.json(
            { error: "修正処理に失敗しました。もう一度お試しください。" },
            { status: 500 }
          );
        }
      }
    }

    // --- R2 に上書き保存 ---
    await uploadSiteHTML(site.slug, refinedHtml);

    // --- DB の revision_count をインクリメント ---
    const newRevisionCount = site.revision_count + 1;
    await query(
      "UPDATE sites SET revision_count = $1, updated_at = NOW() WHERE slug = $2",
      [newRevisionCount, site.slug]
    );

    // --- 修正完了メール送信 ---
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const publicUrl = getSitePublicUrl(site.slug);
    const revisionUrl = `${appUrl}/revise?token=${site.revision_token}`;
    const newRemainingFreeRevisions = Math.max(
      0,
      FREE_REVISION_LIMIT - newRevisionCount
    );

    if (site.email) {
      await sendRevisionCompletionEmail({
        to: site.email,
        siteName: site.site_name,
        publicUrl,
        revisionUrl,
      });
    }

    return NextResponse.json(
      {
        success: true,
        publicUrl,
        freeRevisionsRemaining: newRemainingFreeRevisions,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[revise] Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
