import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { approvedAndroidReleaseUrl } from "../../lib/mobile-release-links";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "دانلود اپلیکیشن‌های حنا",
  description: "دریافت نسخه‌های آزمایشی اندروید اپلیکیشن خریدار و فروشنده حنا",
};

export default function BuyerAppDownloadPage() {
  const buyerApprovedUrl = approvedAndroidReleaseUrl(
    process.env.HANA_BUYER_ANDROID_APPROVED_URL,
  );
  const buyerPreviewUrl = approvedAndroidReleaseUrl(
    process.env.HANA_BUYER_ANDROID_PREVIEW_URL,
  );
  const sellerPreviewUrl = approvedAndroidReleaseUrl(
    process.env.HANA_SELLER_ANDROID_PREVIEW_URL,
  );

  return (
    <>
      <SiteHeader backHref="/" backLabel="بازگشت به فروشگاه" />
      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="download-title">
          <span className={styles.kicker}>اپلیکیشن‌های حنا · Android</span>
          <h1 id="download-title">نسخه‌ها را نصب و بررسی کنید</h1>
          <p>
            نسخه‌های آزمایشی خریدار و فروشنده را دریافت کنید و ایرادهای هر صفحه
            را برای اصلاح مرحله‌به‌مرحله بفرستید.
          </p>
          <div className={styles.version} role="status">
            نسخهٔ بازبینی ۱۶۳۰ · آزمایشی و مناسب بررسی
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
                <a className={styles.primary} href={buyerPreviewUrl} rel="noopener noreferrer" download>
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
              {sellerPreviewUrl ? (
                <a className={styles.secondary} href={sellerPreviewUrl} rel="noopener noreferrer" download>
                  دانلود APK فروشنده
                </a>
              ) : (
                <div className={styles.pending} role="status">
                  فایل فروشنده هنوز در دسترس نیست.
                </div>
              )}
            </article>
          </div>
          <p className={styles.note}>
            این نسخه‌ها برای بازبینی هستند و انتشار رسمی فروشگاهی محسوب نمی‌شوند.
            پس از نصب، لطفاً ایرادها را به تفکیک صفحه بفرستید.
          </p>
        </section>
      </main>
    </>
  );
}
