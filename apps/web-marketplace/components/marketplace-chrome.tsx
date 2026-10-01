import Image from "next/image";
import Link from "next/link";
import styles from "./marketplace-chrome.module.css";

const navItems = [
  ["همه دسته‌ها", "/products"],
  ["فروشگاه‌ها", "/products"],
  ["کالاها و خدمات", "/products"],
  ["لبنیات و تخم‌مرغ", "/products"],
  ["روغن و خواربار", "/products"],
  ["دسته‌بندی‌های منتخب", "/products"],
  ["طرح‌های ویژه", "/products"],
  ["پیشنهادها", "/products"],
] as const;

export function MarketplaceChrome({ footerOnly = false, initialSearch = "" }: { footerOnly?: boolean; initialSearch?: string }) {
  if (footerOnly) {
    return (
      <footer className={styles.footer} dir="rtl">
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Link href="/" aria-label="حنا، صفحه اصلی">
              <Image src="/hana-logo.png" alt="حنا" width={180} height={100} unoptimized />
            </Link>
            <p>حنا، بازارگاه خرید روزمره با هدف پشتیبانی از فروشگاه‌های محلی و توسعه اجتماعی.</p>
          </div>
          <div><h2>دسترسی سریع</h2><Link href="/products">کالاها و خدمات</Link><Link href="/auth">ورود یا ثبت‌نام</Link><Link href="/buyer/cart">سبد خرید</Link></div>
          <div><h2>همکاری با حنا</h2><Link href="/seller/register">ثبت فروشگاه</Link><Link href="/seller">پنل فروشندگان</Link><Link href="/products">طرح‌های حمایتی</Link></div>
          <div><h2>پشتیبانی</h2><Link href="/products">سوالات متداول</Link><Link href="/products">قوانین و مقررات</Link><Link href="/auth">تماس با ما</Link></div>
        </div>
        <div className={styles.footerBottom}>© حنا — تمامی حقوق محفوظ است.</div>
      </footer>
    );
  }

  return (
    <>
      <div className={styles.announcement} dir="rtl">بازارگاه حنا؛ کالاها و خدمات در یک تجربه خرید یکپارچه</div>
      <header className={styles.header} dir="rtl">
        <div className={styles.headerTop}>
          <div className={styles.actions}>
            <Link className={styles.cart} href="/buyer/cart"><span aria-hidden="true">۰</span> سبد خرید</Link>
            <Link className={styles.login} href="/auth">ورود یا ثبت‌نام</Link>
            <span className={styles.divider} aria-hidden="true" />
            <Link className={styles.seller} href="/seller/register">ثبت‌نام فروشگاه‌ها</Link>
          </div>
          <form className={styles.search} action="/products" role="search">
            <input name="search" type="search" defaultValue={initialSearch} placeholder="جست‌وجوی کالاها و خدمات..." aria-label="جست‌وجو در کالاها و خدمات" />
            <button type="submit" aria-label="جست‌وجو"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></svg></button>
          </form>
          <Link href="/" className={styles.brand} aria-label="حنا، صفحه اصلی">
            <Image src="/hana-logo.png" alt="حنا" width={190} height={108} unoptimized priority />
          </Link>
        </div>
        <nav className={styles.nav} aria-label="دسته‌بندی اصلی">
          {navItems.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
        </nav>
      </header>
    </>
  );
}
