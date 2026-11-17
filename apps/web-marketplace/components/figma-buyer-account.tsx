import Link from "next/link";
import styles from "./figma-buyer-account.module.css";
import { BuyerAccountNav } from "./buyer-account-nav";

export function FigmaBuyerAccount() {
  return (
    <main className={styles.page} dir="rtl" data-testid="preview-account">
      <div className={styles.layout}>
        <BuyerAccountNav active="account" />
        <section className={styles.content} aria-label="حساب من">
          <section className={styles.summary} data-testid="preview-account-summary">
            <h1>حساب من</h1>
            <p>همه بخش‌های حساب، سفارش‌ها، آدرس‌ها، روش‌های پرداخت و اعتبارهای شما در یک صفحه جمع‌وجور نمایش داده می‌شود.</p>
          </section>
          <article className={styles.infoCard} id="account-info" data-testid="preview-account-info">
            <h2>اطلاعات حساب</h2>
            <div className={styles.divider} />
            <dl className={styles.fields}>
              <div className={styles.fullField}><dt>نام و نام خانوادگی</dt><dd>کاربر نمونه</dd></div>
              <div><dt>ایمیل</dt><dd>ایمیل نمونه</dd></div>
              <div><dt>شماره تلفن همراه</dt><dd>شماره تماس نمونه</dd></div>
            </dl>
            <div className={styles.infoActions}>
              <Link href="/buyer/profile?mode=preview" className={styles.edit}>ویرایش اطلاعات حساب</Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
