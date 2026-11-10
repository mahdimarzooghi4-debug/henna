import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../components/landing-chrome";
import styles from "./auth-page.module.css";
import { AuthForm } from "./auth-form";
import { AuthPreviewForm } from "./auth-preview-form";
import { safeAuthReturnTo } from "../../lib/seller-return";

export const metadata: Metadata = {
  title: "ورود به حنا",
  description: "ورود و ثبت‌نام با شماره موبایل در سامانه حنا",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[]; mode?: string | string[] }>;
}) {
  // Resolve and allowlist on the server; do not expose arbitrary redirects.
  const params = await searchParams;
  const returnTo = safeAuthReturnTo(params.returnTo);
  // Stage-only opt-in, never a session or a protected return destination.
  const preview = process.env.HANA_AUTH_UI_PREVIEW === "1" &&
    params.returnTo === undefined && params.mode !== "live";
  return (
    <>
      <LandingHeader />
      <main className={styles.main} dir="rtl">
        {preview ? <AuthPreviewForm /> : <AuthForm returnTo={returnTo} />}
      </main>
      <LandingFooter />
    </>
  );
}
