import type { Metadata } from "next";
import { InformationPage } from "../../components/information-page";

export const metadata: Metadata = { title: "دربارهٔ حنا", description: "آشنایی با هدف و مسیر بازارگاه حنا." };

export default function AboutPage() {
  return <InformationPage title="دربارهٔ حنا" description="حنا بازارگاهی برای مرور کالاها و خدمات روزمره است؛ با تمرکز بر فروشگاه‌های محلی و مسیرهای روشن برای حساب خریدار، فروشنده و سازمان." actions={[{ label: "دیدن کالاها", href: "/products", tone: "primary" }, { label: "همکاری فروشگاه‌ها", href: "/seller/register", tone: "secondary" }]} sections={[
    { title: "یک بازارگاه برای خرید روزانه", paragraphs: ["در حنا فهرست کالاها و خدمات منتشرشده را مرور و بر اساس دسته یا عبارت جست‌وجو می‌کنید. جزئیات هر کالا بر پایهٔ داده‌ای نمایش داده می‌شود که در کاتالوگ ثبت شده است."] },
    { title: "همراه فروشگاه‌های محلی", paragraphs: ["فروشگاه‌ها می‌توانند درخواست همکاری ثبت کنند. فعال شدن فروشگاه پس از بررسی و تأیید اطلاعات انجام می‌شود."], links: [{ label: "ثبت درخواست فروشگاه", href: "/seller/register" }] },
    { title: "حمایت با شفافیت", paragraphs: ["حنا برای طرح‌های حمایتی و توسعهٔ محلی مسیرهای جداگانه در نظر گرفته است. اطلاعات هر برنامه و اثر آن باید پیش از نمایش به‌عنوان دادهٔ تأییدشده منتشر شود."], links: [{ label: "ارزش اجتماعی حنا", href: "/impact" }, { label: "طرح‌های حمایتی", href: "/benefits" }] },
  ]} />;
}
