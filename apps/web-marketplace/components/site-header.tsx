import Image from "next/image";
import Link from "next/link";

type SiteHeaderProps = {
  backHref: string;
  backLabel: string;
};

export function SiteHeader({ backHref, backLabel }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" aria-label="حنا، صفحه اصلی" className="site-header__brand">
          <Image src="/hana-logo.png" alt="حنا" width={220} height={72} priority />
        </Link>
        <Link href={backHref} className="site-header__back">
          {backLabel}
        </Link>
      </div>
    </header>
  );
}
