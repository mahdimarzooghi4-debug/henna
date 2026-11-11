import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../../../components/landing-chrome";
import { RegistrationForm } from "../registration-form";

export const metadata: Metadata = {
  title: "ادامه پرونده فروشنده متصل به حساب | حنا",
  description: "فرایند قدیمی ثبت پرونده متصل به حساب تأییدشده، برای پرونده‌های جاری",
};

// Legacy account-linked journey remains intact for existing account-owned
// drafts. Public applicants use /seller/register and never need buyer login.
export default function SellerAccountRegistrationPage() {
  return <>
    <LandingHeader />
    <main className="seller-registration-page">
      <section className="seller-intro-summary">
        <h1>ادامه پرونده فروشنده متصل به حساب</h1>
        <p>این مسیر مخصوص پرونده‌های قدیمی متصل به حساب است.
          ثبت درخواست جدید بدون ورود از صفحه عمومی انجام می‌شود.</p>
      </section>
      <RegistrationForm />
    </main>
    <LandingFooter />
  </>;
}
