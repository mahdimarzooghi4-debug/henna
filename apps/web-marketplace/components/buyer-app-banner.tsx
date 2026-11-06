import Link from "next/link";
import styles from "./buyer-app-banner.module.css";

export function BuyerAppBanner() {
  return (
    <section className={styles.banner} aria-labelledby="buyer-app-title">
      <div>
        <span className={styles.eyebrow}>نسخه اندروید حنا برای خریداران</span>
        <h2 id="buyer-app-title">حنا را روی گوشی خود داشته باشید</h2>
        <p>مرور کالاها، پیگیری سفارش‌ها و پشتیبانی از طریق اپلیکیشن خریدار.</p>
      </div>
      <Link href="/download" className={styles.link}>
        دریافت اپلیکیشن خریدار
      </Link>
    </section>
  );
}
