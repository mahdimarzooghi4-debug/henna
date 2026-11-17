import Image from "next/image";
import Link from "next/link";
import styles from "./marketplace-chrome.module.css";
import { LandingCartCount } from "./landing-demo-cart";
import { LandingFooter } from "./landing-chrome";
import { catalogCollectionHref, type CatalogCollectionSelection } from "../lib/buyer-catalog-collections";

// Keep the catalog chrome in sync with the owner's approved homepage navigation.
const navItems = [
  ["همه دسته‌ها", "/products"],
  ["طرح‌های ویژه حنا", catalogCollectionHref("henna")],
  ["کالابرگ الکترونیکی", catalogCollectionHref("kalabarg")],
  ["تخفیف‌های طلایی", catalogCollectionHref("golden")],
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

export function MarketplaceChrome({ footerOnly = false, initialSearch = "", basket = false, activeCollection = null }: {
  footerOnly?: boolean; initialSearch?: string; basket?: boolean;
  activeCollection?: CatalogCollectionSelection;
}) {
  // All public catalog and basket flows share the homepage footer.
  if (footerOnly) return <LandingFooter />;

  return (
    <>
      {!basket && <div className={styles.announcement} dir="rtl" data-testid="marketplace-announcement">
        بازارگاه حنا؛ کالاهای موردنیاز شما در یک تجربه یکپارچه
      </div>}
      <header className={basket ? `${styles.header} ${styles.basketHeader}` : styles.header} dir="rtl">
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
            <input name="search" type="search" defaultValue={initialSearch} placeholder="جست‌وجوی کالاها و نیازهای روزمره..." aria-label="جست‌وجو در کالاها" />
            <button type="submit" aria-label="جست‌وجو">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></svg>
            </button>
          </form>
          <Link href="/" className={styles.brand} aria-label="حنا، صفحه اصلی">
            <Image src="/hana-logo.png" alt="حنا" width={145} height={58} unoptimized priority />
          </Link>
        </div>
        <nav className={styles.nav} aria-label="دسته‌بندی اصلی" data-testid="marketplace-category-nav">
          {navItems.map(([label, href]) => <Link key={label} href={href} aria-current={activeCollection !== null && activeCollection !== "invalid" && href === catalogCollectionHref(activeCollection) ? "page" : undefined}>{label}</Link>)}
        </nav>
      </header>
    </>
  );
}
