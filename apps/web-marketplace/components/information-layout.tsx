import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { InformationFooter } from "./information-pages";

const navigation = [
  ["نیازهای روزمره", "/products"],
  ["طرح‌های ویژه", "/programs"],
  ["کالابرگ / اعتبارها", "/programs"],
  ["پیشنهادها", "/products"],
];

export function InformationHeader() {
  return <header className="info-header" dir="rtl"><div className="info-header__inner">
    <Link href="/" className="info-header__brand" aria-label="صفحه اصلی حنا"><Image src="/hana-logo.png" alt="حنا" width={147} height={58} priority/></Link>
    <nav className="info-header__nav" aria-label="ناوبری اصلی">{navigation.map(([label,href],index)=><Link className={index===0?"is-current":""} key={label} href={href}>{label}</Link>)}</nav>
    <form className="info-header__search" action="/products"><input name="search" aria-label="جست‌وجو" placeholder="جست‌وجوی کالاها، خدمات و نیازهای روزمره..."/><button aria-label="جست‌وجو" type="submit">⌕</button></form>
    <div className="info-header__actions"><Link className="info-header__cart" href="/products"><span>۰</span> سبد خرید</Link><Link className="info-header__account" href="/auth">حساب کاربری</Link></div>
  </div></header>;
}

export function InformationLayout({ children }: { children: ReactNode }) {
  return <div className="info-site" dir="rtl"><InformationHeader/><main className="info-main">{children}</main><InformationFooter/></div>;
}
