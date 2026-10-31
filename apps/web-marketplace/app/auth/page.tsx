import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../components/landing-chrome";
import styles from "./auth-page.module.css";
import { AuthForm } from "./auth-form";
import { safeAuthReturnTo } from "../../lib/seller-return";

export const metadata: Metadata = {
  title: "ورود به حنا",
  description: "ورود و ثبت‌نام با شماره موبایل در سامانه حنا",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  // Resolve and allowlist on the server; do not expose arbitrary redirects.
  const returnTo = safeAuthReturnTo((await searchParams).returnTo);
  return (
    <>
      <LandingHeader />
      <main className={styles.main} dir="rtl">
        <AuthForm returnTo={returnTo} />
      </main>
      <LandingFooter />
    </>
  );
}
