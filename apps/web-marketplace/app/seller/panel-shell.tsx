"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import styles from "./orders/orders-review.module.css";
const assets = "/seller-panel/";
const menu = ["داشبورد", "سفارش‌ها", "کالاها", "کتابخانه تصاویر", "موجودی و دسترس‌پذیری", "قیمت‌گذاری", "طرح‌ها و اعتبارها", "ارسال و محدوده فعالیت", "تسویه‌حساب‌ها", "گزارش‌ها", "اعلان‌ها", "اطلاعات کسب‌وکار", "پشتیبانی", "تنظیمات"];
const icons = ["imgIcon", "imgIcon1", "imgIcon2", "imgIcon3", "imgIcon4", "imgIcon5", "imgIcon6", "imgIcon7", "imgIcon8", "imgIcon9", "imgBell", "imgIcon10", "imgIcon11", "imgIcon12"];

export function SellerPanelShell({ active, children }: {active: string; children: ReactNode}) {
 const sections = ["dashboard", "orders", "products", "images", "inventory", "pricing", "programs", "delivery", "settlements", "reports", "notifications", "business", "support", "settings"];
 const activeIndex = sections.indexOf(active === "listing" ? "products" : active === "order-detail" ? "orders" : active);
 const activeAssetBase = active === "dashboard" ? "/seller-panel/dashboard/" : assets;
 const [notice,setNotice] = useState("");
 const [leaving,setLeaving] = useState(false);
 async function logout() {
  if(leaving) return;
  setLeaving(true); setNotice("");
  try {
   const response = await fetch("/api/auth/session", {method:"DELETE",credentials:"same-origin",cache:"no-store"});
   if(response.ok || response.status === 401) { window.location.assign("/auth"); return; }
   setNotice("خروج تأیید نشد؛ دوباره تلاش کنید.");
  } catch { setNotice("ارتباط برقرار نشد؛ دوباره برای خروج تلاش کنید."); }
  setLeaving(false);
 }
function Icon({ name }: { name: string }) { const base = activeAssetBase; return <span aria-hidden="true" className={styles.navIcon} style={{maskImage:`url(${base}${name}.svg)`,WebkitMaskImage:`url(${base}${name}.svg)`}} />; }
 return <div className={styles.panel} dir="rtl">
    <header className={styles.header}>
      <Link href="/" aria-label="صفحه اصلی حنا"><img src={`${assets}imgLogo.png`} width={110} height={44} alt="حنا" /></Link>
      <span className={styles.caption}>پنل فروشندگان</span>
      <span className={styles.divider} />
      <button className={styles.store} onClick={() => setNotice("کسب‌وکار نمونه برای بررسی ظاهر پنل نمایش داده می‌شود.")}><Icon name="imgStore" /> کسب‌وکار نمونه <Icon name="imgChevronDown" /></button>
      <div className={styles.account}><button className={styles.logout} onClick={logout} disabled={leaving}>{leaving ? "در حال خروج…" : "خروج از حساب کاربری"}</button><button className={styles.bell} aria-label="اعلان‌ها" onClick={() => setNotice("اعلان جدیدی ندارید.")}><Icon name="imgBell" /></button><span className={styles.divider} /><div><strong>مدیریت پنل</strong><small>فروشنده / کسب‌وکار نمونه</small></div><span className={styles.avatar}>م‌ف</span></div>
    </header>
    <div className={styles.body}>
      <aside className={styles.sidebar}><nav aria-label="ناوبری پنل فروشنده">{menu.map((label, i) => <Link key={label} href={i===0 ? "/seller/dashboard" : i===1 ? "/seller/orders" : `/seller/panel/${sections[i]}`} className={i===activeIndex?styles.active:""} aria-current={i===activeIndex?"page":undefined}><Icon name={icons[i]}/><span>{label}</span></Link>)}</nav></aside>
<main className={styles.content}>{notice && <div className={styles.notice} role="status">{notice}<button aria-label="بستن پیام" onClick={() => setNotice("")}>×</button></div>}{children}</main></div></div>;
}
