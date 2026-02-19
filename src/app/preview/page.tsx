/**
 * /preview ページ
 *
 * 開発・テスト用: フォーム入力後にHTMLをプレビューする画面。
 * 本番では Stripe Webhook 経由でのみサイトが生成される。
 *
 * 使い方:
 *   1. /create でフォームを入力
 *   2. (開発時) /preview でリアルタイムプレビュー確認
 */

"use client";

import { useState } from "react";
import PreviewFrame from "@/components/PreviewFrame";
import type { SiteFormData } from "@/lib/gemini";

const SAMPLE_FORM_DATA: SiteFormData = {
  siteName: "山田太郎 整体院",
  catchphrase: "10年以上の実績。あなたのつらい痛みを根本から改善します",
  description:
    "当院は2010年開業。腰痛・肩こりを専門とした整体院です。施術は完全予約制で、1回60分のていねいなカウンセリングと施術を行います。お客様一人ひとりの体の状態に合わせたオーダーメイドの施術が特長です。",
  contactInfo:
    "メール: info@yamada-seitai.jp\n電話: 03-1234-5678（10〜18時・水曜定休）\n住所: 東京都渋谷区〇〇1-2-3",
  colorTheme: "simple",
  // 開発用プレビューページのため、email / subdomain はダミー値を設定
  email: "dev-preview@example.com",
  subdomain: "dev-preview",
};

export default function PreviewPage() {
  const [formData, setFormData] = useState<SiteFormData>(SAMPLE_FORM_DATA);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(): Promise<void> {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData }),
      });

      const data = (await response.json()) as { html?: string; error?: string };

      if (!response.ok || !data.html) {
        throw new Error(data.error ?? "HTML生成に失敗しました");
      }

      setGeneratedHtml(data.html);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "エラーが発生しました";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          開発用プレビュー
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側: フォーム */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              フォームデータ
            </h2>

            <div className="space-y-4">
              {(
                [
                  {
                    key: "siteName" as const,
                    label: "サイト名",
                    type: "input" as const,
                  },
                  {
                    key: "catchphrase" as const,
                    label: "キャッチコピー",
                    type: "input" as const,
                  },
                  {
                    key: "description" as const,
                    label: "説明",
                    type: "textarea" as const,
                  },
                  {
                    key: "contactInfo" as const,
                    label: "連絡先",
                    type: "textarea" as const,
                  },
                ] as Array<{
                  key: keyof SiteFormData;
                  label: string;
                  type: "input" | "textarea";
                }>
              ).map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {label}
                  </label>
                  {type === "textarea" ? (
                    <textarea
                      value={formData[key] as string}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[key] as string}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))}

              {/* カラーテーマ */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  カラーテーマ
                </label>
                <select
                  value={formData.colorTheme}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      colorTheme: e.target.value as SiteFormData["colorTheme"],
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="simple">シンプル</option>
                  <option value="business">ビジネス</option>
                  <option value="colorful">カラフル</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? "AIが生成中..." : "HTMLを生成してプレビュー"}
            </button>
          </div>

          {/* 右側: プレビュー */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              プレビュー
            </h2>
            {generatedHtml ? (
              <PreviewFrame html={generatedHtml} />
            ) : (
              <div className="h-96 bg-gray-100 rounded-xl flex items-center justify-center">
                <p className="text-sm text-gray-400">
                  「HTMLを生成してプレビュー」ボタンを押してください
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
