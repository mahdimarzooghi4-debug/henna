"use client";
import Link from "next/link";
import { useState } from "react";
import styles from "./figma-buyer-services.module.css";

type ServiceKind="credits"|"social"|"support";
const accountNav=[["اطلاعات حساب","/buyer/account?mode=preview"],["آدرس‌های من","/account/addresses"],["سفارش‌های من","/buyer/orders?mode=preview"],["روش‌های پرداخت","#payments"],["اعتبارهای من","/benefits"],["طرح‌های فعال","/benefits"],["مشارکت‌های اجتماعی","/social"],["اعلان‌ها","/buyer/notifications"],["پشتیبانی","/support"],["تنظیمات","#settings"]];
const supportFaq=["نحوه استفاده از طرح کالابرگ اجتماعی","شرایط مرجوعی کالا در بازار محلی","پیگیری سفارش و درخواست پشتیبانی"];
const tickets=[
 {status:"پاسخ داده شده",date:"۱۴۰۴/۱۲/۱۰",title:"عدم تطابق مبلغ کسر شده از کالابرگ",id:"#۱۰۲۴",detail:"پاسخ پشتیبان: کاربر گرامی، مابه‌التفاوت پرداختی بابت روغن مصوب به کیف پول شما عودت داده شد."},
 {status:"در حال بررسی",date:"۱۴۰۴/۱۲/۰۸",title:"پیگیری وضعیت ارسال سفارش نمونه",id:"#۱۰۱۹",detail:"در حال پیگیری هماهنگی با پیک فروشگاه جهت بررسی تاخیر تحویل."},
 {status:"ثبت شده",date:"۱۴۰۴/۱۱/۲۵",title:"درخواست ثبت مجدد کد ملی حمایتی",id:"#۱۰۰۲",detail:"درخواست استعلام تکمیلی از پایگاه اطلاعات رفاهی ثبت شد."},
];
export function FigmaBuyerServices({kind}:{kind:ServiceKind}){
 const [tab,setTab]=useState("طرح‌های فعال و کالابرگ‌ها");const [notice,setNotice]=useState("");
 const heading=kind==="credits"?"اعتبارها و طرح‌های من":kind==="social"?"مشارکت اجتماعی":"پشتیبانی حنا";
 const description=kind==="credits"?"در این بخش می‌توانید وضعیت انواع حمایت‌ها، طرح‌های فعال سازمانی یا دولتی و سهم اعتبارات تخصیص‌یافته به حساب خود را مدیریت و پیگیری کنید.":kind==="social"?"در این بخش می‌توانید طرح‌های اجتماعی و وضعیت مشارکت‌های اختیاری خود را مشاهده کنید.":"تیم پشتیبانی حنا در کنار شماست تا درخواست‌ها و پرسش‌ها را پیگیری کند.";
 return <main className={styles.page} dir="rtl"><div className={styles.layout}>
  <section className={styles.content}>
   <header className={kind==="credits"?styles.creditsSummary:styles.summary}><div className={styles.summaryCopy}><span className={styles.kicker}>{kind==="social"?"خریدی هوشمند و مسئولانه":kind==="support"?"پشتیبانی کاربر":kind==="credits"?"":"حساب کاربری"}</span><h1>{heading}</h1><p>{description}</p></div>{kind==="credits"&&<span className={styles.summaryBadge}>اعتبارات و تسهیلات فعال</span>}</header>
   {kind==="credits"&&<>
    <nav className={styles.creditsTabs}>{["اعتبار حمایتی عمومی","کارت‌های معیشتی","اعتبارات سازمانی","طرح‌های فعال و کالابرگ‌ها"].map(item=><button key={item} aria-pressed={tab===item} onClick={()=>setTab(item)}>{item}</button>)}</nav>
    {tab==="طرح‌های فعال و کالابرگ‌ها"?<>
     <article className={styles.emptyCredit+" "+styles.creditState}><div className={styles.emptyIcon}>▱</div><h2>در حال حاضر اعتبار فعالی برای این حساب ثبت نشده است</h2><p>هیچ‌گونه اعتبار حمایتی، سهمیه کالابرگ الکترونیکی یا تسهیلات سازمانی فعالی برای کد ملی / مشخصات حساب شما شناسایی نشد. در صورت نیاز به راهنمایی، می‌توانید مدارک خود را به پشتیبانی ارسال کنید.</p><button type="button" onClick={()=>setNotice("استعلام نمونه در دسترس نیست.")}>استعلام مجدد کد ملی حمایتی</button></article>
     <section className={styles.plansPanel}><div className={styles.plansHeader}><h2>نمونه برنامه تسهیلاتی پیش‌فرض سامانه</h2><span className={styles.badge}>راهنمای کلی تسهیلات</span></div><p>این بخش فقط وضعیت اعتبارها و طرح‌های مرتبط با حساب را نمایش می‌دهد. در صورت فعال شدن هر طرح، جزئیات آن پیش از استفاده در همین بخش قابل مشاهده است.</p><div className={styles.planRows}>
      <article className={styles.planRow}><span className={styles.planIcon}>♙</span><div><h3>طرح نمونه کالابرگ الکترونیکی (خانواده‌های محلی)</h3><p>اقلام تحت پوشش: برنج، روغن، لبنیات، تخم‌مرغ و خواربار مصوب</p></div><strong>در انتظار استعلام فعال‌سازی</strong></article>
      <article className={styles.planRow}><span className={styles.planIcon}>▣</span><div><h3>برنامه اشتراکی سازمان‌ها و صاحبان کار</h3><p>نمونه ساختار اعتبار سازمانی برای خرید محصولات و خدمات مجاز</p></div><strong>بدون اشتراک سازمانی فعال</strong></article>
     </div></section>
    </>:<article className={styles.emptyCredit+" "+styles.creditState}><div className={styles.emptyIcon}>▱</div><h2>{tab}</h2><p>در حال حاضر اعتبار فعالی برای این حساب ثبت نشده است.</p><button type="button" onClick={()=>setNotice("درخواست برای طرح نمونه ثبت شد.")}>استعلام مجدد کد ملی حمایتی</button></article>}
   </>}
   {kind==="social"&&<><div className={styles.emotional}><span>حنا</span><h2>خرید و مشارکتی که اثرش ادامه پیدا می‌کند</h2><p>مشارکت اجتماعی در حنا یک امکان اختیاری و ثانویه در کنار تجربه بازارگاه است.</p></div><section className={styles.actionsSection}><h2>اقدامات و پیگیری برنامه‌های همبستگی محلی</h2><div className={styles.actionCards}>
    <article><div className={styles.actionIcon}>⌕</div><h3>مشاهده طرح‌های اجتماعی</h3><p>مرور فهرست و جزئیات طرح‌های اجتماعی موجود در حنا.</p><Link href="/impact">مشاهده لیست ←</Link></article>
    <article className={styles.selectedAction}><div className={styles.actionIcon}>＋</div><h3>مشارکت در یک طرح</h3><p>انتخاب یک طرح و ثبت مشارکت به‌صورت آگاهانه و اختیاری.</p><Link href="/impact#projects">انتخاب طرح جدید</Link></article>
    <article><div className={styles.actionIcon}>◷</div><h3>پیگیری مشارکت‌های من</h3><p>مشاهده تاریخچه تراکنش‌ها، سبدهای تحویل‌یافته و گزارش‌های آماری کلی و مستمر.</p><Link href="/impact">گزارش‌ها و سوابق</Link></article>
   </div></section><div className={styles.note}><strong>تذکر مهم درباره نقش اجتماعی حنا</strong><p>مشارکت اجتماعی اختیاری است و بر تجربه خرید روزمره تأثیری نمی‌گذارد.</p></div></>}
   {kind==="support"&&<><section className={styles.faq}><h2>سوالات متداول</h2>{supportFaq.map((q,i)=><details key={q}><summary>{q}</summary><p>{i===0?"جزئیات و شرایط طرح‌های فعال در صفحه اعتبارها نمایش داده می‌شود.":"برای پیگیری، درخواست خود را ثبت کنید یا از فهرست درخواست‌های قبلی وضعیت را ببینید."}</p></details>)}</section>
    <section className={styles.supportForm} id="support-new-request"><h2>ثبت درخواست پشتیبانی جدید</h2><form onSubmit={(event)=>{event.preventDefault();setNotice("درخواست نمونه آماده است؛ ارسال واقعی پس از اتصال سامانه پشتیبانی فعال می‌شود.");}}><div className={styles.supportFormGrid}><label><span>شماره تماس گیرنده (در صورت تغییر)</span><input name="phone" inputMode="tel" dir="ltr" placeholder="۰۹۱۲۳۴۵۶۷۸۹" /></label><label><span>موضوع درخواست</span><input name="subject" placeholder="موضوع درخواست را وارد کنید" required /></label><label className={styles.supportMessage}><span>متن پیام و توضیحات مشکل</span><textarea name="message" placeholder="جزئیات درخواست خود را بنویسید..." rows={3} required /></label></div><div className={styles.supportActions}><button type="submit">ثبت و ارسال پیام پشتیبانی</button><Link href="tel:02100000000">تماس مستقیم با پشتیبانی تلفنی (۰۲۱-۰۰۰۰۰۰۰۰)</Link></div></form></section>
    <section className={styles.tickets}><div className={styles.sectionHeading}><h2>درخواست‌های قبلی و پیگیری پیام‌ها</h2><button type="button" onClick={()=>document.getElementById("support-new-request")?.scrollIntoView({behavior:"smooth"})}>ثبت درخواست جدید</button></div>{tickets.map(ticket=><article className={styles.ticket} key={ticket.id}><div className={styles.ticketMeta}><span className={styles.badge}>{ticket.status}</span><span>تاریخ ثبت: {ticket.date}</span></div><div><h3>{ticket.title}</h3><span className={styles.ticketId}>{ticket.id}</span><p>{ticket.detail}</p></div></article>)}<Link className={styles.call} href="tel:02100000000">تماس با پشتیبانی تلفنی</Link></section></>}
   {notice&&<p className={styles.notice} role="status">{notice}</p>}
  </section>
  <aside className={styles.navCard} aria-label="بخش‌های حساب">{accountNav.map(([label,href])=><Link href={href} key={label}>{label}<span>‹</span></Link>)}</aside>
 </div></main>;
}

const states=[
 ["سبد خرید شما هنوز خالی است","اقلام مورد نیاز خود نظیر نان گرم، لبنیات محلی و برنج را جست‌وجو کرده و به سبد خود اضافه کنید تا مقایسه قیمت‌ها انجام شود.","مشاهده و جست‌وجوی کالاها","/products"],
 ["سفارشی در تاریخچه شما ثبت نشده است","هنوز خریدی از بازارگاه محلی انجام نداده‌اید. اولین خرید شما موتور محرک توسعه فروشگاه‌های نزدیک خواهد بود.","اولین سفارش خود را ثبت کنید","/products"],
 ["نتیجه‌ای برای جست‌وجوی شما پیدا نشد","ملاک دقیق‌تری یا کلمه‌ای متفاوت را امتحان کنید. حنا اقلام توزیع محله‌ای را بررسی می‌کند.","تغییر عبارت جست‌وجو","/products"],
 ["فروشگاه مناسبی برای این سبد پیدا نشد","ممکن است همه اقلام این سبد در فروشگاه‌های نزدیک موجود نباشد. می‌توانید سبد را ویرایش کرده یا دوباره جست‌وجو کنید.","اصلاح اقلام سبد خرید","/buyer/cart?mode=preview"],
 ["هیچ طرح حمایتی یا اعتباری برای کد ملی شما فعال نیست","در حال حاضر اعتبار فعالی برای این حساب ثبت نشده است. برای اطلاعات بیشتر با پشتیبانی در ارتباط باشید.","ثبت مجدد اطلاعات هویتی","/benefits"],
 ["اختلال در برقراری ارتباط با شبکه","ارتباط شما با سامانه حنا قطع شده است. لطفاً وضعیت شبکه را بررسی کرده و مجدداً امتحان کنید.","تلاش مجدد ارتباطی","/products"],
 ["متأسفانه خطایی در بارگذاری سامانه رخ داده است","سیستم در حال حاضر با حجم بالایی از ترافیک مواجه است. در تلاش برای برطرف کردن آن هستیم.","به‌روزرسانی صفحه","/products"],
];
export function FigmaBuyerEmptyStates(){
 return <main className={styles.page} dir="rtl"><section className={styles.statesIntro}><span className={styles.kicker}>راهنمای رابط کاربری</span><h1>مجموعه حالت‌های خالی و خطاهای کاربردی سامانه</h1><p>این صفحه مجموعه مرجع پیام‌ها و حالت‌های خالی در بخش‌های مختلف حنا را نشان می‌دهد.</p></section><div className={styles.statesGrid}>{states.map(([title,text,action,href])=><article className={styles.stateCard} key={title}><div className={styles.stateIcon}>○</div><div><h2>{title}</h2><p>{text}</p></div><Link href={href}>{action}</Link></article>)}</div></main>;
}
