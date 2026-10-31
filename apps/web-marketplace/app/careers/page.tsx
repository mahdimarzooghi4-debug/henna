import type { Metadata } from "next";
import { InformationPage } from "../../components/information-page";

export const metadata: Metadata = { title: "فرصت‌های شغلی | حنا", description: "اطلاع از فرصت‌های همکاری و شغلی حنا." };

export default function CareersPage() {
  return <InformationPage title="فرصت‌های شغلی حنا" description="این صفحه مقصد فرصت‌های شغلی است. در حال حاضر آگهی استخدام یا فرم درخواست تأییدشده‌ای در مخزن حنا ثبت نشده است." actions={[{ label: "دربارهٔ حنا", href: "/about", tone: "secondary" }, { label: "همکاری فروشگاه‌ها", href: "/seller/register", tone: "primary" }]} sections={[
    { title: "آگهی‌های فعال", paragraphs: ["وقتی موقعیت شغلی باز شود، عنوان، شرح مسئولیت، نوع همکاری و روش ارسال رزومه همین‌جا اعلام می‌شود. در حال حاضر موقعیت فعالی برای نمایش نداریم."] },
    { title: "تماس دربارهٔ همکاری", paragraphs: ["نشانی رسمی دریافت رزومه در اطلاعات فعلی حنا وجود ندارد؛ این صفحه برای جلوگیری از ارسال رزومه به مقصد نامعتبر، فرم ساختگی ندارد."], links: [{ label: "صفحهٔ پشتیبانی", href: "/support" }] },
  ]} />;
}
