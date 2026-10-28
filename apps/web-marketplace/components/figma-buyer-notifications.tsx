"use client";
import { useState } from "react";
import styles from "./figma-buyer-notifications.module.css";
const notifications=[
 {time:"امروز، ۱۰:۴۵",category:"طرح‌ها",title:"اعتبار طرح حمایت معیشتی اسفندماه شارژ شد",text:"در صورت فعال شدن اعتبار برای حساب شما، جزئیات و شرایط استفاده در بخش اعتبارها نمایش داده می‌شود.",unread:true},
 {time:"دیروز، ۱۸:۲۰",category:"سفارش",title:"سفارش شما تحویل پیک داده شد",text:"وضعیت سفارش نمونه به‌روزرسانی شد. برای مشاهده جزئیات، پیگیری سفارش را باز کنید."},
 {time:"۲ روز پیش",category:"اعتبارها",title:"موفقیت در استعلام کد ملی حمایتی",text:"اطلاعات حساب شما به‌روزرسانی شد. وضعیت بررسی در همین بخش اعلام می‌شود."},
 {time:"۳ روز پیش",category:"حساب",title:"ورود جدید به حساب کاربری حنا",text:"یک ورود جدید به حساب کاربری شما ثبت شده است. در صورتی که این ورود توسط شما انجام نشده، لطفا با پشتیبانی تماس بگیرید."},
 {time:"۱ هفته پیش",category:"اطلاع‌رسانی عمومی",title:"اضافه شدن قابلیت مقایسه هوشمند در شعاع بیشتر",text:"امکان مقایسه قیمت، موجودی و فاصله فروشگاه‌های نزدیک برای سبد شما فراهم است."},
];
const filters=["همه اعلان‌ها","سفارش","حساب","طرح‌ها","اعتبارها","اطلاع‌رسانی عمومی"];
const accountLinks=[
 ["اطلاعات حساب","/account/profile"],["آدرس‌های من","/account/addresses"],["سفارش‌های من","/account/orders"],
 ["روش‌های پرداخت","/account/payments"],["اعتبارهای من","/benefits"],["طرح‌های فعال","/benefits"],
 ["مشارکت‌های اجتماعی","/social"],["اعلان‌ها","/buyer/notifications"],["پشتیبانی","/support"],["تنظیمات","/account/settings"],
];
export function FigmaBuyerNotifications(){
 const [filter,setFilter]=useState(filters[0]);
 const visible=notifications.filter(n=>filter===filters[0]||n.category===filter);
 return <main className={styles.page} dir="rtl"><div className={styles.layout}>
  <div className={styles.content}>
   <header className={styles.heading}><div className={styles.summaryCopy}><h1>اعلان‌های کاربری</h1><p>پیگیری پیام‌های سفارش‌ها، تغییرات امنیتی حساب کاربری، زمان‌بندی طرح‌های ویژه و گزارش‌های شفاف حمایت اجتماعی حنا.</p></div><span className={styles.unread}>۱ اعلان خوانده نشده</span></header>
   <nav className={styles.filters} aria-label="دسته‌بندی اعلان‌ها">{filters.map(item=><button key={item} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}</button>)}</nav>
   <section className={styles.list} aria-label="اعلان‌های اخیر">{visible.map(item=><article className={styles.item} key={item.title}><div className={styles.copy}><div className={styles.cardHeading}><h2>{item.title}</h2><span className={styles.category}>{item.category}</span></div>{item.text&&<p>{item.text}</p>}</div><div className={styles.meta}>{item.unread&&<b>جدید</b>}<time>{item.time}</time></div></article>)}</section>
  </div>
  <aside className={styles.sidebar} aria-label="منوی حساب کاربری">{accountLinks.map(([label,href])=><a key={label} href={href} aria-current={label==="اعلان‌ها"?"page":undefined}>{label}</a>)}</aside>
 </div></main>;
}