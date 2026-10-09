import Image from "next/image";
import Link from "next/link";

type SiteHeaderProps = {
  backHref: string;
  backLabel: string;
  commerce?: boolean;
};

export function SiteHeader({ backHref, backLabel, commerce = false }: SiteHeaderProps) {
  return (
    <header className={commerce ? "site-header site-header--commerce" : "site-header"}>
      <div className="site-header__inner">
        <Link href="/" aria-label="حنا، صفحه اصلی" className="site-header__brand">
          <Image src="/hana-logo.png" alt="حنا" width={220} height={72} priority />
        </Link>
        <nav className="site-header__links" aria-label="مسیرهای خرید">
          <Link href={backHref} className="site-header__back">{backLabel}</Link>
          {backHref !== "/cart" && <Link href="/cart" className="site-header__back">سبد خرید</Link>}
          <Link href="/wallet" className="site-header__back">
            کیف پول
          </Link>
          <Link href="/account" className="site-header__back">
            اعلان‌ها و پشتیبانی
          </Link>
        </nav>
      </div>
    </header>
  );
}
