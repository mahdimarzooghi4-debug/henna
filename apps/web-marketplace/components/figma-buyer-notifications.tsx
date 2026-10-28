"use client";
import { useState } from "react";
import styles from "./figma-buyer-notifications.module.css";
const notifications=[
 {time:"امروز، ۱۰:۴۵",category:"طرح‌ها",title:"اعتبار طرح حمایت معیشتی اسفندماه شارژ شد",text:"در صورت فعال شدن اعتبار برای حساب شما، جزئیات و شرایط استفاده در بخش اعتبارها نمایش داده می‌شود.",unread:true},
 {time:"دیروز، ۱۸:۲۰",category:"سفارش",title:"سفارش شما تحویل پیک داده شد",text:"وضعیت سفارش نمونه به‌روزرسانی شد. برای مشاهده جزئیات، پیگیری سفارش را باز کنید."},
 {time:"۲ روز پیش",category:"اعتبارها",title:"موفقیت در استعلام کد ملی حمایتی",text:"اطلاعات حساب شما به‌روزرسانی شد. وضعیت بررسی در همین بخش اعلام می‌شود."},
 {time:"۳ روز پیش",category:"حساب",title:"ورود جدید به حساب کاربری حنا",text:""},
 {time:"۱ هفته پیش",category:"اطلاع‌رسانی عمومی",title:"اضافه شدن قابلیت مقایسه هوشمند در شعاع بیشتر",text:"امکان مقایسه قیمت، موجودی و فاصله فروشگاه‌های نزدیک برای سبد شما فراهم است."},
];
const filters=["همه اعلان‌ها","سفارش","حساب","طرح‌ها","اعتبارها","اطلاع‌رسانی عمومی"];
export function FigmaBuyerNotifications(){
 const [filter,setFilter]=useState(filters[0]);const [readAll,setReadAll]=useState(false);
 const visible=notifications.filter(n=>filter===filters[0]||n.category===filter);
 return <main className={styles.page} dir="rtl"><header className={styles.heading}><div><span className={styles.unread}>{readAll?"همه اعلان‌ها خوانده شده‌اند":"۱ اعلان خوانده نشده"}</span><h1>اعلان‌های کاربری</h1><p>پیگیری پیام‌های سفارش‌ها، تغییرات امنیتی حساب کاربری، زمان‌بندی طرح‌های ویژه و گزارش‌های شفاف حمایت اجتماعی حنا.</p></div><button type="button" onClick={()=>setReadAll(true)}>خوانده شده کردن همه</button></header>
  <nav className={styles.filters}>{filters.map(item=><button key={item} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}</button>)}</nav>
  <section className={styles.list} aria-label="اعلان‌های اخیر">{visible.map(item=><article className={styles.item} key={item.title}><div className={styles.meta}><span>{item.category}</span><time>{item.time}</time></div><div className={styles.copy}><h2>{item.title}{item.unread&&!readAll&&<b>جدید</b>}</h2>{item.text&&<p>{item.text}</p>}</div></article>)}</section>
 </main>;
}