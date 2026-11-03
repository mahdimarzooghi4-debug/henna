import type { Metadata } from "next";
import { InformationPage } from "../../components/information-page";

export const metadata: Metadata = { title: "سوالات متداول | حنا", description: "پاسخ پرسش‌های متداول دربارهٔ حساب و مرور کاتالوگ حنا." };

export default function FaqPage() {
  return <InformationPage title="سوالات متداول" description="راهنمای کوتاه استفاده از صفحه‌ها و مسیرهای موجود حنا." actions={[{ label: "رفتن به کاتالوگ", href: "/products", tone: "primary" }, { label: "صفحهٔ پشتیبانی", href: "/support", tone: "secondary" }]} sections={[
    { title: "چطور کالا یا دسته‌ای را پیدا کنم؟", paragraphs: ["از جست‌وجوی بالای صفحه استفاده کنید یا دستهٔ موردنظر را انتخاب کنید. فهرست فقط اطلاعاتی را نشان می‌دهد که از کاتالوگ حنا دریافت شده باشد."], links: [{ label: "باز کردن کاتالوگ", href: "/products" }] },
    { title: "آیا قیمت‌های کارت‌های صفحهٔ اول واقعی‌اند؟", paragraphs: ["قیمت کارت‌های معرفی در صفحهٔ اول نمونهٔ گرافیکی‌اند. قیمت و موجودی واقعی را تنها باید از پیشنهاد منتشرشدهٔ فروشگاه در صفحات محصول دریافت کرد."] },
    { title: "چطور فروشگاه ثبت‌نام می‌کند؟", paragraphs: ["مسیر ثبت‌نام فروشگاه فرم چندمرحله‌ای دارد. ثبت اطلاعات به‌تنهایی به معنی تأیید یا فعال شدن فروشگاه نیست."], links: [{ label: "شروع ثبت‌نام فروشگاه", href: "/seller/register" }] },
    { title: "اگر اطلاعات کالا باز نشد چه کنم؟", paragraphs: ["ممکن است سرویس کاتالوگ موقتاً در دسترس نباشد. دوباره تلاش کنید یا از بخش پشتیبانی وضعیت سرویس را ببینید."], links: [{ label: "تماس با پشتیبانی", href: "/support" }] },
  ]} />;
}
