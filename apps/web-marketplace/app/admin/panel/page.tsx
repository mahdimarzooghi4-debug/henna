import Link from "next/link";
import Image from "next/image";
import styles from "./admin-panel.module.css";

const metrics = [
  {label:"سفارش‌های نیازمند بررسی", value:"۱۲", icon:"▣", tone:"red"},
  {label:"درخواست‌های ثبت‌نام فروشنده", value:"۸", icon:"▤", tone:"sand"},
  {label:"حساب‌های نیازمند احراز هویت", value:"۵", icon:"♙", tone:"green"},
  {label:"تیکت‌های پشتیبانی باز", value:"۳", icon:"?", tone:"red"},
];
const orders = [
  ["مشتری نمونه ۱ / HN-9021","۱۴۲٬۰۰۰ تومان","جدید"],
  ["مشتری نمونه ۲ / HN-9022","۶۴۰٬۰۰۰ تومان","در حال آماده‌سازی"],
];
const applications = [
  ["کسب‌وکار نمونه (شخص حقوقی)","در حال بررسی"],
  ["کسب‌وکار نمونه (شخص حقیقی)","اطلاعات ناقص"],
];
const menu = [
 ["نمای کلی", [["داشبورد","/admin/panel","▦"]]],
 ["بازارگاه", [["کاربران و حساب‌ها","#","♙"],["سازمان‌ها","#","♧"],["فروشندگان","/admin/seller-applications","▣"],["درخواست‌های ثبت‌نام فروشنده","/admin/seller-applications","▤"],["کالاها","#","□"],["دسته‌بندی‌ها","#","▤"],["سفارش‌ها","/seller/orders","▣"]]],
 ["عملیات و طرح‌ها", [["طرح‌ها و اعتبارها","#","◇"],["مشارکت اجتماعی","#","♡"],["لجستیک","#","⌖"],["تسویه‌ها و تراکنش‌ها","/admin/organization-funding-instructions","↔"],["پشتیبانی","#","?"],["اعلان‌ها","#","♧"]]],
 ["مدیریت سامانه", [["گزارش‌ها","#","▥"],["محتوا","#","▤"],["کاربران پنل و دسترسی‌ها","#","♧"],["تنظیمات","#","⚙"]]],
];
export const dynamic="force-dynamic";
export const metadata={title:"داشبورد مدیریت | حنا"};
export default function AdminPanelPage(){return <main className={styles.shell} dir="rtl">
 <section className={styles.app}>
  <header className={styles.top}><div className={styles.user}><span className={styles.avatar}>م</span><span><b>کاربر پنل</b><small>دسترسی مدیریت</small></span><button aria-label="اعلان‌ها">♧</button></div></header>
  <div className={styles.content}><header className={styles.title}><h1>پیشخوان مدیریت عملیاتی</h1><p>خلاصه‌ای از وضعیت درخواست‌ها، بررسی‌ها و اقدامات نیازمند مداخله · دادهٔ نمونه</p></header>
   <section className={styles.metrics}>{metrics.map(m=><article className={styles.metric} key={m.label}><div><span>{m.label}</span><i className={styles[m.tone]}>{m.icon}</i></div><strong className={styles[m.tone]}>{m.value} <small>مورد نمونه</small></strong></article>)}</section>
   <div className={styles.columns}><div className={styles.left}>
    <section className={styles.card}><h2>سفارش‌های جدید اخیر <small>(نمونه)</small></h2><div className={styles.table}><div className={styles.trHead}><span>عملیات</span><span>وضعیت</span><span>مبلغ (نمونه)</span><span>خریدار / شماره سفارش</span></div>{orders.map(row=><div className={styles.tr} key={row[0]}><Link href="/seller/orders">بررسی</Link><span className={styles.badge}>{row[2]}</span><b>{row[1]}</b><span>{row[0]}</span></div>)}</div></section>
    <section className={styles.card}><h2>درخواست‌های ثبت‌نام اخیر فروشنده <small>(نمونه)</small></h2>{applications.map((a,i)=><div className={styles.application} key={a[0]}><Link href="/admin/seller-applications">بررسی درخواست</Link><span><i>{a[1]}</i><b>{a[0]}</b></span></div>)}</section>
   </div><div className={styles.right}><section className={styles.card}><h2>هشدارهای عملیاتی سیستم</h2><div className={styles.alert}><b>اطلاعات ثبت‌نام نیازمند بررسی است</b><span>اطلاعات یک درخواست فروشندگی نیازمند تکمیل است.</span></div><div className={styles.alert}><b>مورد مالی نیازمند بررسی</b><span>یک مورد مرتبط با وضعیت تسویه نیازمند بررسی است.</span></div></section><section className={styles.card}><h2>اطلاعیه‌های سیستمی حنا</h2><p className={styles.notice}>به‌روزرسانی سامانه با موفقیت انجام شد.</p><p className={styles.notice}>وضعیت سرویس‌های متصل قابل مشاهده است.</p></section></div></div>
  </div>
 </section>
 <aside className={styles.sidebar}><div className={styles.sideBrand}><span className={styles.logo}><Image src="/hana-logo.png" alt="حنا" width={48} height={32} priority /></span><span><b>مدیریت حنا</b><small>پنل مدیریت بازارگاه</small></span></div><nav>{menu.map(([group,items])=><section key={String(group)}><h2>{String(group)}</h2>{(items as string[][]).map(([label,href,icon])=><Link className={href==='/admin/panel'?styles.active:''} href={href} key={label}><i>{icon}</i>{label}</Link>)}</section>)}</nav></aside>
 </main>}
