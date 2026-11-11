import Image from "next/image";
import Link from "next/link";
import styles from "./seller-registration-shell.module.css";

/** Seller-only chrome: Figma 277:151 / 282:8; buyer sign-in is optional. */
export function SellerRegistrationShell({children}: {children:React.ReactNode}){
  return <div className={styles.layout} dir="rtl">
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <Link href="/" className={styles.brand} aria-label="حنا، صفحه اصلی">
          <Image src="/hana-logo.png" alt="حنا" width={147} height={82} priority unoptimized/>
        </Link>
        <div className={styles.headerActions}>
          <span className={styles.sellerLabel}>ثبت‌نام فروشگاه‌ها و ارائه‌دهندگان</span>
          <span className={styles.separator} aria-hidden="true"/>
          <Link className={styles.optionalLogin} href="/auth">ورود به حساب کاربری</Link>
        </div>
      </div>
    </header>
    <main className={styles.main}>{children}</main>
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.footerAbout}>
          <Image src="/hana-logo.png" alt="حنا" width={147} height={82} unoptimized/>
          <p>حنا بازارگاهی برای اتصال کاربران، فروشندگان و ارائه‌دهندگان و تسهیل دسترسی به کالاها و خدمات است.</p>
        </div>
        <div className={styles.quickLinks}>
          <strong>دسترسی سریع</strong>
          <Link href="/faq">سوالات متداول</Link>
          <Link href="/terms">قوانین و مقررات</Link>
          <Link href="/about">درباره حنا</Link>
          <Link href="/support">تماس با پشتیبانی</Link>
        </div>
      </div>
      <div className={styles.footerBottom}>
        <p>© بازارگاه اجتماعی حنا. تمامی حقوق محفوظ است.</p>
        <div aria-label="شبکه‌های اجتماعی">
          <Link href="/social#instagram" aria-label="اینستاگرام">◎</Link>
          <Link href="/social#twitter" aria-label="شبکه اجتماعی">𝕏</Link>
          <Link href="/social#linkedin" aria-label="لینکدین">in</Link>
        </div>
      </div>
    </footer>
  </div>;
}
