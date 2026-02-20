import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 - OnePage-Flash",
};

export default function TokushohoPage() {
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
        <h1 className="text-2xl sm:text-3xl font-bold mb-10">特定商取引法に基づく表記</h1>

        <div className="space-y-6 text-sm leading-relaxed">
          <dl className="divide-y divide-[#2D2D44]">
            {[
              ["事業者名", "株式会社バンテックス"],
              ["代表者", "番野政彦"],
              ["所在地", "〒468-0015\n愛知県名古屋市天白区原3丁目304番1号"],
              ["電話番号", "052-847-7501"],
              ["メールアドレス", "info@bantex.jp"],
              ["販売価格", "初期制作費 3,980円（税込）\n月額利用料 480円/月（税込・初月無料）\n※サービス内容により異なる場合があります。詳細は各サービスページをご確認ください。"],
              ["支払方法", "クレジットカード（Visa / Mastercard / American Express / JCB）"],
              ["支払時期", "クレジットカード：お申し込み時に即時決済\n月額利用料：毎月自動更新（初月無料期間終了後に課金開始）"],
              ["サービスの提供時期", "決済完了後、通常1〜10分以内にホームページを生成・公開いたします。"],
              ["返品・キャンセルについて", "デジタルコンテンツの性質上、購入後の返品・キャンセル・返金はお受けできません。ご購入前に、サービス内容をよくご確認ください。"],
              ["月額サブスクリプションの解約", "マイページまたはStripe Billing Portalからいつでも解約可能です。解約後、現在の課金期間終了時にサイトが非公開となります。再開時は即時復旧されます。"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col sm:flex-row py-4 gap-1 sm:gap-0">
                <dt className="sm:w-48 flex-shrink-0 font-semibold text-slate-300">{label}</dt>
                <dd className="text-slate-400 whitespace-pre-line">{value}</dd>
              </div>
            ))}
          </dl>
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
