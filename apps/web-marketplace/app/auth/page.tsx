import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { AuthForm } from "./auth-form";
import { safeSellerReturnTo } from "../../lib/seller-return";

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
  const returnTo = safeSellerReturnTo((await searchParams).returnTo);
  return (
    <>
      <SiteHeader backHref="/" backLabel="بازگشت به فروشگاه" />
      <main>
        <div className="page-intro">
          <h1>ورود به حنا</h1>
          <p>با شماره موبایل وارد شوید یا حساب جدید بسازید.</p>
        </div>
        <AuthForm returnTo={returnTo} />
      </main>
    </>
  );
}
