import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter, LandingHeader } from "../../../components/landing-chrome";
import { AuthForm } from "../../auth/auth-form";
import { sellerPanelPath } from "../../../lib/seller-return";
import styles from "./seller-login.module.css";

export const metadata: Metadata = {
  title: "ورود به پنل پذیرندگان | حنا",
  description: "ورود امن پذیرندگان فعال حنا با همان احراز هویت واقعی سامانه",
};

export default function SellerLoginPage() {
  return (
    <>
      <LandingHeader />
      <main className={styles.page} dir="rtl">
        <div className={styles.container}>
          <div className={styles.intro}>
            <span>پنل پذیرندگان حنا</span>
            <h1>مدیریت فروشگاه در حنا</h1>
            <p>برای ورود به پنل وب فروشنده از شماره موبایل حساب خود استفاده کنید. دسترسی فروشندگی فقط پس از فعال‌سازی توسط حنا تأیید می‌شود.</p>
          </div>
          <AuthForm returnTo={sellerPanelPath} audience="seller" />
          <div className={styles.register}>
            <p>هنوز پذیرنده حنا نشده‌اید؟</p>
            <Link href="/seller/register">ثبت‌نام پذیرنده جدید</Link>
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
