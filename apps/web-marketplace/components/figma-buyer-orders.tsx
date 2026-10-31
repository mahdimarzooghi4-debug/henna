"use client";
import Link from "next/link";
import { useState } from "react";
import styles from "./figma-buyer-orders.module.css";
const orders=[
 {id:"order-1",total:"۶۹۳,۵۰۰",status:"در حال آماده‌سازی",date:"۱۴۰۴/۰۲/۱۲",store:"فروشگاه نمونه ۱",items:["پنیر سفید هراز","ماست پرچرب کاله","برنج هاشمی"],legal:true},
 {id:"order-2",total:"۱۴۲,۰۰۰",status:"تحویل‌شده",date:"۱۴۰۴/۰۱/۰۵",store:"فروشگاه نمونه ۲",items:["شیر تازه گاومیش","تخم‌مرغ محلی"]},
 {id:"order-3",total:"۳۲۰,۰۰۰",status:"لغوشده",date:"۱۴۰۳/۱۱/۱۸",store:"فروشگاه نمونه ۳",items:["روغن خالص لادن","چای لاهیجان"]},
];
const tabs=["همه سفارش‌ها","جاری","تحویل‌شده","لغوشده"];
export function FigmaBuyerOrders(){
 const [tab,setTab]=useState(tabs[0]);
 const visible=orders.filter(order=>tab===tabs[0]||(tab==="جاری"&&order.status==="در حال آماده‌سازی")||order.status===tab);
 return <main className={styles.page} dir="rtl"><nav className={styles.tabs} aria-label="فیلتر سفارش‌ها">
  {tabs.map(item=><button key={item} type="button" aria-pressed={tab===item} onClick={()=>setTab(item)}>{item}</button>)}
 </nav>
 <section className={styles.list} aria-label="تاریخچه سفارش‌ها">
  {visible.map(order=><article className={styles.row} key={order.id}>
   <header className={styles.header}><div className={styles.actions}><Link href="/buyer/tracking?mode=preview" className={styles.view}>مشاهده جزئیات سفارش</Link><strong>{order.total} تومان</strong></div>
    <div className={styles.status}><span className={order.status==="لغوشده"?styles.cancelled:order.status==="تحویل‌شده"?styles.delivered:styles.pending}>{order.status}</span>{order.legal&&<span className={styles.legal}>خرید حقوقی</span>}</div>
   </header>
   <div className={styles.divider}/>
   <div className={styles.meta}><span>فروشگاه: {order.store}</span><span>کد سفارش: نمونه</span><span>تاریخ: {order.date}</span></div>
   <div className={styles.items}>{order.items.map(item=><span key={item}>{item}</span>)}</div>
  </article>)}
  {!visible.length&&<p className={styles.empty}>سفارشی در این بخش وجود ندارد.</p>}
 </section></main>;
}