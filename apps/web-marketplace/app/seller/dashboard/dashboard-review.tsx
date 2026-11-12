"use client";
import Link from "next/link";
import { useState } from "react";
import { SellerPanelShell } from "../panel-shell";
import styles from "./dashboard-review.module.css";
const base = "/seller-panel/dashboard/";
function Icon({ name, size = 20 }: {name:string;size?:number}) { return <img src={`${base}${name}.svg`} width={size} height={size} alt="" />; }
const metrics = [
 ["سفارش‌های جدید","۴ سفارش نمونه","imgShoppingBag","accent"],
 ["سفارش‌های در حال انجام","۸ سفارش نمونه","imgClock","beige"],
 ["موارد نیازمند رسیدگی","۳ مورد نمونه","imgAlertTriangle","accent"],
 ["کالاهای فعال","۱۴۲ مورد نمونه","imgPackage","green"],
];
const recent = [
 {id:"HN-4091",time:"۱۰:۴۵",count:"۳ قلم",amount:"۱۴۲٬۰۰۰ تومان",state:"جدید",action:"تأیید سفارش",kind:"accent"},
 {id:"HN-4090",time:"۱۰:۲۰",count:"۵ قلم",amount:"۶۴۰٬۰۰۰ تومان",state:"در حال آماده‌سازی",action:"جزئیات",kind:"beige"},
 {id:"HN-4089",time:"۰۹:۱۵",count:"۱ قلم",amount:"۸۹٬۰۰۰ تومان",state:"تأیید شده",action:"جزئیات",kind:"accent"},
];
export function SellerDashboardReview() {
 const [notice,setNotice] = useState("");
 const pending = (label:string) => setNotice(`بخش «${label}» در مرحلهٔ بعد تکمیل می‌شود.`);
 return <SellerPanelShell active="dashboard">
  <h1>پیشخوان مدیریت کسب‌وکار</h1><p className={styles.subtitle}>خلاصه‌ای از وضعیت فعالیت، سفارش‌ها و اقدامات سریع مربوط به کسب‌وکار شما</p>
  {notice && <div className={styles.notice} role="status">{notice}<button aria-label="بستن پیام" onClick={()=>setNotice("")}>×</button></div>}
  <div className={styles.metrics}>{metrics.map(([label,value,icon,color])=><article key={label} className={`${styles.metric} ${styles[color]}`}><div><span>{label}</span><span className={styles.iconWrap}><Icon name={icon}/></span></div><strong>{value}</strong></article>)}</div>
  <div className={styles.actionRow}>
   <section className={styles.card}><h2>هشدارهای موجودی / دسترس‌پذیری</h2><div className={styles.alerts}>{[
    ["روغن آفتابگردان خالص لادن ۱.۵ لیتر (نمونه)","اتمام موجودی","imgEllipse"],
    ["پنیر سفید ایرانی ممتاز ۴۰۰ گرم (نمونه)","رو به اتمام","imgEllipse1"],
    ["کالای نمونه ۱","عدم دسترس‌پذیری","imgEllipse"],
   ].map(([text,badge,icon],i)=><div key={text}><span><Icon name={icon} size={6}/>{text}</span><small className={i===1?styles.warning:styles.danger}>{badge}</small></div>)}</div></section>
   <section className={styles.card}><h2>دسترسی سریع عملیاتی</h2><div className={styles.quick}>
    <Link href="/seller/orders"><Icon name="imgShoppingBag1" size={16}/>مشاهده سفارش‌ها</Link>
    <button className={styles.quickPrimary} onClick={()=>pending("افزودن کالا")}><Icon name="imgPlus" size={16}/>افزودن کالا</button>
    <button onClick={()=>pending("مدیریت موجودی")}><Icon name="imgCheckSquare" size={16}/>مدیریت موجودی</button>
    <button onClick={()=>pending("ویرایش قیمت‌ها")}><Icon name="imgTag" size={16}/>ویرایش قیمت‌ها</button>
   </div></section>
  </div>
  <section className={styles.card}><h2>وضعیت حساب و فروشندگی</h2><div className={styles.accountRows}>
   <div><span><Icon name="imgEllipse2" size={8}/>وضعیت فروشندگی: فعال</span><strong className={styles.green}>فعال</strong></div>
   <div><span><Icon name="imgEllipse3" size={8}/>اطلاعات تسویه طبق شرایط قرارداد نمایش داده می‌شود</span><strong className={styles.beige}>طبق شرایط قرارداد</strong></div>
   <div><span><Icon name="imgEllipse4" size={8}/>در حال حاضر طرح یا اعتبار فعالی برای این کسب‌وکار ثبت نشده است.</span><strong className={styles.accent}>—</strong></div>
  </div></section>
  <section className={styles.card}><div className={styles.cardHeading}><h2>آخرین سفارش‌ها</h2><Link href="/seller/orders">مشاهده کل آرشیو ←</Link></div><div className={styles.tableScroll}><table className={styles.table}><colgroup>{[32,13,11,17,16,11].map((w,i)=><col key={i} style={{width:`${w}%`}}/>)}</colgroup><thead><tr>{["شماره سفارش (نمونه)","ساعت ثبت","تعداد اقلام","مبلغ نهایی (نمونه)","وضعیت","عملیات"].map(t=><th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{recent.map(order=><tr key={order.id}><td><strong><bdi>{order.id}</bdi> نمونه</strong></td><td>{order.time}</td><td>{order.count}</td><td><strong>{order.amount}</strong></td><td><span className={`${styles.badge} ${styles[order.kind]}`}>{order.state}</span></td><td><Link className={order.action==="تأیید سفارش"?styles.primaryAction:styles.secondaryAction} href="/seller/orders">{order.action}</Link></td></tr>)}</tbody></table></div></section>
  <section className={styles.card}><h2>اعلان‌های مهم</h2><div className={styles.notifications}>{[
   ["سفارش جدید ثبت شد","سفارش HN-4091 نمونه در وضعیت جدید قرار دارد.","۵ دقیقه پیش","imgFrame"],
   ["سفارشی در حال آماده‌سازی است","سفارش HN-4090 نمونه در انتظار بسته‌بندی نهایی است.","۲۰ دقیقه پیش","imgFrame1"],
   ["موجودی یک کالا به پایان رسید","روغن آفتابگردان خالص لادن ۱.۵ لیتر (نمونه) نیاز به تکمیل دارد.","۱ ساعت پیش","imgFrame2"],
  ].map(([title,body,time,icon])=><div key={title}><span className={styles.notificationIcon}><Icon name={icon} size={16}/></span><div><strong>{title}</strong><p>{body}</p></div><time>{time}</time></div>)}</div></section>
 </SellerPanelShell>;
}
