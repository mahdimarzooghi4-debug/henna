import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import styles from "./henna-homepage.module.css";

const categoryHref = (label: string) => `/products?categoryName=${encodeURIComponent(label)}#buyer-categories-title`;

export function LandingHeader() {
  return (
    <Fragment>
      <div className={styles.announcement}>🎉 طرح جدید کالابرگ حنا فعال شد؛ خریدی هوشمندانه با بیشترین حمایت اجتماعی</div>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.actions}>
            <Link className={styles.cart} href="/buyer/cart"><span className={styles.cartCount}>۰</span> سبد خرید <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 4h2l2.2 11h10.7L20 8H6"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></svg></Link>
            <Link className={styles.login} href="/auth">ورود یا ثبت‌نام <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 21c.5-4 2.8-6 7-6s6.5 2 7 6"/></svg></Link>
            <span className={styles.divider} />
            <Link className={styles.sellerLink} href="/seller/register">ثبت‌نام فروشگاه‌ها</Link>
          </div>
          <form className={styles.search} action="/products">
            <input name="search" placeholder="جست‌وجوی نان، لبنیات، برنج و اقلام روزانه..." aria-label="جست‌وجو در کالاها" />
            <button aria-label="جست‌وجو"><svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg></button>
          </form>
          <Link href="/" className={styles.brand} aria-label="حنا، صفحه اصلی">
            <Image src="/hana-logo.png" alt="حنا" width={220} height={124} unoptimized priority />
          </Link>
        </div>
        <nav className={styles.nav} aria-label="دسته‌بندی اصلی">
          <Link href="/products#buyer-categories-title">همه‌ دسته‌ها</Link><Link href={categoryHref("میوه و سبزیجات")}>میوه و سبزیجات</Link><Link href={categoryHref("نوشیدنی‌ها")}>نوشیدنی‌ها</Link><Link href={categoryHref("خواربار و نان")}>خواربار و نان</Link><Link href={categoryHref("لبنیات و تخم مرغ")}>لبنیات و تخم مرغ</Link><Link href="/benefits#special-plans">طرح‌های ویژه حنا</Link><Link href="/benefits#food-credit">کالابرگ الکترونیکی</Link><Link href="/discounts">تخفیف‌های طلایی</Link>
        </nav>
      </header>
    </Fragment>
  );
}

export function LandingFooter() {
  return (
      <footer className={styles.footer} id="footer">
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <div className={styles.footerSupport}><h3>طرح‌های حمایتی</h3><Link href="/benefits#food-credit">ثبت‌نام کالابرگ</Link><Link href="/organization">اعتبارات سازمانی</Link><Link href="/benefits#food-credit">کارت‌های معیشتی</Link><Link href="/impact">گزارش شفافیت مالی</Link></div>
          <div><h3>همکاری با حنا</h3><Link href="/seller/register">ثبت فروشگاه جدید</Link><Link href="/seller">پنل فروشندگان</Link><Link href="/courier-partners">شرایط همکاری پیک‌ها</Link><Link href="/careers">فرصت‌های شغلی</Link></div>
          <div><h3>دسترسی سریع</h3><Link href="/faq">سوالات متداول</Link><Link href="/terms">قوانین و مقررات</Link><Link href="/about">درباره حنا</Link><Link href="/support">تماس با پشتیبانی</Link></div>
          <div className={styles.footerBrand}><Image src="/hana-logo.png" alt="حنا" width={220} height={124} unoptimized /><p dir="rtl">حنا اولین بازارگاه هوشمند اجتماعی برای خریدهای روزمره در ایران است که اولویت خود را بر توسعه عادلانه و حمایت اجتماعی قرار داده است.</p></div>
        </div>
        <div className={`${styles.container} ${styles.footerBottom}`}><span>حنا با هدف برقراری عدالت اجتماعی توسعه داده شده است. کلیه حقوق برای حنا محفوظ است.</span><div aria-label="شبکه‌های اجتماعی"><Link href="/social#instagram" aria-label="اینستاگرام حنا"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.8" r=".8" fill="currentColor"/></svg></Link><Link href="/social#twitter" aria-label="توییتر حنا"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 3H22l-6.8 7.8L23.2 21h-6.3L12 14.6 6.4 21H3.2l7.3-8.4L2.8 3h6.4l4.5 5.9L18.9 3Zm-1.1 16h1.7L8.2 4.9H6.4L17.8 19Z"/></svg></Link><Link href="/social#linkedin" aria-label="لینکدین حنا"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.2 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.6 9h3.2v11H3.6V9Zm5.3 0H12v1.5h.1a3.6 3.6 0 0 1 3.3-1.8c3.5 0 4.1 2.3 4.1 5.2V20h-3.3v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V20H8.9V9Z"/></svg></Link></div></div>
      </footer>
  );
}
