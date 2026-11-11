import Image from "next/image";
import Link from "next/link";
import styles from "./henna-homepage.module.css";
import { LandingCartCount } from "./landing-demo-cart";
import { catalogCollectionHref } from "../lib/buyer-catalog-collections";

export function LandingHeader({ referencePage = false }: { referencePage?: boolean }) {
  return (
    <div className={referencePage ? `${styles.chrome} ${styles.referenceChrome}` : styles.chrome}>
      <div className={styles.announcement}>🎉 طرح جدید کالابرگ حنا فعال شد؛ خریدی هوشمندانه با بیشترین حمایت اجتماعی</div>
      <header className={styles.header}>
        <div className={styles.headerTop} data-testid="landing-header-top">
          <div className={styles.actions}>
            <Link className={styles.cart} href="/buyer/cart?mode=preview"><span className={styles.cartCount}><LandingCartCount /></span> سبد خرید <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 4h2l2.2 11h10.7L20 8H6"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></svg></Link>
            <Link className={styles.login} href="/auth">{referencePage ? "ورود یا حساب کاربری" : "حساب کاربری"} <svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 21c.5-4 2.8-6 7-6s6.5 2 7 6"/></svg></Link>
            <span className={styles.divider} />
            <Link className={styles.sellerLink} href="/seller/register">ثبت‌نام فروشگاه‌ها</Link>
          </div>
          <form className={styles.search} action="/products">
            <input name="search" placeholder={referencePage ? "جست‌وجوی کالاها و نیازهای روزمره محله..." : "جست‌وجوی کالاها و نیازهای روزمره..."} aria-label="جست‌وجو در کالاها" />
            <button aria-label="جست‌وجو"><svg className={styles.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg></button>
          </form>
          <Link href="/" className={styles.brand} aria-label="حنا، صفحه اصلی">
            <Image src="/hana-logo.png" alt="حنا" width={220} height={124} unoptimized priority />
          </Link>
        </div>
        <nav className={styles.nav} aria-label="دسته‌بندی اصلی">
          {referencePage ? (
            <>
              <Link href={catalogCollectionHref("golden")}>پیشنهادهای طلایی</Link>
              <Link href={catalogCollectionHref("kalabarg")}>کالابرگ الکترونیکی</Link>
              <Link href={catalogCollectionHref("henna")}>طرح‌های ویژه حنا</Link>
              <Link href="/products?categoryName=%D9%84%D8%A8%D9%86%DB%8C%D8%A7%D8%AA%20%D9%88%20%D8%AE%D9%88%D8%A7%D8%B1%D8%A8%D8%A7%D8%B1">لبنیات و خواربار</Link>
              <Link href="/products?categoryName=%D9%86%D8%A7%D9%86%20%D9%88%20%D9%86%DB%8C%D8%A7%D8%B2%D9%85%D9%86%D8%AF%DB%8C%E2%80%8C%D9%87%D8%A7">نان و نیازمندی‌ها</Link>
              <Link href="/products">همه دسته‌ها</Link>
            </>
          ) : (
            <>
              <Link href={catalogCollectionHref("golden")}>تخفیف‌های طلایی</Link>
              <Link href={catalogCollectionHref("kalabarg")}>کالابرگ الکترونیکی</Link>
              <Link href={catalogCollectionHref("henna")}>طرح‌های ویژه حنا</Link>
              <Link href="/products">همه دسته‌ها</Link>
            </>
          )}
        </nav>
      </header>
    </div>
  );
}

export function LandingFooter({ accountPage = false }: { accountPage?: boolean } = {}) {
  return (
    <div className={styles.chrome}>
      <footer className={accountPage ? `${styles.footer} ${styles.accountFooter}` : styles.footer} id="footer">
        <div className={`${styles.container} ${styles.footerGrid}`} data-testid="landing-footer-top">
          <div className={styles.footerContact} data-testid="footer-contact">
            <h3>ارتباط با ما</h3>
            <address>
              <div className={styles.footerContactRow}>
                <span className={styles.footerContactIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg></span>
                <div className={styles.footerContactText}><span>نشانی</span><p>تهران، خیابان انقلاب، خیابان رازی، کوچه شهبازیان، پلاک ۲۲</p></div>
              </div>
              <div className={styles.footerContactRow}>
                <span className={styles.footerContactIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M22 16.5v3a2 2 0 0 1-2.2 2 18.7 18.7 0 0 1-8.1-2.9 18.5 18.5 0 0 1-5.7-5.7 18.7 18.7 0 0 1-2.9-8.1A2 2 0 0 1 5.1 2.6h3a2 2 0 0 1 2 1.7c.13 1 .36 2 .7 2.9a2 2 0 0 1-.45 2.1L9.1 10.6a15 15 0 0 0 4.3 4.3l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.9.57 2.9.7a2 2 0 0 1 1.7 1.95Z"/></svg></span>
                <div className={styles.footerContactText}><span>تلفن</span><a href="tel:+982166485374" dir="ltr">۰۲۱-۶۶۴۸۵۳۷۴</a></div>
              </div>
              <div className={styles.footerContactRow}>
                <span className={styles.footerContactIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3.5 6 8.5 6.5L20.5 6"/></svg></span>
                <div className={styles.footerContactText}><span>ایمیل</span><a href="mailto:info@hennamarket.ir" dir="ltr">info@hennamarket.ir</a></div>
              </div>
            </address>
          </div>
          <div><h3>همکاری با حنا</h3><Link href="/seller/register">ثبت فروشگاه جدید</Link><Link href="/seller">پنل فروشندگان</Link></div>
          <div><h3>دسترسی سریع</h3><Link href="/faq">سوالات متداول</Link><Link href="/terms">قوانین و مقررات</Link><Link href="/about">درباره حنا</Link><Link href="/support">تماس با پشتیبانی</Link></div>
          <div className={styles.footerBrand} data-testid="footer-brand">
            <Link href="/" aria-label="حنا، بازگشت به صفحه اصلی"><Image src="/hana-logo.png" alt="حنا" width={220} height={124} unoptimized /></Link>
            <p dir="rtl">حنا اولین بازارگاه هوشمند اجتماعی برای خریدهای روزمره در ایران است که اولویت خود را بر توسعه عادلانه و حمایت اجتماعی قرار داده است.</p>
          </div>
        </div>
        <div className={`${styles.container} ${styles.footerBottom}`} data-testid="landing-footer-bottom"><span>حنا با هدف برقراری عدالت اجتماعی توسعه داده شده است. کلیه حقوق برای حنا محفوظ است.</span><div aria-label="شبکه‌های اجتماعی"><Link href="/social#instagram" aria-label="اینستاگرام حنا"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.8" r=".8" fill="currentColor"/></svg></Link><Link href="/social#twitter" aria-label="توییتر حنا"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 3H22l-6.8 7.8L23.2 21h-6.3L12 14.6 6.4 21H3.2l7.3-8.4L2.8 3h6.4l4.5 5.9L18.9 3Zm-1.1 16h1.7L8.2 4.9H6.4L17.8 19Z"/></svg></Link><Link href="/social#linkedin" aria-label="لینکدین حنا"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.2 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.6 9h3.2v11H3.6V9Zm5.3 0H12v1.5h.1a3.6 3.6 0 0 1 3.3-1.8c3.5 0 4.1 2.3 4.1 5.2V20h-3.3v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V20H8.9V9Z"/></svg></Link></div></div>
      </footer>
    </div>
  );
}
