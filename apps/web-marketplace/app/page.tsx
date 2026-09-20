import Link from "next/link";
import { SiteHeader } from "../components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader backHref="/auth" backLabel="ورود / ثبت‌نام" />
      <main className="bootstrap">
        <h1>حنا</h1>
        <p>صفحه اصلی فروشگاه هنوز از مرجع طراحیِ تأییدشده پیاده‌سازی نشده است.</p>
        <p>دو صفحه نخست فرانت‌اند، مطابق فریم‌های موجود فیگما، در دسترس‌اند:</p>
        <nav className="bootstrap__links" aria-label="صفحه‌های فعلی">
          <Link href="/auth">ورود / ثبت‌نام</Link>
          <Link href="/seller/register">ثبت‌نام فروشگاه</Link>
        </nav>
      </main>
    </>
  );
}
