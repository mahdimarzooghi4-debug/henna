"use client";
import Link from "next/link";
import { useState } from "react";
import styles from "./figma-buyer-profile.module.css";
const nav=[["اطلاعات حساب","/buyer/account?mode=preview"],["آدرس‌های من","/account/addresses"],["سفارش‌های من","/buyer/orders?mode=preview"],["روش‌های پرداخت","#payments"],["اعتبارهای من","/benefits#food-credit"],["طرح‌های فعال","/benefits#special-plans"],["مشارکت‌های اجتماعی","/social"],["پشتیبانی","/support"],["تنظیمات","#settings"]];
export function FigmaBuyerProfile(){
 const [notice,setNotice]=useState("");
 return <main className={styles.page} dir="rtl"><div className={styles.layout}>
  <section className={styles.content}><div className={styles.heading}><h1>تکمیل اطلاعات حساب</h1><p>مشخصات کاربر را برای تکمیل حساب خود ثبت کنید.</p></div>
   <form className={styles.form} onSubmit={event=>{event.preventDefault();setNotice("اطلاعات نمونه ذخیره شد.");}}>
    <h2>مشخصات کاربر</h2><label>نام و نام خانوادگی<input defaultValue="کاربر نمونه"/></label>
    <label>شماره موبایل<input defaultValue="۰۹۱۲۳۴۵۶۷۸۹" readOnly/><small>غیرقابل تغییر</small></label>
    <label>کد ملی (اختیاری جهت فعال‌سازی اعتبارات حمایتی)<input placeholder="نمونه: ۰۰۱۲۳۴۵۶۷۸" inputMode="numeric"/></label>
    <label>تاریخ تولد (اختیاری)<input placeholder="روز / ماه / سال"/></label>
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.actions}><button type="submit">ذخیره و ثبت نهایی اطلاعات</button><Link href="/buyer/account?mode=preview">انصراف</Link></div>
   </form>
  </section>
  <aside className={styles.navCard}>{nav.map(([label,href])=><Link key={label} href={href}>{label}<span>‹</span></Link>)}</aside>
 </div></main>;
}