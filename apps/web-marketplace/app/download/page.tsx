import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../components/landing-chrome";
import styles from "./download.module.css";

const release = "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-1783-1";
const entries = [
  {
    role: "buyer",
    label: "خریدار",
    title: "اپلیکیشن خریدار حنا",
    description: "دسترسی به بازارگاه و بخش‌های خرید حنا از تلفن همراه.",
    android: "hana-buyer-preview.apk",
    ios: "/install/buyer",
  },
  {
    role: "seller",
    label: "فروشنده",
    title: "اپلیکیشن فروشنده حنا",
    description: "دسترسی به پیشخوان و امکانات فروشندگی حنا از تلفن همراه.",
    android: "hana-seller-preview.apk",
    ios: "/install/seller",
  },
] as const;

export const metadata: Metadata = {
  title: "دریافت اپلیکیشن حنا | اندروید و آیفون",
  description: "دریافت نسخه اندروید و نصب نسخه وب حنا برای خریدار و فروشنده روی آیفون.",
};

export default function DownloadAppPage() {
  return (
    <>
      <LandingHeader />
      <main className={styles.page} dir="rtl" data-testid="download-app-page">
        <div className={styles.container}>
          <header className={styles.intro}>
            <span className={styles.eyebrow}>حنا در تلفن همراه</span>
            <h1>دریافت اپلیکیشن حنا</h1>
            <p>نسخه ویژه خریدار یا فروشنده را برای اندروید دریافت کنید؛ برای آیفون، نسخه وب حنا را به صفحه اصلی اضافه کنید.</p>
          </header>
          <section className={styles.cards} aria-label="انتخاب نسخه اپلیکیشن">
            {entries.map(app => (
              <article className={styles.card} key={app.role} data-testid={"app-download-"+app.role}>
                <span className={styles.role}>{app.label}</span>
                <h2>{app.title}</h2>
                <p>{app.description}</p>
                <div className={styles.actions}>
                  <a className={styles.primary} data-testid={"download-android-"+app.role}
                    href={release+"/"+app.android}
                    target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                    دریافت برای اندروید
                  </a>
                  <a className={styles.secondary} data-testid={"download-ios-"+app.role}
                    href={app.ios}>
                    نصب برای آیفون (PWA)
                  </a>
                </div>
                <p className={styles.platformHelp}>اندروید: فایل نصب APK | آیفون: نصب نسخه وب از Safari</p>
              </article>
            ))}
          </section>
          <aside className={styles.note} role="note">
            <strong>وضعیت دسترسی</strong>
            <p>فایل‌های اندروید نسخه فعلیِ در حال توسعه هستند و برای پرداخت یا فروش واقعی آماده نشده‌اند. نسخه آیفون از نوع PWA است و به اینترنت نیاز دارد؛ نصب آن به معنی فعال‌شدن امکانات مالی یا عملیاتی نیست.</p>
            <a href="https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-mobile-preview-1783-1"
              target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
              مشخصات نسخه اندروید و اصالت فایل‌ها
            </a>
          </aside>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
