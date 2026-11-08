import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { approvedAndroidReleaseUrl } from "../../lib/mobile-release-links";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "دانلود اپلیکیشن خریدار حنا",
  description: "دریافت نسخه اندروید خریدار و بررسی دسترسی نصب اپ فروشنده حنا",
};

export default function BuyerAppDownloadPage() {
  const buyerApprovedUrl = approvedAndroidReleaseUrl(
    process.env.HANA_BUYER_ANDROID_APPROVED_URL,
  );
  const buyerPreviewUrl = approvedAndroidReleaseUrl(
    process.env.HANA_BUYER_ANDROID_PREVIEW_URL,
  );

  return (
    <>
      <SiteHeader backHref="/" backLabel="بازگشت به فروشگاه" />
      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="download-title">
          <span className={styles.kicker}>اپلیکیشن‌های حنا · Android</span>
          <h1 id="download-title">دانلود اپلیکیشن خریدار حنا</h1>
          <p>
            اپ خریدار را برای مرور کالاها و پیگیری سفارش‌ها دریافت کنید.
            نسخه آزمایشی فقط برای بررسی است؛ فروشندگان باید دسترسی خود را جداگانه تأیید کنند.
          </p>
          <div className={styles.version} role="status">
            {buyerApprovedUrl ? "نسخه تأییدشده خریدار" : "نسخه آزمایشی خریدار، فقط برای بازبینی"}
          </div>
          <div className={styles.appGrid}>
            <article className={styles.appCard}>
              <span className={styles.appType}>برای خرید</span>
              <h2>حنا خریدار</h2>
              <p>
                مرور کاتالوگ، مشاهدهٔ کالاها، سبد خرید و پیگیری سفارش‌ها.
              </p>
              {buyerApprovedUrl ? (
                <a className={styles.primary} href={buyerApprovedUrl} rel="noopener noreferrer" download>
                  دریافت نسخهٔ خریدار
                </a>
              ) : buyerPreviewUrl ? (
                <a className={styles.primary} href="/api/mobile-apk/buyer" rel="noopener noreferrer" download>
                  دانلود APK خریدار
                </a>
              ) : (
                <div className={styles.pending} role="status">
                  فایل خریدار هنوز در دسترس نیست.
                </div>
              )}
            </article>

            <article className={styles.appCard}>
              <span className={styles.appType}>برای فروش</span>
              <h2>حنا فروشنده</h2>
              <p>
                ورود فروشنده، مشاهدهٔ پنل و مدیریت سفارش‌های فروشگاه.
              </p>
              <a className={styles.secondary} href="/seller/app">
                بررسی دسترسی دریافت اپ فروشنده
              </a>
            </article>
          </div>
          <p className={styles.note}>
            لینک نسخه آزمایشی خریدار، در صورت پیکربندی، برای بازبینی است و انتشار رسمی محسوب نمی‌شود.
            دانلود نسخه فروشنده تنها پس از ورود و تأیید وضعیت فعال حساب ارائه می‌شود.
          </p>
        </section>
      </main>
    </>
  );
}
