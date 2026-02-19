/**
 * Cloudflare Worker: サイトルーター + アップロード/認証API
 *
 * ルーティング:
 *   GET  /s/{slug}         → R2からHTML配信（デモ用パスベース）
 *   GET  {slug}.domain     → R2からHTML配信（本番用サブドメイン）
 *   POST /_api/publish     → HTML + メタデータをR2に保存
 *   POST /_api/verify      → パスワード認証 → サイトデータ返却
 *
 * R2バインディング: SITES_BUCKET
 * 環境変数: SITE_DOMAIN, UPLOAD_SECRET
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const siteDomain = env.SITE_DOMAIN || "oneflash.net";

    // --- CORS preflight ---
    if (request.method === "OPTIONS") {
      return handleCors();
    }

    // --- API endpoints ---
    if (url.pathname === "/_api/publish" && request.method === "POST") {
      return handlePublish(request, env);
    }
    if (url.pathname === "/_api/verify" && request.method === "POST") {
      return handleVerify(request, env);
    }

    // --- パスベースルーティング（デモ用: /s/{slug}） ---
    const pathMatch = url.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]+[a-z0-9])\/?$/);
    if (pathMatch) {
      return serveSite(pathMatch[1], env, siteDomain);
    }

    // --- サブドメインルーティング（本番用） ---
    if (hostname.endsWith(`.${siteDomain}`)) {
      const subdomain = hostname.replace(`.${siteDomain}`, "");
      if (subdomain && subdomain !== "www") {
        return serveSite(subdomain, env, siteDomain);
      }
    }

    return new Response("OnePage-Flash", { status: 200 });
  },
};

// ---------------------------------------------------------------------------
// SHA-256 ハッシュ（Web Crypto API）
// ---------------------------------------------------------------------------
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// サイト配信
// ---------------------------------------------------------------------------
async function serveSite(slug, env, siteDomain) {
  try {
    const object = await env.SITES_BUCKET.get(`${slug}/index.html`);
    if (!object) {
      return new Response(notFoundPage(slug, siteDomain), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response(await object.text(), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Serve error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// 公開API: POST /_api/publish
// Body: { subdomain, html, secret, formData, email, password? }
// password未指定なら新規生成、指定ならそのパスワードを使用（再公開時）
// ---------------------------------------------------------------------------
async function handlePublish(request, env) {
  try {
    const body = await request.json();
    const { subdomain, html, secret, formData, email, password: existingPassword } = body;

    if (!env.UPLOAD_SECRET || secret !== env.UPLOAD_SECRET) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    if (!subdomain || !html) {
      return jsonResponse({ error: "subdomain and html are required" }, 400);
    }

    // パスワード: 既存があればそのまま、なければ新規生成
    let password = existingPassword;
    let isNewSite = false;
    if (!password) {
      password = generatePassword();
      isNewSite = true;
    }
    const passwordHash = await sha256(password);

    // HTMLを保存
    await env.SITES_BUCKET.put(`${subdomain}/index.html`, html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });

    // メタデータを保存
    const now = new Date().toISOString();
    let meta = {};
    try {
      const existing = await env.SITES_BUCKET.get(`${subdomain}/meta.json`);
      if (existing) meta = await existing.json();
    } catch {}

    const updatedMeta = {
      ...meta,
      subdomain,
      email: email || meta.email || "",
      passwordHash,
      formData: formData || meta.formData || null,
      isPublished: true,
      createdAt: meta.createdAt || now,
      updatedAt: now,
    };

    await env.SITES_BUCKET.put(`${subdomain}/meta.json`, JSON.stringify(updatedMeta), {
      httpMetadata: { contentType: "application/json" },
    });

    const siteDomain = env.SITE_DOMAIN || "oneflash.net";
    const url = `https://${subdomain}.${siteDomain}`;

    return jsonResponse({
      url,
      subdomain,
      password: isNewSite ? password : undefined,
    }, 200);
  } catch (error) {
    console.error("Publish error:", error);
    return jsonResponse({ error: "Publish failed" }, 500);
  }
}

// ---------------------------------------------------------------------------
// 認証API: POST /_api/verify
// Body: { subdomain, password, secret }
// → 認証成功: { formData, html, subdomain, email }
// ---------------------------------------------------------------------------
async function handleVerify(request, env) {
  try {
    const body = await request.json();
    const { subdomain, password, secret } = body;

    if (!env.UPLOAD_SECRET || secret !== env.UPLOAD_SECRET) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    if (!subdomain || !password) {
      return jsonResponse({ error: "subdomain and password are required" }, 400);
    }

    // メタデータを取得
    const metaObj = await env.SITES_BUCKET.get(`${subdomain}/meta.json`);
    if (!metaObj) {
      return jsonResponse({ error: "サイトが見つかりません" }, 404);
    }

    const meta = await metaObj.json();
    const inputHash = await sha256(password);

    if (inputHash !== meta.passwordHash) {
      return jsonResponse({ error: "パスワードが正しくありません" }, 403);
    }

    // HTMLを取得
    const htmlObj = await env.SITES_BUCKET.get(`${subdomain}/index.html`);
    const html = htmlObj ? await htmlObj.text() : "";

    return jsonResponse({
      subdomain: meta.subdomain,
      email: meta.email,
      formData: meta.formData,
      html,
    }, 200);
  } catch (error) {
    console.error("Verify error:", error);
    return jsonResponse({ error: "Verification failed" }, 500);
  }
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function handleCors() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function notFoundPage(subdomain, siteDomain) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>ページが見つかりません</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#374151}.c{text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#6b7280;font-size:.875rem}a{color:#4f46e5;text-decoration:none}</style></head><body><div class="c"><h1>ページが見つかりません</h1><p>${subdomain}.${siteDomain} は現在公開されていません。</p><p style="margin-top:1rem"><a href="https://${siteDomain}">OnePage-Flash でホームページを作る</a></p></div></body></html>`;
}
