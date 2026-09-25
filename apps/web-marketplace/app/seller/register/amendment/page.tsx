import type { Metadata } from "next";
import { SiteHeader } from "../../../../components/site-header";
import { SellerAmendmentView } from "./amendment-view";

export const metadata: Metadata = {
  title: "تکمیل اطلاعات درخواست فروشندگی حنا",
  description: "پاسخ به درخواست تکمیل اطلاعات پرونده فروشندگی",
};

export default function SellerAmendmentPage() {
  return (
    <>
      <SiteHeader backHref="/seller/register/status" backLabel="بازگشت" />
      <main>
        <div className="page-intro page-intro--seller">
          <h1>تکمیل اطلاعات درخواست</h1>
          <p>پاسخ اصلاحی برای همان پرونده و کد پیگیری ثبت می‌شود.</p>
        </div>
        <SellerAmendmentView />
      </main>
    </>
  );
}
