import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { approvedAndroidReleaseUrl } from "../../lib/mobile-release-links";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "دانلود اپلیکیشن خریدار حنا",
  description: "مسیر رسمی دریافت نسخه اندروید اپلیکیشن خریدار حنا",
};

export default function BuyerAppDownloadPage() {
  // Set ONLY after explicit release approval and verified artifact publication.
  const approvedUrl = approvedAndroidReleaseUrl(
    process.env.HANA_BUYER_ANDROID_APPROVED_URL,
  );
  const previewUrl = approvedAndroidReleaseUrl(
    process.env.HANA_BUYER_ANDROID_PREVIEW_URL,
  );
  return (
    <>
      <SiteHeader backHref="/" backLabel="بازگشت به فروشگاه" />
      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="buyer-download-title">
          <span className={styles.kicker}>اپلیکیشن خریدار حنا · Android</span>
          <h1 id="buyer-download-title">حنا همیشه همراه شما</h1>
          <p>برای مرور کالاها و خدمات، مدیریت خریدها و پیگیری سفارش‌های خود، اپلیکیشن خریدار حنا را نصب کنید.</p>
          {approvedUrl ? (
            <a className={styles.primary} href={approvedUrl} rel="noopener noreferrer" download>
              دریافت نسخه رسمی اندروید
            </a>
          ) : previewUrl ? (
            <>
              <div className={styles.pending} role="status">
                نسخه آزمایشی برای بررسی نصب و تجربه اپ آماده است؛ این نسخه انتشار رسمی یا امضای فروشگاهی ندارد.
              </div>
              <a className={styles.primary} href={previewUrl} rel="noopener noreferrer" download>
                دانلود نسخه آزمایشی خریدار (APK)
              </a>
            </>
          ) : (
            <div className={styles.pending} role="status">
              هنوز فایل قابل دانلودی ثبت نشده است. پس از آماده‌شدن نسخه آزمایشی یا انتشار رسمی، لینک دریافت در همین صفحه قرار می‌گیرد.
            </div>
          )}
          <p className={styles.note}>
            فقط از لینک رسمی این صفحه استفاده کنید؛ لینک نصب فروشنده از مسیر مستقل و ویژه فروشندگان فعال ارائه می‌شود.
          </p>
        </section>
      </main>
    </>
  );
}
