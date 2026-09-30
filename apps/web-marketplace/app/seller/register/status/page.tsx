import type { Metadata } from "next";
import { SiteHeader } from "../../../../components/site-header";
import { SellerApplicationStatusView } from "./status-view";

export const metadata: Metadata = {
  title: "وضعیت درخواست فروشندگی حنا",
  description: "پیگیری وضعیت درخواست ثبت‌نام فروشنده در حنا",
};

export default function SellerApplicationStatusPage() {
  return (
    <>
      <SiteHeader backHref="/seller/register" backLabel="بازگشت" />
      <main>
        <div className="page-intro page-intro--seller">
          <h1>وضعیت ثبت‌نام فروشنده</h1>
          <p>وضعیت درخواست ثبت‌شده از حساب جاری نمایش داده می‌شود.</p>
        </div>
        <SellerApplicationStatusView />
      </main>
    </>
  );
}
