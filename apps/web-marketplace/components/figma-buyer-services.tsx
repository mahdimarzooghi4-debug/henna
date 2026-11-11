"use client";
import Link from "next/link";
import { useState } from "react";
import { BuyerCreditCards } from "./buyer-credit-cards";
import { BuyerSocialReport } from "./buyer-social-report";
import styles from "./figma-buyer-services.module.css";
import accountStyles from "./figma-buyer-account.module.css";

type ServiceKind="credits"|"social"|"support";
import { BuyerAccountNav } from "./buyer-account-nav";
const supportFaq=["نحوه استفاده از طرح کالابرگ اجتماعی","شرایط مرجوعی کالا در بازار محلی","پیگیری سفارش و درخواست پشتیبانی"];
const tickets=[
 {status:"پاسخ داده شده",date:"۱۴۰۴/۱۲/۱۰",title:"عدم تطابق مبلغ کسر شده از کالابرگ",id:"#۱۰۲۴",detail:"پاسخ پشتیبان: کاربر گرامی، مابه‌التفاوت پرداختی بابت روغن مصوب به کیف پول شما عودت داده شد."},
 {status:"در حال بررسی",date:"۱۴۰۴/۱۲/۰۸",title:"پیگیری وضعیت ارسال سفارش نمونه",id:"#۱۰۱۹",detail:"در حال پیگیری هماهنگی با پیک فروشگاه جهت بررسی تاخیر تحویل."},
 {status:"ثبت شده",date:"۱۴۰۴/۱۱/۲۵",title:"درخواست ثبت مجدد کد ملی حمایتی",id:"#۱۰۰۲",detail:"درخواست استعلام تکمیلی از پایگاه اطلاعات رفاهی ثبت شد."},
];
export function FigmaBuyerServices({kind}:{kind:ServiceKind}){
 const [notice,setNotice]=useState("");
 const heading=kind==="credits"?"اعتبارهای من":kind==="social"?"مشارکت اجتماعی":"پشتیبانی حنا";
 const description=kind==="credits"?"اعتبارهای ثبت‌شده برای حساب شما به‌صورت کارت‌های مستقل نمایش داده می‌شوند.":kind==="social"?"گزارش عمومی و تأییدشده عملکرد اجتماعی حنا در حمایت از خانواده‌های کم‌برخوردار.":"مرکز ارتباطات، پاسخ به سوالات متداول و پیگیری درخواست‌ها. ما در کوتاه‌ترین زمان برای حل مشکلات خرید و مسائل مربوط به اعتبارها در کنار شما هستیم.";
 return <main className={accountStyles.page} dir="rtl" data-testid={"preview-" + kind}><div className={accountStyles.layout}>
  <BuyerAccountNav active={kind} />
  <section className={styles.content}>
   <header className={kind==="credits"?styles.creditsSummary:styles.summary}><div className={styles.summaryCopy}><span className={styles.kicker}>{kind==="social"?"خریدی هوشمند و مسئولانه":kind==="support"?"پشتیبانی ۲۴ ساعته فعال":kind==="credits"?"":"حساب کاربری"}</span><h1>{heading}</h1><p>{description}</p></div></header>
   {kind==="credits"&&<BuyerCreditCards/>}
   {kind==="social"&&<BuyerSocialReport/>}
   {kind==="support"&&<><section className={styles.faq}><h2>سوالات متداول کاربران</h2>{supportFaq.map((q,i)=><details key={q} open><summary>{q}</summary><p>{i===0?"جزئیات و شرایط طرح‌های فعال در صفحه اعتبارها نمایش داده می‌شود.":"برای پیگیری، درخواست خود را ثبت کنید یا از فهرست درخواست‌های قبلی وضعیت را ببینید."}</p></details>)}</section>
    <section className={styles.supportForm} id="support-new-request"><h2>ثبت درخواست پشتیبانی جدید</h2><form onSubmit={(event)=>{event.preventDefault();setNotice("درخواست نمونه آماده است؛ ارسال واقعی پس از اتصال سامانه پشتیبانی فعال می‌شود.");}}><div className={styles.supportFormGrid}><label><span>شماره سفارش مرتبط (اختیاری)</span><input name="orderNumber" inputMode="numeric" dir="ltr" placeholder="نمونه: ۱۰۰۲۴۵۶" /></label><label><span>موضوع درخواست</span><input name="subject" placeholder="مثال: مغایرت فاکتور، مشکل در پرداخت، خطای اعتبارسنجی..." required /></label><label className={styles.supportMessage}><span>متن پیام و توضیحات مشکل</span><textarea name="message" placeholder="جزئیات درخواست خود را با ذکر نام فروشگاه و زمان حدودی بنویسید..." rows={3} required /></label></div><div className={styles.supportActions}><button type="submit">ثبت و ارسال پیام به پشتیبانی</button><Link href="tel:02191004304">تماس مستقیم با پشتیبانی تلفنی (۰۲۱-۹۱۰۰۴۳۰۴)</Link></div></form></section>
    <section className={styles.tickets}><div className={styles.sectionHeading}><h2>درخواست‌های قبلی و پیگیری پیام‌ها</h2></div>{tickets.map(ticket=><article className={styles.ticket} key={ticket.id}><div className={styles.ticketMeta}><span className={styles.badge}>{ticket.status}</span><span>تاریخ ثبت: {ticket.date}</span></div><div><h3>{ticket.title}</h3><span className={styles.ticketId}>{ticket.id}</span><p>{ticket.detail}</p></div></article>)}<Link className={styles.call} href="tel:02100000000">تماس با پشتیبانی تلفنی</Link></section></>}
   {notice&&<p className={styles.notice} role="status">{notice}</p>}
  </section>
  
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
