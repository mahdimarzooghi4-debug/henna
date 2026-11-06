import type { Metadata } from "next";
import { SiteHeader } from "../../../components/site-header";
import { SellerAppDownloadView } from "./seller-app-download-view";

export const metadata: Metadata = {
  title: "دریافت اپلیکیشن فروشنده حنا",
  description: "دریافت نسخه اندروید برای فروشندگان تأیید و فعال‌شده حنا",
};

export default function SellerAppDownloadPage() {
  return (
    <>
      <SiteHeader backHref="/seller/register/status" backLabel="وضعیت درخواست" />
      <main className="page-intro page-intro--seller">
        <h1>اپلیکیشن فروشنده حنا</h1>
        <p>این مسیر برای فروشندگان تأیید و فعال‌شده است. لینک دانلود به‌تنهایی مجوز ورود یا فروشندگی ایجاد نمی‌کند.</p>
        <SellerAppDownloadView />
      </main>
    </>
  );
}
