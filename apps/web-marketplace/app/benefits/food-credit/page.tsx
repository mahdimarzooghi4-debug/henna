import type { Metadata } from "next";
import { InformationPage } from "../../../components/information-page";

export const metadata: Metadata = {
  title: "کالابرگ الکترونیکی | حنا",
  description: "راهنمای کالابرگ و مرزبندی آن با اعتبارهای ثبت‌شده در حساب حنا.",
};

export default function FoodCreditPage() {
  return <InformationPage
    eyebrow="حنا • راهنمای کالابرگ"
    title="کالابرگ الکترونیکی"
    description="اطلاعات عمومی کالابرگ در این بخش ارائه می‌شود. این صفحه امکان استعلام یارانه، تشخیص مشمولیت یا پرداخت واقعی با کالابرگ را ارائه نمی‌کند."
    actions={[{ label: "مشاهده اعتبارهای حساب من", href: "/benefits", tone: "primary" }]}
    sections={[
      {
        title: "وضعیت اعتبار کالابرگ",
        paragraphs: ["اعتبار کالابرگ فقط از منبع رسمی و تأییدشده قابل استعلام است. حنا در این صفحه مبلغ، مشمولیت یا موجودی یارانه را حدس نمی‌زند."],
      },
      {
        title: "کالاها و فروشگاه‌ها",
        paragraphs: ["مرور کاتالوگ به‌معنای تأیید کالابرگی بودن کالا، فروشگاه یا سفارش نیست. شرایط استفاده باید از سرویس معتبر و فعال دریافت شود."],
        links: [{ label: "مرور کالاها و خدمات", href: "/products" }],
      },
      {
        title: "پرسش درباره اعتبارهای حنا",
        paragraphs: ["اعتبارهایی که واقعاً برای حساب شما ثبت شده‌اند، در صفحه اعتبارهای من نمایش داده می‌شوند و با استعلام عمومی کالابرگ یکی نیستند."],
        links: [{ label: "اعتبارهای من", href: "/benefits" }, { label: "پشتیبانی", href: "/support" }],
      },
    ]}
  />;
}
