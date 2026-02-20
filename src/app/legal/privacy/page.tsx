import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー - OnePage-Flash",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0F0F1A] text-slate-100">
      <nav className="border-b border-[#2D2D44]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link href="/" className="font-black text-lg tracking-tight">
            OnePage<span className="text-amber-400">-Flash</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">プライバシーポリシー</h1>
        <p className="text-sm text-slate-500 mb-10">最終更新日: 2026年2月20日</p>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">
          <section>
            <p>株式会社バンテックス（以下「当社」）は、ホームページ作成サービス「OnePage-Flash」（以下「本サービス」）において、ユーザーの個人情報の保護に努めます。</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">1. 収集する情報</h2>
            <p className="mb-2">当社は、本サービスの提供にあたり、以下の情報を収集します。</p>
            <ul className="list-disc list-inside space-y-1">
              <li>メールアドレス（アカウント管理・連絡用）</li>
              <li>ホームページ作成のために入力されたテキスト情報（事業名、サービス内容、連絡先等）</li>
              <li>決済に関する情報（クレジットカード情報はStripe社が管理し、当社は保持しません）</li>
              <li>アクセスログ（IPアドレス、ブラウザ情報、アクセス日時）</li>
              <li>広告の効果測定に必要な情報（UTMパラメータ、セッション情報）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">2. 利用目的</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>ホームページの生成・公開・修正</li>
              <li>サブスクリプションの管理・決済処理</li>
              <li>サービスに関するご連絡（完成通知、決済通知等）</li>
              <li>サービスの改善・新機能の開発</li>
              <li>広告効果の測定・分析</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">3. 第三者提供</h2>
            <p className="mb-2">当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供いたしません。</p>
            <ul className="list-disc list-inside space-y-1">
              <li>ユーザーの同意がある場合</li>
              <li>法令に基づく場合</li>
              <li>サービス提供に必要な業務委託先（以下参照）への提供</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">4. 外部サービスの利用</h2>
            <p className="mb-2">本サービスでは、以下の外部サービスを利用しています。各サービスのプライバシーポリシーもご確認ください。</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Stripe（決済処理）</li>
              <li>Google Analytics（アクセス解析）</li>
              <li>Google Ads（広告配信・効果測定）</li>
              <li>Cloudflare（ホスティング・CDN）</li>
              <li>Google Gemini API（AI生成処理）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">5. Cookieの使用</h2>
            <p>本サービスでは、サービスの提供・改善および広告効果の測定のためにCookieを使用しています。ブラウザの設定によりCookieを無効にすることができますが、一部の機能が利用できなくなる場合があります。</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">6. 安全管理措置</h2>
            <p>当社は、個人情報の漏洩、滅失、毀損を防止するため、適切な安全管理措置を講じます。決済情報はStripe社のPCI DSS準拠環境で処理され、当社のサーバーにクレジットカード情報が保存されることはありません。</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">7. 個人情報の開示・訂正・削除</h2>
            <p>ユーザーは、当社が保有する自身の個人情報について、開示・訂正・削除を請求することができます。ご希望の場合は、下記のお問い合わせ先までご連絡ください。</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">8. お問い合わせ</h2>
            <p>
              個人情報の取り扱いに関するお問い合わせは、以下までご連絡ください。
            </p>
            <div className="mt-3 p-4 bg-[#1E2035] rounded-xl border border-[#2D2D44]">
              <p>株式会社バンテックス</p>
              <p>メール: info@bantex.jp</p>
              <p>電話: 052-847-7501</p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#2D2D44]">
          <Link href="/" className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
            &larr; トップページに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
