import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../../components/landing-chrome";
import { PublicSellerRegistrationForm } from "./public-registration-form";

export const metadata: Metadata = {
  title: "ثبت‌نام آزاد فروشنده | حنا",
  description: "ارسال درخواست ثبت‌نام فروشگاه و ارائه‌دهنده بدون نیاز به حساب خریدار",
};

export default function SellerRegistrationPage() {
  return <>
    <LandingHeader />
    <main className="seller-registration-page">
      <section className="seller-intro-summary">
        <h1>ثبت‌نام فروشنده / ارائه‌دهنده</h1>
        <p>درخواست همکاری را بدون ورود به حساب خریدار ثبت کنید.
          ثبت درخواست، تأیید فروشگاه یا دسترسی فروشندگی ایجاد نمی‌کند.</p>
      </section>
      <PublicSellerRegistrationForm />
    </main>
    <LandingFooter />
  </>;
}
