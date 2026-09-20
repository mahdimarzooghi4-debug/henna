import type { Metadata } from "next";
import { SiteHeader } from "../../../components/site-header";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "ثبت‌نام فروشگاه در حنا",
  description: "اطلاعات اولیه فروشگاه برای ثبت‌نام در حنا",
};

export default function SellerRegistrationPage() {
  return (
    <>
      <SiteHeader backHref="/auth" backLabel="ورود / ثبت‌نام" />
      <main>
        <div className="page-intro page-intro--seller">
          <h1>ثبت‌نام فروشگاه در حنا</h1>
          <p>فروشگاه شما بعد از بررسی و تأیید می‌تواند در شبکه فروشندگان حنا فعال شود.</p>
        </div>
        <nav className="registration-steps" aria-label="مراحل ثبت‌نام فروشگاه">
          <span className="registration-steps__active" aria-current="step">۱ اطلاعات اولیه</span>
          <span>۲ اطلاعات کسب‌وکار　۳ محدوده فعالیت</span>
          <span>۴ مدارک و احراز　۵ بررسی نهایی</span>
        </nav>
        <RegistrationForm />
      </main>
    </>
  );
}
