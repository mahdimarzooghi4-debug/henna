"use client";
import Link from "next/link";
import { useState } from "react";
import styles from "./figma-buyer-account.module.css";
const nav=[["اطلاعات حساب","#account-info"],["آدرس‌های من","/account/addresses"],["سفارش‌های من","/buyer/orders?mode=preview"],["روش‌های پرداخت","#payments"],["اعتبارهای من","/benefits#food-credit"],["طرح‌های فعال","/benefits#special-plans"],["مشارکت‌های اجتماعی","/social"],["پشتیبانی","/support"],["تنظیمات","#settings"]];
export function FigmaBuyerAccount(){
 const [notice,setNotice]=useState("");
 return <main className={styles.page} dir="rtl"><div className={styles.layout}>
  <section className={styles.content}>
   <article className={styles.legalCard}><div><h2>خرید حقوقی</h2><p>برای خرید به نام شرکت و دریافت فاکتور رسمی، اطلاعات شرکت را ثبت کنید.</p><strong>اطلاعات شرکت ثبت شده است</strong><p>این اطلاعات به این حساب کاربری شخص حقیقی متصل است و برای خریدهای حقوقی و دریافت فاکتور رسمی استفاده می‌شود.</p></div><div className={styles.legalActions}><button type="button" onClick={()=>setNotice("اطلاعات شرکت نمونه ثبت شده است.")}>مشاهده اطلاعات</button><button type="button" onClick={()=>setNotice("ویرایش اطلاعات شرکت در نسخه نمونه فعال نیست.")}>ویرایش اطلاعات</button></div></article>
   <section className={styles.summary} id="account-info"><div className={styles.summaryCopy}><h1>حساب من</h1><p>همه بخش‌های حساب، سفارش‌ها، آدرس‌ها، روش‌های پرداخت و اعتبارهای شما در یک صفحه جمع‌وجور نمایش داده می‌شود.</p></div>
    <article className={styles.infoCard}><h2>اطلاعات حساب</h2><div className={styles.divider}/>
     <div className={styles.fields}><div><span>نام و نام خانوادگی</span><strong>کاربر نمونه</strong></div><div><span>شماره تلفن همراه</span><strong>شماره تماس نمونه</strong></div><div><span>ایمیل</span><strong>ایمیل نمونه</strong></div></div>
     <button type="button" className={styles.save} onClick={()=>setNotice("ویرایش اطلاعات حساب در نسخه نمونه فعال نیست.")}>ویرایش اطلاعات حساب</button>
    </article>
   </section>
   </section>
   <aside className={styles.navCard} aria-label="بخش‌های حساب کاربری">{nav.map(([label,href])=><Link key={label} href={href}>{label}<span>‹</span></Link>)}</aside>
  </div>{notice&&<p className={styles.notice} role="status">{notice}</p>}</main>;
}