import Link from "next/link";
import type { ReactNode } from "react";

const purchaseSteps = [
  ["پیدا کردن کالا یا خدمت", "از جست‌وجو و دسته‌بندی‌ها برای پیدا کردن کالا یا خدمت استفاده کنید."],
  ["افزودن به سبد", "کالا یا خدمت موردنظر را به سبد اضافه کنید."],
  ["تکمیل سبد", "اقلام موردنیاز را در سبد بررسی و تکمیل کنید."],
  ["مقایسه فروشگاه‌های نزدیک", "مقایسه می‌تواند قیمت کل سبد، کامل بودن سبد، فاصله و شرایط ارسال یا زمان تقریبی را، در صورت ثبت و در دسترس بودن، در نظر بگیرد."],
  ["انتخاب فروشگاه", "فروشگاه مناسب را بر اساس اطلاعات مقایسه انتخاب کنید."],
  ["بررسی سبد انتخاب‌شده", "اقلام سبد انتخاب‌شده از فروشگاه موردنظر را بررسی و نهایی کنید."],
  ["تکمیل اطلاعات، پرداخت و ثبت سفارش", "اطلاعات گیرنده، نشانی و روش ارسال را تکمیل کنید، روش پرداخت را انتخاب و سفارش را ثبت کنید."],
  ["پیگیری سفارش", "وضعیت ثبت‌شده سفارش را از بخش سفارش‌ها مشاهده کنید."],
];

const sellerSteps = [
  ["شروع ثبت‌نام", "شروع درخواست از همان حساب کاربری موجود."],
  ["انتخاب نوع متقاضی", "تعیین ماهیت فعالیت کسب‌وکار بین دو گزینه رسمی «شخص حقیقی» یا «شخص حقوقی»."],
  ["اطلاعات هویتی", "ثبت اطلاعات هویتی موردنیاز. برای متقاضیان حقیقی، اطلاعاتی مانند کد ملی ممکن است از طریق فرایندهای مجاز بررسی شود."],
  ["اطلاعات کسب‌وکار", "ثبت اطلاعات موردنیاز درباره کسب‌وکار و راه‌های تماس."],
  ["محدوده فعالیت", "ثبت محدوده فعالیت و اطلاعات مرتبط با ارائه کالا یا خدمت."],
  ["اطلاعات تکمیلی", "ثبت اطلاعات تکمیلی موردنیاز برای تکمیل پرونده درخواست."],
  ["بازبینی اطلاعات و ثبت درخواست", "بازبینی تمام اطلاعات ثبت‌شده و ارسال درخواست نهایی برای بررسی."],
  ["پیگیری وضعیت درخواست", "پیگیری وضعیت درخواست ثبت‌شده از بخش مربوطه."],
  ["شروع فعالیت پس از تأیید نهایی", "شروع فعالیت فروش یا ارائه خدمت فقط پس از تأیید نهایی درخواست امکان‌پذیر است."],
];

const termsSections = ["تعاریف", "حساب کاربری", "استفاده از بازارگاه", "سفارش و پرداخت", "فروشندگان و ارائه‌دهندگان", "طرح‌ها و اعتبارها", "مسئولیت کاربران", "پشتیبانی", "تغییرات شرایط استفاده"];
const privacySections = ["اطلاعاتی که کاربر ثبت می‌کند", "اطلاعات موردنیاز برای ارائه خدمات", "امنیت حساب", "اطلاعات سفارش", "اطلاعات فروشندگی", "وضعیت‌های مرتبط با حساب", "دسترسی و مدیریت اطلاعات", "تغییرات سیاست حریم خصوصی"];

export function InfoPageTitle({ eyebrow, title, description }: {
  eyebrow: string; title: string; description: string;
}) {
  return <header className="info-title"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></header>;
}

function InfoCard({ title, children, className = "" }: {
  title: string; children: ReactNode; className?: string;
}) {
  return <article className={`info-card ${className}`}><h2>{title}</h2>{children}</article>;
}

function Steps({ items }: { items: string[][] }) {
  return <div className="info-steps">{items.map(([title, description], index) => <article className="info-step" key={title}><span className="info-step__number">{(index + 1).toLocaleString("fa-IR")}</span><div><h2>{title}</h2><p>{description}</p></div></article>)}</div>;
}

export function AboutPage() {
  return <>
    <section className="info-about-hero">
      <div className="info-about-art" aria-hidden="true"><span className="info-orbit info-orbit--one"/><span className="info-orbit info-orbit--two"/><span className="info-art-dot info-art-dot--one"/><span className="info-art-dot info-art-dot--two"/><span className="info-art-dot info-art-dot--three"/><div className="info-art-card"><b>حنا</b><span>بازارگاه کالا و خدمات</span></div></div>
      <div className="info-about-copy"><span className="info-eyebrow">درباره ما</span><h1>پیوند انسان‌ها برای فردایی بهتر</h1><p>حنا بستری برای پیوند خرید، عرضه کالا و خدمات و مشارکت اجتماعی در یک تجربه یکپارچه است.</p><Link className="info-button" href="/products">ورود به بازارگاه</Link></div>
    </section>
    <InfoCard title="حنا چیست؟" className="info-about-definition"><p>حنا بازارگاهی چنددسته‌ای برای دسترسی به کالاها و خدمات و ارتباط کاربران با فروشندگان و ارائه‌دهندگان است.</p></InfoCard>
    <section className="info-section"><InfoPageTitle eyebrow="" title="چرا حنا؟" description="مزایای کلیدی حضور در خانواده بزرگ ما"/><div className="info-grid info-grid--4">{[["دسترسی ساده‌تر","امکانات جست‌وجو و مقایسه اطلاعات، انتخاب را برای کاربران ساده‌تر می‌کند."],["ارتباط خریدار و ارائه‌دهنده","ارتباط خریداران با فروشندگان و ارائه‌دهندگان کالا و خدمات در یک تجربه یکپارچه."],["طرح‌ها و اعتبارها","امکان استفاده از طرح‌ها و اعتبارهای مرتبط، فقط در صورت ثبت و نمایش آن‌ها روی همان حساب."],["مشارکت اجتماعی","حنا امکان مشارکت اجتماعی را در کنار تجربه بازارگاه معرفی می‌کند."]].map(([title,body])=><InfoCard key={title} title={title}><p>{body}</p></InfoCard>)}</div></section>
    <section className="info-section"><InfoPageTitle eyebrow="" title="بازیگران حنا" description="بازیگران بازارگاه حنا"/><div className="info-grid info-grid--4">{[["ارائه‌دهندگان خدمات مکمل","ارائه‌دهندگان خدمات مکمل که در صورت اتصال به حنا، اطلاعات مرتبط با ارسال یا ارائه خدمت را پشتیبانی می‌کنند."],["سازمان‌ها و نهادهای مرتبط","سازمان‌ها و نهادهایی که در صورت تعریف همکاری یا طرح مرتبط، می‌توانند از ظرفیت‌های حنا استفاده کنند."],["فروشندگان و ارائه‌دهندگان","فروشندگان و ارائه‌دهندگانی که کالاها یا خدمات خود را در بازارگاه عرضه می‌کنند."],["کاربران","کاربرانی که برای دسترسی به کالاها و خدمات از بازارگاه حنا استفاده می‌کنند."]].map(([title,body])=><InfoCard key={title} title={title}><p>{body}</p></InfoCard>)}</div></section>
    <section className="info-section"><InfoPageTitle eyebrow="" title="ارزش‌های حنا" description="باورهایی که ما را در این مسیر راهنمایی می‌کنند"/><div className="info-values">{["امید","رشد","حمایت","اتصال","انسان‌محوری"].map((value,index)=><div className="info-value" key={value}><span>{["✳","↗","♡","↗","◎"][index]}</span><b>{value}</b></div>)}</div></section>
  </>;
}

const supportAreas = [
  ["ثبت و پیگیری سفارش", "ثبت درخواست پشتیبانی درباره سفارش و پیگیری وضعیت ثبت‌شده آن."],
  ["حساب کاربری و هویت", "ثبت درخواست پشتیبانی درباره ورود و اطلاعات حساب کاربری."],
  ["پرداخت و فاکتورها", "ثبت درخواست پشتیبانی درباره پرداخت، فاکتور رسمی و وضعیت تراکنش."],
  ["فروشندگی و ارائه خدمت", "راهنمای عمومی برای ثبت درخواست فروشندگی و استفاده از بخش‌های مرتبط سامانه."],
  ["استفاده از سامانه و طرح‌ها", "ثبت درخواست پشتیبانی درباره استفاده از سامانه."],
];

export function SupportPage() {
  return <>
    <InfoPageTitle eyebrow="مرکز راهنمایی" title="تماس و پشتیبانی" description="در بخش پشتیبانی می‌توانید برای موضوعات مرتبط با سفارش، حساب، پرداخت، فروشندگی و استفاده از سامانه درخواست ثبت کنید."/>
    <div className="info-support-layout"><aside className="info-support-aside"><InfoCard title="اطلاعات تماس رسمی"><p>اطلاعات تماس رسمی پس از ثبت نمایش داده می‌شود.</p><p>برای ثبت و پیگیری درخواست پشتیبانی از بخش پشتیبانی حساب کاربری استفاده کنید.</p></InfoCard><InfoCard title="پشتیبانی حساب کاربری" className="info-card--tint"><p>برای ثبت و پیگیری درخواست پشتیبانی از بخش پشتیبانی حساب کاربری استفاده کنید.</p><Link className="info-button info-button--dark" href="/auth">ورود به پشتیبانی</Link></InfoCard></aside><section className="info-support-main"><h2>چطور می‌توانیم به شما کمک کنیم؟</h2>{supportAreas.map(([title,body],index)=><InfoCard key={title} title={title} className="info-support-item"><span className="info-support-icon" aria-hidden="true">{["▣","♙","▤","♧","?"][index]}</span><p>{body}</p></InfoCard>)}</section></div>
  </>;
}

const faqItems = [
  ["حنا چیست؟", "حساب کاربری", "بازارگاهی چنددسته‌ای برای دسترسی به کالاها و خدمات و ارتباط کاربران با فروشندگان و ارائه‌دهندگان."],
  ["چطور خرید کنم؟", "خرید و سفارش", "کالا / خدمت → سبد → مقایسه فروشگاه‌های نزدیک → انتخاب فروشگاه → بررسی سبد → تکمیل اطلاعات و پرداخت → ثبت سفارش"],
  ["چطور فروشگاه‌های نزدیک برای سبد من مقایسه می‌شوند؟", "خرید و سفارش", "پس از انتخاب کالا یا خدمت، مسیر خرید به این ترتیب ادامه پیدا می‌کند: کالا / خدمت ← سبد ← مقایسه فروشگاه‌های نزدیک ← انتخاب فروشگاه ← بررسی سبد انتخاب‌شده ← تکمیل اطلاعات گیرنده و پرداخت ← ثبت سفارش. مقایسه می‌تواند قیمت کل سبد، کامل بودن سبد، فاصله و شرایط ارسال ثبت‌شده را در نظر بگیرد."],
  ["آیا همه کاربران اعتبار حمایتی دارند؟", "طرح‌ها و اعتبارها", "خیر. اعتبار حمایتی فقط در صورت تخصیص و احراز شرایط مرتبط روی همان حساب نمایش داده می‌شود."],
  ["آیا اعتبار حمایتی برای خرید حقوقی قابل استفاده است؟", "طرح‌ها و اعتبارها", "خیر. اعتبار حمایتی فقط برای خرید شخصی قابل استفاده است."],
  ["چطور خرید حقوقی انجام دهم؟", "خرید حقوقی", "اطلاعات شرکت را ثبت کنید و هنگام ثبت سفارش گزینه «خرید حقوقی و دریافت فاکتور رسمی» را فعال کنید."],
];

export function FaqPage() {
  return <><InfoPageTitle eyebrow="پاسخ به سوالات شما" title="سوالات متداول" description="پاسخ‌های شفاف و استاندارد به پرسش‌های رایج کاربران درباره عملکرد بازارگاه حنا، طرح‌ها و تراکنش‌ها."/><section className="info-faq">{faqItems.map(([question,category,answer])=><details className="info-faq-item" key={question}><summary><span className="info-faq-category">{category}</span><b>{question}</b><span className="info-chevron" aria-hidden="true">⌄</span></summary><p>{answer}</p></details>)}</section></>;
}

export function BuyerGuidePage() {
  return <><InfoPageTitle eyebrow="راهنمای گام‌به‌گام خرید" title="راهنمای خرید از حنا" description="راهنمای مراحل خرید کالا یا خدمت در بازارگاه حنا."/><Steps items={purchaseSteps}/></>;
}

export function SellerGuidePage() {
  return <><InfoPageTitle eyebrow="راهنمای جامع فروش" title="راهنمای فروشندگان و ارائه‌دهندگان" description="مراحل عمومی ثبت درخواست برای عرضه کالا و خدمات در بازارگاه چنددسته‌ای حنا."/><div className="info-seller-layout"><aside className="info-seller-aside"><InfoCard title="شفافیت و احراز هویت"><p>برای متقاضیان حقیقی، اطلاعات هویتی مانند کد ملی ممکن است از طریق فرایندهای مجاز بررسی شود.</p><p>در صورت شناسایی وضعیت حمایتی، این وضعیت ویژگی همان حساب باقی می‌ماند. جزئیات حساس در این راهنما نمایش داده نمی‌شود.</p></InfoCard><InfoCard title="آغاز عرضه کالا و خدمات" className="info-card--tint"><p>همه کاربران واجد شرایط می‌توانند درخواست خود را برای عرضه مستقیم کالا و خدمت ارسال کنند.</p><Link className="info-button info-button--dark" href="/seller/register">ثبت‌نام فروشنده / ارائه‌دهنده</Link></InfoCard></aside><Steps items={sellerSteps}/></div></>;
}

const programTypes = [
  ["طرح‌های ویژه", "در صورت تعریف و فعال بودن طرح مرتبط، جزئیات آن در حساب نمایش داده می‌شود."],
  ["اعتبار سازمانی", "در صورت ثبت اعتبار مرتبط، جزئیات و شرایط استفاده در همان حساب نمایش داده می‌شود."],
  ["کالابرگ", "در صورت ثبت برای حساب، شرایط و دامنه استفاده آن در همان طرح نمایش داده می‌شود."],
  ["اعتبار حمایتی", "در صورت تخصیص و ثبت برای همان حساب نمایش داده می‌شود."],
];

export function ProgramsGuidePage() {
  return <><InfoPageTitle eyebrow="تسهیلات و اعتبارات" title="راهنمای طرح‌ها و اعتبارها" description="راهنمای آشنایی با طرح‌ها و اعتبارهایی که ممکن است برای یک حساب ثبت و نمایش داده شوند."/><div className="info-notice"><span aria-hidden="true">ⓘ</span><p>همه کاربران طرح یا اعتبار فعال ندارند. هر مورد فقط در صورت ثبت برای همان حساب نمایش داده می‌شود.</p></div><section className="info-section"><h2 className="info-section-title">انواع طرح‌ها و ساختار اعتباری حنا</h2><div className="info-grid info-grid--4">{programTypes.map(([title,body])=><InfoCard key={title} title={title}><p>{body}</p></InfoCard>)}</div></section><div className="info-program-layout"><InfoCard title="تفاوت اعتبار حمایتی و شخصی" className="info-card--tint"><b className="info-accent">کاربری اعتبار حمایتی:</b><p>«اعتبار حمایتی فقط برای خرید شخصی قابل استفاده است.»</p><b className="info-accent">کاربری اعتبار شخصی:</b><p>«اعتبار شخصی تأمین‌شده توسط کاربر، در صورت وجود و امکان استفاده، می‌تواند در خرید حقوقی نیز قابل استفاده باشد.»</p></InfoCard><div className="info-program-text"><h2>طرح و اعتبار چیست و چه زمانی نمایش داده می‌شود؟</h2><p>طرح‌ها و اعتبارها فقط در صورت ثبت برای همان حساب نمایش داده می‌شوند. جزئیات قابل استفاده هر مورد در همان بخش نمایش داده می‌شود.</p><h2>نحوه استفاده هنگام خرید</h2><p>در صورت امکان استفاده، گزینه مرتبط هنگام خرید نمایش داده می‌شود. کاربر می‌تواند اطلاعات همان گزینه را پیش از ثبت سفارش بررسی کند.</p><Link className="info-text-link" href="/auth">ورود به حساب کاربری</Link></div></div></>;
}

export function TermsPage() {
  return <><InfoPageTitle eyebrow="قوانین بازارگاه" title="شرایط استفاده" description="این بخش محل درج متن نهایی و تأییدشده درباره شرایط استفاده است."/><div className="info-notice info-notice--warning"><span aria-hidden="true">△</span><p>متن نهایی این صفحه باید پس از تأیید حقوقی جایگزین شود.</p></div><section className="info-legal">{termsSections.map(title=><InfoCard key={title} title={title}><p>این بخش محل درج متن نهایی درباره {title} است.</p></InfoCard>)}</section></>;
}

export function PrivacyPage() {
  return <><InfoPageTitle eyebrow="امنیت اطلاعات" title="حریم خصوصی" description="این صفحه ساختار پیشنهادی برای ارائه سیاست حریم خصوصی است و متن نهایی پس از تأیید حقوقی تکمیل می‌شود."/><div className="info-notice info-notice--warning"><span aria-hidden="true">♢</span><p>متن نهایی این صفحه باید بر اساس سیاست رسمی حریم خصوصی و پس از تأیید حقوقی تکمیل شود.</p></div><section className="info-legal">{privacySections.map((title,index)=><InfoCard key={title} title={title}><p>{index===7?"روند اطلاع‌رسانی به کاربران در خصوص تغییر در نحوه پردازش اطلاعات شخصی.":`این بخش محل درج متن نهایی درباره ${title} است.`}</p></InfoCard>)}</section></>;
}

export function InformationFooter() {
  return <footer className="info-footer"><div className="info-footer__grid"><div className="info-footer__column"><h2>قوانین</h2><Link href="/terms">شرایط استفاده</Link><Link href="/privacy">حریم خصوصی</Link></div><div className="info-footer__column"><h2>همکاری با حنا</h2><Link href="/seller/register">ثبت‌نام فروشنده / ارائه‌دهنده</Link><Link href="/seller">ورود به پنل فروشندگان</Link></div><div className="info-footer__column"><h2>راهنما</h2><Link href="/buyer-guide">راهنمای خرید</Link><Link href="/seller-guide">راهنمای فروشندگان و ارائه‌دهندگان</Link><Link href="/programs">راهنمای طرح‌ها و اعتبارها</Link></div><div className="info-footer__column"><h2>«حنا»</h2><Link href="/about">درباره حنا</Link><Link href="/support">تماس با ما</Link><Link href="/faq">سوالات متداول</Link></div><div className="info-footer__brand"><Link href="/" aria-label="صفحه اصلی حنا"><img src="/hana-logo.png" alt="حنا"/></Link><p>بازارگاه حنا؛ بستری چنددسته‌ای برای دسترسی یکپارچه به کالاها، خدمات و پیوند دادن نیازهای روزمره به ارزش‌آفرینی و مشارکت پایدار اجتماعی است.</p></div></div><div className="info-footer__bottom"><span aria-hidden="true">■</span><p>© حنا — متن حقوقی نهایی پس از تأیید تکمیل می‌شود.</p></div></footer>;
}
