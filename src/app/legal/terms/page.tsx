import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約 - OnePage-Flash",
};

export default function TermsPage() {
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
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">利用規約</h1>
        <p className="text-sm text-slate-500 mb-10">最終更新日: 2026年2月20日</p>

        <div className="space-y-8 text-sm text-slate-400 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">第1条（適用）</h2>
            <p>本規約は、株式会社バンテックス（以下「当社」）が提供するホームページ作成サービス「OnePage-Flash」（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意のうえ、本サービスを利用するものとします。</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">第2条（サービス内容）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>本サービスは、ユーザーが入力したテキスト情報をもとに、AIがホームページを自動生成し、当社指定のサブドメインで公開するサービスです。</li>
              <li>生成されるホームページはテキストベースであり、ユーザーが提供した画像の掲載には対応しておりません。</li>
              <li>当社は、本サービスの内容を予告なく変更・追加・廃止することがあります。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">第3条（料金・支払い）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>本サービスの利用には、初期制作費および月額利用料が発生します。料金は本サービスのウェブサイト上に表示された金額に従います。</li>
              <li>月額利用料は、初月無料期間終了後、毎月自動的にクレジットカードに課金されます。</li>
              <li>デジタルコンテンツの性質上、決済完了後の返金・返品はお受けできません。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">第4条（サブスクリプション・解約）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>月額利用料の支払いが停止された場合（解約を含む）、当該サイトは非公開となります。</li>
              <li>ユーザーはいつでも解約が可能です。解約後も現在の課金期間終了までサイトは公開されます。</li>
              <li>解約後にサブスクリプションを再開した場合、既存のサイトデータが残っていれば即座に再公開されます。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">第5条（禁止事項）</h2>
            <p className="mb-2">ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>法令または公序良俗に違反する内容のサイト作成</li>
              <li>第三者の権利（著作権、商標権、名誉権等）を侵害する行為</li>
              <li>虚偽の情報を入力してサイトを作成する行為</li>
              <li>本サービスのシステムに対する不正アクセスや妨害行為</li>
              <li>その他、当社が不適切と判断する行為</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">第6条（サービスの停止・終了）</h2>
            <p>当社は、以下の場合にユーザーへの事前通知なく本サービスの全部または一部を停止・終了することがあります。</p>
            <ol className="list-decimal list-inside space-y-2 mt-2">
              <li>システムの保守・更新を行う場合</li>
              <li>天災、停電等の不可抗力により提供が困難な場合</li>
              <li>ユーザーが本規約に違反した場合</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">第7条（免責事項）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>当社は、本サービスにより生成されたホームページの内容の正確性・完全性を保証するものではありません。</li>
              <li>AIによる生成結果に起因してユーザーまたは第三者に損害が発生した場合でも、当社は一切の責任を負いません。</li>
              <li>当社の責任は、いかなる場合でも、ユーザーが当社に支払った直近1ヶ月分の利用料金を上限とします。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">第8条（知的財産権）</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>本サービスのシステム、デザイン、プログラムに関する知的財産権は当社に帰属します。</li>
              <li>ユーザーが入力したテキスト・コンテンツの権利はユーザーに帰属します。</li>
              <li>AIにより生成されたHTMLコードの利用権は、サブスクリプション有効期間中、ユーザーに非独占的に許諾されます。</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">第9条（準拠法・管轄）</h2>
            <p>本規約は日本法に準拠し、本サービスに関する紛争については名古屋地方裁判所を第一審の専属的合意管轄裁判所とします。</p>
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
