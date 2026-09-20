import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { AuthForm } from "./auth-form";

export const metadata: Metadata = {
  title: "ورود به حنا",
  description: "ورود و ثبت‌نام با شماره موبایل در سامانه حنا",
};

export default function AuthPage() {
  return (
    <>
      <SiteHeader backHref="/" backLabel="بازگشت به فروشگاه" />
      <main>
        <div className="page-intro">
          <h1>ورود به حنا</h1>
          <p>با شماره موبایل وارد شوید یا حساب جدید بسازید.</p>
        </div>
        <AuthForm />
      </main>
    </>
  );
}
