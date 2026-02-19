/**
 * /edit ページ
 *
 * サイトID + パスワードで認証 → 既存サイトの編集 → 再公開
 *
 * 状態遷移:
 *   login → generating → preview → complete
 */

"use client";

import { useState } from "react";
import PreviewSection from "@/app/create/PreviewSection";
import type { SiteFormData } from "@/lib/gemini";

type PageState = "login" | "generating" | "preview" | "complete";

interface PreviewData {
  pcImage: string;
  mobileImage: string;
  html: string;
}

const MAX_REGENERATIONS = 10;

export default function EditPage() {
  const [pageState, setPageState] = useState<PageState>("login");
  const [subdomain, setSubdomain] = useState("");
  const [password, setPassword] = useState("");
  const [formData, setFormData] = useState<SiteFormData | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [regenerationsLeft, setRegenerationsLeft] = useState(MAX_REGENERATIONS);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  // --- URLからサブドメインを抽出 ---
  function extractSubdomain(input: string): string {
    let s = input.trim().toLowerCase();
    // フルURLの場合: https://site-xxx.oneflash.net → site-xxx
    // workers.dev URLの場合: .../s/site-xxx → site-xxx
    const subdomainMatch = s.match(/\/s\/([a-z0-9][a-z0-9-]+[a-z0-9])/);
    if (subdomainMatch) return subdomainMatch[1];
    const domainMatch = s.match(/([a-z0-9][a-z0-9-]+[a-z0-9])\.oneflash\.net/);
    if (domainMatch) return domainMatch[1];
    // そのまま返す（サブドメイン直接入力）
    return s;
  }

  // --- ログイン（認証） ---
  async function handleLogin(): Promise<void> {
    const slug = extractSubdomain(subdomain);
    if (!slug || !password) {
      setError("サイトIDとパスワードを入力してください");
      return;
    }
    setError(null);
    setIsVerifying(true);

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain: slug, password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "認証に失敗しました");
      }

      const data = (await response.json()) as {
        subdomain: string;
        email: string;
        formData: SiteFormData;
        html: string;
      };

      setFormData({ ...data.formData, subdomain: data.subdomain });
      setSubdomain(data.subdomain);

      // 既存HTMLからスクリーンショットを取得
      setPageState("generating");
      const screenshotResponse = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: data.html }),
      });

      if (!screenshotResponse.ok) {
        throw new Error("スクリーンショットの取得に失敗しました");
      }

      const { pcImage, mobileImage } = (await screenshotResponse.json()) as {
        pcImage: string;
        mobileImage: string;
      };

      setPreviewData({ pcImage, mobileImage, html: data.html });
      setPageState("preview");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "エラーが発生しました";
      setError(message);
      setPageState("login");
    } finally {
      setIsVerifying(false);
    }
  }

  // --- 再生成 ---
  async function handleRegenerate(updatedData: SiteFormData, instruction: string): Promise<void> {
    if (regenerationsLeft <= 0) return;
    setError(null);
    setIsRegenerating(true);
    setFormData(updatedData);

    try {
      // HTML生成
      const genResponse = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: updatedData, instruction }),
      });
      if (!genResponse.ok) {
        const data = (await genResponse.json()) as { error?: string };
        throw new Error(data.error ?? "生成に失敗しました");
      }
      const { html } = (await genResponse.json()) as { html: string };

      // スクリーンショット
      const ssResponse = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      if (!ssResponse.ok) throw new Error("スクリーンショットの取得に失敗しました");
      const { pcImage, mobileImage } = (await ssResponse.json()) as {
        pcImage: string;
        mobileImage: string;
      };

      setPreviewData({ pcImage, mobileImage, html });
      setRegenerationsLeft((prev) => prev - 1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "再生成に失敗しました";
      setError(message);
    } finally {
      setIsRegenerating(false);
    }
  }

  // --- 再公開 ---
  async function handlePublish(): Promise<void> {
    if (!previewData || !formData) return;
    setError(null);
    setIsPublishing(true);

    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: previewData.html,
          subdomain: formData.subdomain,
          formData,
          email: formData.email,
          password,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "公開に失敗しました");
      }

      const result = (await response.json()) as { url: string };
      setPublishedUrl(result.url);
      setPageState("complete");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "公開に失敗しました";
      setError(message);
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-10 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">OnePage-Flash</h1>
        <p className="mt-2 text-sm text-gray-500">サイトの修正</p>
      </div>

      {error && (
        <div className="max-w-md mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {pageState === "login" && (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">サイトにログイン</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  サイトID または URL
                </label>
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="site-abc123 または公開URL"
                  className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  パスワード
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="公開時に発行されたパスワード"
                  className="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 font-mono tracking-widest"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>

              <button
                type="button"
                onClick={handleLogin}
                disabled={isVerifying}
                className="w-full py-3 px-6 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isVerifying ? "認証中..." : "ログインして修正する"}
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 text-center">
              <a href="/create" className="text-sm text-indigo-600 hover:underline">
                新しくサイトを作成する
              </a>
            </div>
          </div>
        </div>
      )}

      {pageState === "generating" && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-gray-500">サイトデータを読み込み中...</p>
        </div>
      )}

      {pageState === "preview" && previewData && formData && (
        <PreviewSection
          pcImage={previewData.pcImage}
          mobileImage={previewData.mobileImage}
          formData={formData}
          regenerationsLeft={regenerationsLeft}
          onRegenerate={handleRegenerate}
          onPublish={handlePublish}
          isRegenerating={isRegenerating}
          isPublishing={isPublishing}
        />
      )}

      {pageState === "complete" && (
        <div className="max-w-md mx-auto text-center py-16">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">更新しました！</h2>
          {publishedUrl && (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 font-mono text-sm break-all hover:underline"
            >
              {publishedUrl}
            </a>
          )}
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => setPageState("preview")}
              className="w-full py-3 px-6 border-2 border-indigo-200 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors"
            >
              さらに修正する
            </button>
            <a
              href="/"
              className="block w-full py-3 px-6 text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              トップに戻る
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
