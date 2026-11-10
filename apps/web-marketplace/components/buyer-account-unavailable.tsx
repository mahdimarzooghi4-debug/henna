import Link from "next/link";
import { BuyerAccountNav } from "./buyer-account-nav";
import styles from "./figma-buyer-account.module.css";
export function BuyerAccountUnavailable({kind}:{kind:"payments"|"settings"}){
 const payments=kind==="payments";
 return <main className={styles.page} dir="rtl"><div className={styles.layout}><BuyerAccountNav active={kind}/><section className={styles.content}><article className={styles.summary}><h1>{payments?"روش‌های پرداخت":"تنظیمات"}</h1><p>نسخه آزمایشی حساب کاربری</p></article><article className={styles.infoCard}><h2>{payments?"روش پرداخت ثبت‌شده‌ای در نسخه آزمایشی وجود ندارد":"مدیریت حساب کاربری"}</h2><p>{payments?"ثبت و مدیریت اطلاعات پرداخت واقعی در این محیط فعال نیست.":"تغییر تنظیمات واقعی حساب در این محیط فعال نیست. برای مشاهده یا ویرایش نمایشی اطلاعات حساب از لینک زیر استفاده کنید."}</p><div className={styles.infoActions}><Link href={payments?"/support":"/buyer/profile?mode=preview"} className={styles.edit}>{payments?"راهنمای پشتیبانی":"ویرایش اطلاعات حساب"}</Link></div></article></section></div></main>;
}
