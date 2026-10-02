import type { Metadata } from "next";
import { InformationPage } from "../../components/information-page";

export const metadata: Metadata = { title: "شبکه‌های اجتماعی حنا", description: "اطلاع از وضعیت کانال‌های اجتماعی رسمی حنا." };

export default function SocialPage() {
  return <InformationPage title="شبکه‌های اجتماعی حنا" description="آیکون‌های شبکه‌های اجتماعی صفحهٔ اول اکنون به مقصد مشخص خودشان می‌رسند. نشانی حساب رسمی باید پیش از انتشار در همین صفحه ثبت شود." actions={[{ label: "دربارهٔ حنا", href: "/about", tone: "secondary" }, { label: "گزارش اثر اجتماعی", href: "/impact", tone: "primary" }]} sections={[
    { id: "instagram", title: "اینستاگرام", paragraphs: ["نشانی حساب رسمی اینستاگرام حنا هنوز در اطلاعات پروژه ثبت نشده است؛ برای جلوگیری از هدایت به حساب اشتباه، لینک خارجی درج نشده."] },
    { id: "twitter", title: "توییتر / ایکس", paragraphs: ["نشانی حساب رسمی توییتر یا ایکس حنا هنوز تأیید نشده است."] },
    { id: "linkedin", title: "لینکدین", paragraphs: ["نشانی صفحهٔ رسمی لینکدین حنا هنوز تأیید نشده است."] },
  ]} />;
}
