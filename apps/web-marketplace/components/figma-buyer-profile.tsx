"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./figma-buyer-profile.module.css";
import accountStyles from "./figma-buyer-account.module.css";
import { BuyerAccountNav } from "./buyer-account-nav";
export function FigmaBuyerProfile(){
 const router=useRouter();
 return <main className={accountStyles.page + " " + styles.pageSurface} dir="rtl" data-testid="preview-profile"><div className={accountStyles.layout}>
  <BuyerAccountNav active="account" />
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