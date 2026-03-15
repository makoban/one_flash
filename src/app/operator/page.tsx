/**
 * /operator - オペレーター用LP制作画面
 *
 * ココナラ顧客のヒアリング内容を入力 → テンプレート選択 → 即時公開
 * URL: /operator?pw=ADMIN_PASSWORD
 */

"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const THEMES = [
  { id: "clean-light", name: "クリーンライト", desc: "クリニック・薬局・歯科", color: "bg-sky-100 text-sky-800" },
  { id: "royal-navy", name: "ロイヤルネイビー", desc: "病院・弁護士・税理士", color: "bg-indigo-100 text-indigo-800" },
  { id: "bloom-pink", name: "ブルームピンク", desc: "ネイル・エステ", color: "bg-pink-100 text-pink-800" },
  { id: "soft-blossom", name: "ソフトブロッサム", desc: "美容室・ヨガ", color: "bg-rose-100 text-rose-800" },
  { id: "sunset-cafe", name: "サンセットカフェ", desc: "カフェ・ベーカリー", color: "bg-orange-100 text-orange-800" },
  { id: "dark-dining", name: "ダークダイニング", desc: "レストラン・バー・焼肉", color: "bg-gray-800 text-gray-200" },
  { id: "trust-blue", name: "トラストブルー", desc: "弁護士・司法書士", color: "bg-blue-100 text-blue-800" },
  { id: "modern-minimal", name: "モダンミニマル", desc: "税理士・行政書士", color: "bg-gray-100 text-gray-800" },
  { id: "pop-school", name: "ポップスクール", desc: "英会話・学習塾・ダンス", color: "bg-yellow-100 text-yellow-800" },
  { id: "blueprint", name: "ブループリント", desc: "工務店・リフォーム", color: "bg-slate-100 text-slate-800" },
  { id: "free-wave", name: "フリーウェーブ", desc: "フリーランス・写真家", color: "bg-purple-100 text-purple-800" },
  { id: "executive", name: "エグゼクティブ", desc: "コンサル・経営者", color: "bg-gray-900 text-amber-300" },
];

interface FormData {
  theme: string;
  siteName: string;
  catchphrase: string;
  descriptionShort: string;
  heroImageOption: "default" | "custom" | "none";
  heroImageCustomUrl: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  holiday: string;
  services: Array<{ title: string; desc: string }>;
  features: Array<{ title: string; desc: string }>;
  formEnabled: boolean;
  mapEnabled: boolean;
  instagramUrl: string;
  youtubeUrl: string;
  xUrl: string;
  lineUrl: string;
  facebookUrl: string;
  subdomain: string;
  coconalaOrderId: string;
}

const INITIAL: FormData = {
  theme: "clean-light",
  siteName: "", catchphrase: "", descriptionShort: "",
  heroImageOption: "default", heroImageCustomUrl: "",
  phone: "", email: "", address: "", hours: "", holiday: "",
  services: [{ title: "", desc: "" }, { title: "", desc: "" }, { title: "", desc: "" }],
  features: [{ title: "", desc: "" }, { title: "", desc: "" }, { title: "", desc: "" }],
  formEnabled: true, mapEnabled: true,
  instagramUrl: "", youtubeUrl: "", xUrl: "", lineUrl: "", facebookUrl: "",
  subdomain: "", coconalaOrderId: "",
};

function OperatorContent() {
  const searchParams = useSearchParams();
  const pw = searchParams.get("pw") ?? "";
  const [form, setForm] = useState<FormData>(INITIAL);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{
    publicUrl: string; revisionUrl: string; expiresAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateService(i: number, field: "title" | "desc", value: string) {
    setForm((prev) => {
      const services = [...prev.services];
      services[i] = { ...services[i], [field]: value };
      return { ...prev, services };
    });
  }

  function updateFeature(i: number, field: "title" | "desc", value: string) {
    setForm((prev) => {
      const features = [...prev.features];
      features[i] = { ...features[i], [field]: value };
      return { ...prev, features };
    });
  }

  function addService() {
    if (form.services.length < 4) {
      setForm((prev) => ({ ...prev, services: [...prev.services, { title: "", desc: "" }] }));
    }
  }

  async function handlePublish() {
    if (!form.siteName || !form.catchphrase) {
      setError("屋号とキャッチコピーは必須です");
      return;
    }
    setPublishing(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/publish-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pw,
          data: {
            ...form,
            services: form.services.filter((s) => s.title.trim()),
            features: form.features.filter((f) => f.title.trim()),
          },
          coconalaOrderId: form.coconalaOrderId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "公開に失敗しました");

      setResult({
        publicUrl: data.site.publicUrl,
        revisionUrl: data.site.revisionUrl,
        expiresAt: data.subscription.expiresAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setPublishing(false);
    }
  }

  // --- 公開完了画面 ---
  if (result) {
    return (
      <main className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow border p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">LP公開完了</h2>
            </div>
            <div className="space-y-4">
              <Field label="公開URL" value={result.publicUrl} copy />
              <Field label="修正用URL" value={result.revisionUrl} copy />
              <Field label="有効期限" value={new Date(result.expiresAt).toLocaleDateString("ja-JP")} />
              <button onClick={() => { setResult(null); setForm(INITIAL); }} className="w-full py-3 mt-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">
                次のLP作成
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // --- メインフォーム ---
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-amber-500 text-white text-center py-2 text-sm font-bold rounded-t-2xl">
          オペレーター専用 - LP制作画面
        </div>

        <div className="bg-white rounded-b-2xl shadow border p-6 sm:p-8 space-y-8">

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>}

          {/* テーマ選択 */}
          <Section title="1. テーマ選択">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => update("theme", t.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${form.theme === t.id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-gray-200 hover:border-gray-300"}`}>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${t.color}`}>{t.name}</span>
                  <p className="text-[10px] text-gray-500 mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* 基本情報 */}
          <Section title="2. 基本情報">
            <Input label="屋号・店舗名 *" value={form.siteName} onChange={(v) => update("siteName", v)} placeholder="例: さくら整体院" />
            <Input label="キャッチコピー *" value={form.catchphrase} onChange={(v) => update("catchphrase", v)} placeholder="例: 体の不調、根本から改善します" />
            <Textarea label="サービス説明" value={form.descriptionShort} onChange={(v) => update("descriptionShort", v)} placeholder="200文字以内で事業内容を説明" rows={3} />
          </Section>

          {/* 画像 */}
          <Section title="3. ヒーロー画像">
            <div className="flex gap-3">
              {(["default", "custom", "none"] as const).map((opt) => (
                <button key={opt} onClick={() => update("heroImageOption", opt)}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition ${form.heroImageOption === opt ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"}`}>
                  {{ default: "テーマ付属", custom: "URL指定", none: "画像なし" }[opt]}
                </button>
              ))}
            </div>
            {form.heroImageOption === "custom" && (
              <Input label="画像URL" value={form.heroImageCustomUrl} onChange={(v) => update("heroImageCustomUrl", v)} placeholder="https://..." />
            )}
          </Section>

          {/* 連絡先 */}
          <Section title="4. 連絡先・アクセス">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="電話番号" value={form.phone} onChange={(v) => update("phone", v)} placeholder="052-123-4567" />
              <Input label="メール" value={form.email} onChange={(v) => update("email", v)} placeholder="info@example.com" />
            </div>
            <Textarea label="住所" value={form.address} onChange={(v) => update("address", v)} placeholder="名古屋市天白区原3-1-1" rows={2} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="営業時間" value={form.hours} onChange={(v) => update("hours", v)} placeholder="10:00〜20:00" />
              <Input label="定休日" value={form.holiday} onChange={(v) => update("holiday", v)} placeholder="水曜定休" />
            </div>
          </Section>

          {/* サービス */}
          <Section title="5. サービス内容">
            {form.services.map((s, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <Input label={`サービス${i + 1} タイトル`} value={s.title} onChange={(v) => updateService(i, "title", v)} placeholder="例: 骨盤矯正" />
                <div className="sm:col-span-2">
                  <Input label="説明" value={s.desc} onChange={(v) => updateService(i, "desc", v)} placeholder="例: 歪みを整えて体のバランスを改善" />
                </div>
              </div>
            ))}
            {form.services.length < 4 && (
              <button onClick={addService} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ サービスを追加（最大4個）</button>
            )}
          </Section>

          {/* 特徴 */}
          <Section title="6. 特徴・強み（3つ）">
            {form.features.map((f, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <Input label={`特徴${i + 1} タイトル`} value={f.title} onChange={(v) => updateFeature(i, "title", v)} placeholder="例: 施術歴15年" />
                <div className="sm:col-span-2">
                  <Input label="説明" value={f.desc} onChange={(v) => updateFeature(i, "desc", v)} placeholder="例: 豊富な経験で的確にアプローチ" />
                </div>
              </div>
            ))}
          </Section>

          {/* ON/OFF */}
          <Section title="7. 機能ON/OFF">
            <div className="flex flex-wrap gap-4">
              <Toggle label="お問い合わせフォーム" checked={form.formEnabled} onChange={(v) => update("formEnabled", v)} />
              <Toggle label="Googleマップ" checked={form.mapEnabled} onChange={(v) => update("mapEnabled", v)} />
            </div>
          </Section>

          {/* SNS */}
          <Section title="8. SNSリンク（任意）">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Instagram" value={form.instagramUrl} onChange={(v) => update("instagramUrl", v)} placeholder="https://instagram.com/..." />
              <Input label="YouTube" value={form.youtubeUrl} onChange={(v) => update("youtubeUrl", v)} placeholder="https://youtube.com/..." />
              <Input label="X (Twitter)" value={form.xUrl} onChange={(v) => update("xUrl", v)} placeholder="https://x.com/..." />
              <Input label="LINE" value={form.lineUrl} onChange={(v) => update("lineUrl", v)} placeholder="https://lin.ee/..." />
              <Input label="Facebook" value={form.facebookUrl} onChange={(v) => update("facebookUrl", v)} placeholder="https://facebook.com/..." />
            </div>
          </Section>

          {/* 管理情報 */}
          <Section title="9. 管理情報">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="サブドメイン（自動生成可）" value={form.subdomain} onChange={(v) => update("subdomain", v)} placeholder="例: sakura-seitai（空なら自動生成）" />
              <Input label="ココナラ注文ID（任意）" value={form.coconalaOrderId} onChange={(v) => update("coconalaOrderId", v)} placeholder="例: abc123" />
            </div>
          </Section>

          {/* 公開ボタン */}
          <div className="pt-4">
            <button onClick={handlePublish} disabled={publishing}
              className="w-full py-4 bg-amber-500 text-white rounded-xl font-bold text-lg hover:bg-amber-600 disabled:opacity-50 transition">
              {publishing ? "公開処理中..." : "このLPを公開する"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// --- UIパーツ ---
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className={`w-10 h-6 rounded-full transition-colors ${checked ? "bg-indigo-500" : "bg-gray-300"} relative`}>
        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? "translate-x-4.5 left-0.5" : "left-0.5"}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function Field({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="text" readOnly value={value} className="flex-1 px-3 py-2 text-sm bg-gray-50 border rounded-lg" />
        {copy && <button onClick={() => navigator.clipboard.writeText(value)} className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">コピー</button>}
      </div>
    </div>
  );
}

export default function OperatorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <OperatorContent />
    </Suspense>
  );
}
