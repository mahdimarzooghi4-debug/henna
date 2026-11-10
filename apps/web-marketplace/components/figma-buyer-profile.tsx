"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./figma-buyer-profile.module.css";
const nav=[["اطلاعات حساب","/buyer/account?mode=preview"],["آدرس‌های من","/account/addresses"],["سفارش‌های من","/buyer/orders?mode=preview"],["روش‌های پرداخت","#payments"],["اعتبارهای من","/benefits#food-credit"],["طرح‌های فعال","/benefits#special-plans"],["مشارکت‌های اجتماعی","/social"],["پشتیبانی","/support"],["تنظیمات","#settings"]];
export function FigmaBuyerProfile(){
 const router=useRouter();
 return <main className={styles.page} dir="rtl" data-testid="preview-profile"><div className={styles.layout}>
  <aside className={styles.navCard} aria-label="بخش‌های حساب کاربری">{nav.map(([label,href], index)=><Link key={label} href={href} aria-current={index===0?"page":undefined}><span>{label}</span><svg className={styles.navChevron} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>)}</aside>
  <section className={styles.content}><div className={styles.heading}><h1>تکمیل اطلاعات حساب</h1><p>مشخصات کاربر را برای تکمیل حساب خود ثبت کنید.</p></div>
   <form className={styles.form} onSubmit={event=>{event.preventDefault();router.push("/buyer/account?mode=preview");}}>
    <h2>مشخصات کاربر</h2><label>نام و نام خانوادگی<input defaultValue="کاربر نمونه"/></label>
    <label>شماره موبایل<input defaultValue="۰۹۱۲۳۴۵۶۷۸۹" readOnly/><small>غیرقابل تغییر</small></label>
    <label>کد ملی (اختیاری جهت فعال‌سازی اعتبارات حمایتی)<input placeholder="نمونه: ۰۰۱۲۳۴۵۶۷۸" inputMode="numeric"/></label>
    <label>تاریخ تولد (اختیاری)<input placeholder="روز / ماه / سال"/></label>
    <p className={styles.notice}>نسخه نمایشی؛ اطلاعات این فرم در حساب واقعی ذخیره نمی‌شود.</p>
    <div className={styles.actions}><button type="submit">ذخیره و ثبت نهایی اطلاعات</button><Link href="/buyer/account?mode=preview">انصراف</Link></div>
   </form>
  </section>

 </div></main>;
}