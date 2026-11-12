"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./orders-review.module.css";

const assets = "/seller-panel/";
const menu = ["داشبورد", "سفارش‌ها", "کالاها", "کتابخانه تصاویر", "موجودی و دسترس‌پذیری", "قیمت‌گذاری", "طرح‌ها و اعتبارها", "ارسال و محدوده فعالیت", "تسویه‌حساب‌ها", "گزارش‌ها", "اعلان‌ها", "اطلاعات کسب‌وکار", "پشتیبانی", "تنظیمات"];
const icons = ["imgIcon", "imgIcon1", "imgIcon2", "imgIcon3", "imgIcon4", "imgIcon5", "imgIcon6", "imgIcon7", "imgIcon8", "imgIcon9", "imgBell", "imgIcon10", "imgIcon11", "imgIcon12"];
const statuses = ["جدید", "تأیید شده", "در حال آماده‌سازی", "آماده تحویل / ارسال", "تکمیل شده", "لغو شده"];
const actions = ["تأیید سفارش", "شروع آماده‌سازی", "آماده تحویل / ارسال", "تکمیل سفارش", "مشاهده", "مشاهده"];
const initialOrders = [
  { id: "HN-4091", state: 0, amount: 142000, count: 3, time: "۱۰:۴۵ - امروز", delivery: "ارسال توسط فروشنده" },
  { id: "HN-4089", state: 1, amount: 89000, count: 1, time: "۰۹:۱۵ - امروز", delivery: "تحویل حضوری" },
  { id: "HN-4090", state: 2, amount: 640000, count: 5, time: "۱۰:۲۰ - امروز", delivery: "ارسال توسط فروشنده" },
  { id: "HN-4078", state: 3, amount: 34000, count: 2, time: "دیروز", delivery: "تحویل حضوری" },
  { id: "HN-4074", state: 4, amount: 118000, count: 4, time: "دیروز", delivery: "تحویل حضوری" },
  { id: "HN-4069", state: 5, amount: 56000, count: 1, time: "دیروز", delivery: "تحویل حضوری" },
];
const fa = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
function Icon({ name }: { name: string }) { return <img src={`${assets}${name}.svg`} width={20} height={20} alt="" />; }

export function SellerOrdersReview() {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState(-1);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<(typeof initialOrders)[number] | null>(null);
  function advance(order: (typeof initialOrders)[number]) {
    if (order.state >= 4) { setSelected(order); return; }
    setOrders(previous => previous.map(item => item.id === order.id ? { ...item, state: item.state + 1 } : item));
    setNotice(`وضعیت سفارش نمونه ${order.id} به «${statuses[order.state + 1]}» تغییر کرد؛ این تغییر فقط در همین نمایش است.`);
  }
  return <div className={styles.panel} dir="rtl">
    <header className={styles.header}>
      <Link href="/" aria-label="صفحه اصلی حنا"><img src={`${assets}imgLogo.png`} width={110} height={44} alt="حنا" /></Link>
      <span className={styles.caption}>پنل فروشندگان</span>
      <span className={styles.divider} />
      <button className={styles.store} onClick={() => setNotice("کسب‌وکار نمونه برای بررسی ظاهر پنل نمایش داده می‌شود.")}><Icon name="imgStore" /> کسب‌وکار نمونه <Icon name="imgChevronDown" /></button>
      <div className={styles.account}><button className={styles.bell} aria-label="اعلان‌ها" onClick={() => setNotice("اعلان جدیدی ندارید.")}><Icon name="imgBell" /></button><span className={styles.divider} /><div><strong>مدیریت پنل</strong><small>فروشنده / کسب‌وکار نمونه</small></div><span className={styles.avatar}>م‌ف</span></div>
    </header>
    <div className={styles.body}>
      <aside className={styles.sidebar}><nav aria-label="ناوبری پنل فروشنده">{menu.map((label, i) => <button key={label} className={i === 1 ? styles.active : ""} aria-current={i === 1 ? "page" : undefined} onClick={() => i === 1 ? setFilter(-1) : setNotice(`صفحهٔ «${label}» در مرحلهٔ بعد با فیگما تطبیق داده می‌شود.`)}><Icon name={icons[i]} /><span>{label}</span></button>)}</nav></aside>
      <main className={styles.content}>
        <h1>مدیریت سفارش‌ها</h1><p className={styles.subtitle}>سفارش‌های دریافتی را بررسی، تأیید و برای تحویل آماده کنید.</p>
        <div className={styles.filters} aria-label="فیلتر وضعیت سفارش">{[{ label: "همه", i: -1 }, ...statuses.map((label, i) => ({ label, i }))].map(({ label, i }) => <button key={i} aria-pressed={filter === i} className={`${styles.tab} ${i >= 0 ? styles[`state${i}`] : ""} ${filter === i && i !== -1 ? styles.selected : ""}`} onClick={() => setFilter(i)}>{label}</button>)}</div>
        {notice && <div className={styles.notice} role="status">{notice}<button aria-label="بستن پیام" onClick={() => setNotice("")}>×</button></div>}
        <section className={styles.card} aria-label="سفارش‌ها"><div className={styles.tableScroll}><table className={styles.table}>
          <colgroup>{[200,120,100,140,120,120,220].map((width,i) => <col key={i} style={{width}} />)}</colgroup>
          <thead><tr>{["شماره سفارش", "زمان ثبت", "تعداد اقلام", "مبلغ", "وضعیت", "شیوه تحویل", "عملیات"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{orders.filter(o => filter === -1 || o.state === filter).map(order => <tr key={order.id}>
            <td><strong><bdi>{order.id}</bdi> نمونه</strong></td><td>{order.time}</td><td>{fa(order.count)} قلم</td><td className={styles.amount}>{fa(order.amount)} تومان</td><td><span className={`${styles.badge} ${styles[`state${order.state}`]}`}>{statuses[order.state]}</span></td><td>{order.delivery}</td><td><button className={styles.action} onClick={() => advance(order)}>{actions[order.state]}</button></td>
          </tr>)}</tbody>
        </table></div>{!orders.some(o => filter === -1 || o.state === filter) && <p className={styles.empty}>سفارشی با این وضعیت وجود ندارد.</p>}</section>
      </main>
    </div>
    {selected && <div className={styles.overlay} onClick={() => setSelected(null)}><section role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className={styles.dialog} onClick={e => e.stopPropagation()}><h2 id="order-detail-title">سفارش <bdi>{selected.id}</bdi></h2><p>وضعیت: {statuses[selected.state]}</p><p>مبلغ: {fa(selected.amount)} تومان</p><p>تعداد: {fa(selected.count)} قلم</p><p>شیوه تحویل: {selected.delivery}</p><button className={styles.action} autoFocus onClick={() => setSelected(null)}>بستن</button></section></div>}
  </div>;
}
