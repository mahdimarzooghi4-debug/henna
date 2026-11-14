import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../components/landing-chrome";
import styles from "./download.module.css";
import { buyerAndroidPreview, sellerAndroidPreview } from "../../lib/landing-android-preview";

const entries = [
  {
    role: "buyer",
    label: "خریدار",
    title: "اپلیکیشن خریدار حنا",
    description: "دسترسی به بازارگاه و بخش‌های خرید حنا از تلفن همراه.",
    android: buyerAndroidPreview.apk,
    details: buyerAndroidPreview.details,
    ios: "/install/buyer",
  },
  {
    role: "seller",
    label: "فروشنده",
    title: "اپلیکیشن فروشنده حنا",
    description: "دسترسی به پیشخوان و امکانات فروشندگی حنا از تلفن همراه.",
    android: sellerAndroidPreview.apk,
    details: sellerAndroidPreview.details,
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
            <p>نسخه آزمایشی خریدار یا فروشنده را مستقیماً برای اندروید دریافت کنید؛ برای آیفون، نسخه وب حنا را به صفحه اصلی اضافه کنید.</p>
          </header>
          <section className={styles.cards} aria-label="انتخاب نسخه اپلیکیشن">
            {entries.map(app => (
              <article className={styles.card} key={app.role} data-testid={"app-download-"+app.role}>
                <span className={styles.role}>{app.label}</span>
                <h2>{app.title}</h2>
                <p>{app.description}</p>
                <div className={styles.actions}>
                  <a className={styles.primary} data-testid={"download-android-"+app.role}
                    aria-label={"دانلود فایل APK اندروید " + app.label}
                    href={app.android} referrerPolicy="no-referrer">
                    دانلود مستقیم APK اندروید
                  </a>
                  <a className={styles.secondary} data-testid={"download-ios-"+app.role}
                    href={app.ios}>
                    نصب برای آیفون (PWA)
                  </a>
                </div>
                <p className={styles.platformHelp}>اندروید: فایل APK آزمایشی | آیفون: نصب نسخه وب از Safari</p>
                {app.role === "buyer" && (
                  <p className={styles.buyerHint}>نسخه جدید پیش‌نمایش فیگما برای خریدار (حدود ۷۹ مگابایت) شامل خانه، کاتالوگ و فیلترهای نمونه است. این اطلاعات واقعی نیستند و خرید یا پرداخت فعال نیست. اگر نسخه آزمایشی قبلی نصب است و خطای ناسازگاری امضا می‌گیرید، ابتدا همان نسخه قبلی را حذف کنید. در خطای «Problem parsing package»، کامل‌بودن دانلود و نسخه Android دستگاه را بررسی کنید.</p>
                )}
              </article>
            ))}
          </section>
          <aside className={styles.note} role="note">
            <strong>وضعیت دسترسی</strong>
            <p>فایل‌های اندروید نسخه آزمایشی و امضاشده برای بررسی هستند، نه نسخه نهایی بازارگاه. دانلود APK از GitHub Releases انجام می‌شود؛ این فایل روی سرور hennamarket.ir میزبانی نمی‌شود. امکانات پرداخت یا فروش واقعی هنوز آماده نیستند. نسخه آیفون از نوع PWA است و به اینترنت نیاز دارد.</p>
            <div className={styles.releaseLinks}>
              <a href={buyerAndroidPreview.details}
                target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                مشخصات نسخه خریدار و اصالت فایل
              </a>
              <a href={sellerAndroidPreview.details}
                target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                مشخصات نسخه فروشنده و اصالت فایل
              </a>
            </div>
          </aside>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
