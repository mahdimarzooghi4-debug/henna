"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buyerDemoCartCount, buyerDemoCartEventName, readBuyerDemoCart } from "../lib/buyer-demo-cart";

type SiteHeaderProps = { backHref: string; backLabel: string };

export function SiteHeader({ backHref, backLabel }: SiteHeaderProps) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(buyerDemoCartCount(readBuyerDemoCart()));
    sync();
    window.addEventListener(buyerDemoCartEventName(), sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(buyerDemoCartEventName(), sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return <>
    <div className="market-announcement">بازارگاه حنا؛ کالاها و خدمات در یک تجربه یکپارچه</div>
    <header className="site-header site-header--market" dir="rtl">
      <div className="site-header__inner">
        <div className="site-header__actions">
          <Link href="/basket" className="site-header__cart">سبد خرید <span>{new Intl.NumberFormat("fa-IR").format(count)}</span></Link>
          <Link href="/auth" className="site-header__account">ورود یا ثبت‌نام</Link>
          <Link href="/seller/register" className="site-header__seller">ثبت‌نام فروشگاه‌ها</Link>
        </div>
        <form action="/products" className="site-header__search">
          <input name="search" placeholder="جست‌وجوی کالاها، خدمات و نیازهای روزمره..." aria-label="جست‌وجو" />
          <button type="submit" aria-label="جست‌وجو">⌕</button>
        </form>
        <Link href="/" aria-label="حنا، صفحه اصلی" className="site-header__brand">
          <Image src="/hana-logo.png" alt="حنا" width={147} height={58} priority />
        </Link>
      </div>
      <nav className="site-header__nav" aria-label="دسته‌بندی اصلی">
        <Link href="/products">نیازهای روزمره</Link><Link href="/seller">فروشندگان / ارائه‌دهندگان</Link>
        <Link href="/products">کالاها و خدمات</Link><Link href="/products">همه دسته‌ها</Link>
        <Link href="/products">دسته‌بندی‌های منتخب</Link><Link href="/programs">طرح‌های ویژه</Link>
        <Link href="/programs">کالابرگ / اعتبارها</Link><Link href="/#offers">پیشنهادها</Link>
        <Link href={backHref} className="site-header__back">{backLabel}</Link>
      </nav>
    </header>
  </>;
}

export function SiteFooter() {
  return <footer className="market-footer" dir="rtl">
    <div className="market-footer__grid">
      <div><h2>طرح‌های حمایتی</h2><Link href="/programs">ثبت‌نام کالابرگ</Link><Link href="/programs">اعتبارات سازمانی</Link><Link href="/programs">کارت‌های معیشتی</Link><Link href="/programs">گزارش شفافیت مالی</Link></div>
      <div><h2>همکاری با حنا</h2><Link href="/seller/register">ثبت فروشگاه جدید</Link><Link href="/seller">پنل فروشندگان</Link><Link href="/seller-guide">شرایط همکاری پیک‌ها</Link><Link href="/support">فرصت‌های شغلی</Link></div>
      <div><h2>دسترسی سریع</h2><Link href="/faq">سوالات متداول</Link><Link href="/terms">قوانین و مقررات</Link><Link href="/about">درباره حنا</Link><Link href="/support">تماس با پشتیبانی</Link></div>
      <div className="market-footer__brand"><Link href="/"><Image src="/hana-logo.png" alt="حنا" width={147} height={58} /></Link><p>حنا بازارگاه هوشمند اجتماعی برای خریدهای روزمره در ایران است که اولویت خود را بر توسعه عادلانه و حمایت اجتماعی قرار داده است.</p></div>
    </div>
    <div className="market-footer__bottom"><span>◎　♥　in</span><p>حنا با هدف برقراری عدالت اجتماعی توسعه داده شده است.<br/>کلیه حقوق برای حنا محفوظ است.</p></div>
  </footer>;
}
