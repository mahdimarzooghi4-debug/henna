import Link from "next/link";
import Image from "next/image";
import styles from "./admin-panel.module.css";

const metrics = [
  {label:"سفارش‌های نیازمند بررسی نمونه", icon:"dashboard-imgIconWrap.svg", tone:"red", fullIcon:true},
  {label:"درخواست‌های ثبت‌نام فروشنده", icon:"dashboard-imgClipboardList.svg", tone:"sand", fullIcon:false},
  {label:"حساب‌های نیازمند احراز هویت", icon:"dashboard-imgUsers2.svg", tone:"green", fullIcon:false},
  {label:"تیکت‌های پشتیبانی باز", icon:"dashboard-imgHelpCircle.svg", tone:"red", fullIcon:false},
];
const orders = [
  ["مشتری نمونه ۱ / HN-9021","داده نمونه","جدید","HN-9021"],
  ["مشتری نمونه ۲ / HN-9022","داده نمونه","در حال آماده‌سازی","HN-9022"],
];
const applications = [
  ["کسب‌وکار نمونه (شخص حقوقی)","در حال بررسی"],
  ["کسب‌وکار نمونه (شخص حقیقی)","اطلاعات ناقص"],
];
const menu = [
 ["نمای کلی", [["داشبورد","/admin/panel","imgFrame"]]],
 ["بازارگاه", [["کاربران و حساب‌ها","/admin/panel/users","imgUsersIcon"],["سازمان‌ها","/admin/panel/organizations","imgUsersIcon"],["فروشندگان","/admin/panel/sellers","imgStoreIcon"],["درخواست‌های ثبت‌نام فروشنده","/admin/seller-applications","imgClipboardIcon"],["کالاها","/admin/panel/products","imgFrame1"],["دسته‌بندی‌ها","/admin/panel/categories","imgFolderIcon"],["سفارش‌ها","/admin/panel/orders","imgFrame2"]]],
 ["عملیات و طرح‌ها", [["طرح‌ها و اعتبارها","/admin/panel/programs","imgFrame3"],["مشارکت اجتماعی","/admin/panel/social","imgMessageIcon"],["لجستیک","/admin/panel/logistics","imgFrame4"],["تسویه‌ها و تراکنش‌ها","/admin/panel/settlements","imgFrame5"],["پشتیبانی","/admin/panel/support","imgHelpIcon"],["اعلان‌ها","/admin/panel/notifications","imgFrame6"]]],
 ["مدیریت سامانه", [["گزارش‌ها","/admin/panel/reports","imgFrame7"],["محتوا","/admin/panel/content","imgFileIcon"],["کاربران پنل و دسترسی‌ها","/admin/panel/access","imgShieldIcon"],["تنظیمات","/admin/panel/settings","imgSettingsIcon"]]],
];
export const dynamic="force-dynamic";
export const metadata={title:"داشبورد مدیریت | حنا"};
export default function AdminPanelPage(){return <main className={styles.shell} dir="rtl">
 <section className={styles.app}>
  <header className={styles.top}><div className={styles.user}><button className={styles.notification} aria-label="اعلان‌ها"><Image src="/admin-assets/list-imgNotifBtn.svg" alt="" width={36} height={36}/></button><span className={styles.divider}/><span className={styles.profile}><span className={styles.userInfo}><b>کاربر پنل</b><small>دسترسی مدیریت</small></span><span className={styles.avatar}>م</span></span></div></header>
 <div className={styles.content}><header className={styles.title}><h1>پیشخوان مدیریت عملیاتی</h1><p>خلاصه‌ای از وضعیت درخواست‌ها، بررسی‌ها و اقدامات نیازمند مداخله نمونه</p></header>
   <section className={styles.metrics}>{metrics.map(m=><article className={styles.metric} key={m.label}><div className={styles.metricHeader}><span>{m.label}</span><span className={`${styles.metricIcon} ${styles[m.tone]}`}>{m.fullIcon ? <Image src={`/admin-assets/${m.icon}`} alt="" width={36} height={36}/> : <Image src={`/admin-assets/${m.icon}`} alt="" width={18} height={18}/>}</span></div><strong>داده نمونه</strong></article>)}</section>
   <div className={styles.columns}><div className={styles.left}>
    <section className={styles.card}><h2>سفارش‌های جدید اخیر <small>(نمونه)</small></h2><div className={styles.table}><div className={styles.trHead}><span>عملیات</span><span>وضعیت</span><span>مبلغ (نمونه)</span><span>خریدار / شماره سفارش</span></div>{orders.map(row=><div className={styles.tr} key={row[0]}><Link href={`/admin/panel/orders/${row[3]}`}>بررسی</Link><span className={styles.badge}>{row[2]}</span><b>{row[1]}</b><span>{row[0]}</span></div>)}</div></section>
    <section className={styles.card}><h2>درخواست‌های ثبت‌نام اخیر فروشنده <small>(نمونه)</small></h2>{applications.map((a,i)=><div className={styles.application} key={a[0]}><Link href="/admin/seller-applications">بررسی درخواست</Link><span><i>{a[1]}</i><b>{a[0]}</b></span></div>)}</section>
   </div><div className={styles.right}><section className={styles.card}><h2>هشدارهای عملیاتی سیستم</h2><div className={`${styles.alert} ${styles.urgent}`}><b>اطلاعات ثبت‌نام نیازمند بررسی است</b><span>اطلاعات یک درخواست فروشندگی نیازمند تکمیل است.</span></div><div className={`${styles.alert} ${styles.finance}`}><b>مورد مالی نیازمند بررسی</b><span>یک مورد مرتبط با وضعیت تسویه نیازمند بررسی است.</span></div></section><section className={styles.card}><h2>اطلاعیه‌های سیستمی حنا</h2><p className={styles.notice}>به‌روزرسانی سامانه با موفقیت انجام شد.</p><p className={styles.notice}>وضعیت سرویس‌های متصل قابل مشاهده است.</p></section></div></div>
  </div>
 </section>
 <aside className={styles.sidebar}><div className={styles.sideBrand}><span className={styles.logo}><Image src="/admin-assets/henna-admin-logo.png" alt="" width={82} height={48} priority /></span><span><b>مدیریت حنا</b><small>پنل مدیریت بازارگاه</small></span></div><nav>{menu.map(([group,items])=><section key={String(group)}><h2>{String(group)}</h2>{(items as string[][]).map(([label,href,icon])=><Link className={href==='/admin/panel'?styles.active:''} href={href} key={label}><Image src={`/admin-assets/list-${icon}.svg`} alt="" width={20} height={20}/>{label}</Link>)}</section>)}</nav></aside>
 </main>}
