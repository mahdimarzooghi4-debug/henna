import Image from "next/image";
import Link from "next/link";
import styles from "./marketplace-chrome.module.css";
import { LandingCartCount } from "./landing-demo-cart";

// Keep the catalog chrome in sync with the owner's approved homepage navigation.
const navItems = [
  ["همه دسته‌ها", "/products"],
  ["طرح‌های ویژه حنا", "/benefits#special-plans"],
  ["کالابرگ الکترونیکی", "/benefits#food-credit"],
  ["تخفیف‌های طلایی", "/#offers"],
] as const;

const footerColumns = [
  {
    title: "دسترسی سریع",
    links: [
      ["سوالات متداول", "/faq"],
      ["قوانین و مقررات", "/terms"],
      ["درباره حنا", "/about"],
      ["تماس با پشتیبانی", "/support"],
    ],
  },
  {
    title: "همکاری با حنا",
    links: [
      ["ثبت فروشگاه جدید", "/seller/register"],
      ["پنل فروشندگان", "/seller"],
      ["شرایط همکاری پیک‌ها", "/courier-partners"],
      ["فرصت‌های شغلی", "/careers"],
    ],
  },
  {
    title: "طرح‌های حمایتی",
    links: [
      ["ثبت‌نام کالابرگ", "/benefits#food-credit"],
      ["اعتبارات سازمانی", "/benefits"],
      ["کارت‌های معیشتی", "/benefits"],
      ["گزارش شفافیت مالی", "/impact"],
    ],
  },
] as const;

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 4h2l2.1 11.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 8H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.3" fill="currentColor" />
      <circle cx="18" cy="20" r="1.3" fill="currentColor" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function MarketplaceChrome({ footerOnly = false, initialSearch = "" }: { footerOnly?: boolean; initialSearch?: string }) {
  if (footerOnly) {
    return (
      <footer className={styles.footer} dir="rtl" data-testid="marketplace-footer">
        <div className={styles.footerInner} data-testid="marketplace-footer-top">
          <div className={styles.footerBrand}>
            <Link href="/" aria-label="حنا، صفحه اصلی">
              <Image src="/hana-logo.png" alt="حنا" width={145} height={58} unoptimized />
            </Link>
            <p>حنا اولین بازارگاه هوشمند اجتماعی برای خریدهای روزمره در ایران است که اولویت خود را بر توسعه عادلانه و حمایت اجتماعی قرار داده است.</p>
          </div>
          {footerColumns.map((column) => (
            <div className={styles.footerColumn} key={column.title}>
              <h2>{column.title}</h2>
              {column.links.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
            </div>
          ))}
        </div>
        <div className={styles.footerBottom} data-testid="marketplace-footer-bottom">
          <div className={styles.socialMedia} aria-label="شبکه‌های اجتماعی حنا">
            <span aria-label="اینستاگرام" title="اینستاگرام">◎</span>
            <span aria-label="توییتر" title="توییتر">𝕏</span>
            <span aria-label="لینکدین" title="لینکدین">in</span>
          </div>
          <p>حنا با هدف برقراری عدالت اجتماعی توسعه داده شده است.<br />کلیه حقوق برای حنا محفوظ است.</p>
        </div>
      </footer>
    );
  }

  return (
    <>
      <div className={styles.announcement} dir="rtl" data-testid="marketplace-announcement">
        بازارگاه حنا؛ کالاها و خدمات در یک تجربه یکپارچه
      </div>
      <header className={styles.header} dir="rtl">
        <div className={styles.headerTop} data-testid="marketplace-header-top">
          <div className={styles.actions}>
            <Link className={styles.cart} href="/buyer/cart?mode=preview">
              <span aria-hidden="true"><LandingCartCount /></span>
              <strong>سبد خرید</strong>
              <i><CartIcon /></i>
            </Link>
            <Link className={styles.login} href="/auth">
              <strong>ورود یا ثبت‌نام</strong>
              <i><UserIcon /></i>
            </Link>
            <span className={styles.divider} aria-hidden="true" />
            <Link className={styles.seller} href="/seller/register">ثبت‌نام فروشگاه‌ها</Link>
          </div>
          <form className={styles.search} action="/products" role="search">
            <input name="search" type="search" defaultValue={initialSearch} placeholder="جست‌وجوی کالاها، خدمات و نیازهای روزمره..." aria-label="جست‌وجو در کالاها و خدمات" />
            <button type="submit" aria-label="جست‌وجو">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></svg>
            </button>
          </form>
          <Link href="/" className={styles.brand} aria-label="حنا، صفحه اصلی">
            <Image src="/hana-logo.png" alt="حنا" width={145} height={58} unoptimized priority />
          </Link>
        </div>
        <nav className={styles.nav} aria-label="دسته‌بندی اصلی" data-testid="marketplace-category-nav">
          {navItems.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
        </nav>
      </header>
    </>
  );
}
