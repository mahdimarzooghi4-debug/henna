import Image from "next/image";
import Link from "next/link";
import { LandingFooter, LandingHeader } from "../../components/landing-chrome";
import styles from "./empty-error-states.module.css";

const states = [
  {
    icon: "cart",
    title: "سبد خرید شما هنوز خالی است",
    text: "اقلام مورد نیاز خود نظیر نان گرم، لبنیات محلی و برنج را جست‌وجو کرده و به سبد خود اضافه کنید تا مقایسه قیمت‌ها انجام شود.",
    action: "مشاهده و جست‌وجوی کالاها",
    href: "/products",
  },
  {
    icon: "orders",
    title: "سفارشی در تاریخچه شما ثبت نشده است",
    text: "هنوز خریدی از بازارگاه محلی انجام نداده‌اید. اولین خرید شما موتور محرک توسعه و توانمندسازی فروشگاه‌های کوچک نزدیک خواهد بود.",
    action: "اولین سفارش خود را ثبت کنید",
    href: "/products",
  },
  {
    icon: "search",
    title: "نتیجه‌ای برای جست‌وجوی شما پیدا نشد",
    text: "ملاکی دقیق‌تر یا کلمه‌ای متفاوت را امتحان کنید. حنا تمامی اقلام توزیع محله‌ای را اسکن می‌کند تا بهترین پاسخ را بیابد.",
    action: "تغییر عبارت جست‌وجو",
    href: "/products",
  },
  {
    icon: "store",
    title: "فروشگاه مناسبی برای این سبد پیدا نشد",
    text: "ممکن است همه اقلام این سبد در فروشگاه‌های نزدیک موجود نباشد. می‌توانید سبد را ویرایش کرده یا دوباره جست‌وجو کنید.",
    action: "اصلاح اقلام سبد خرید",
    href: "/buyer/cart",
  },
  {
    icon: "award",
    title: "هیچ طرح حمایتی یا اعتباری برای کد ملی شما فعال نیست",
    text: "در حال حاضر اعتبار فعالی برای این حساب ثبت نشده است. برای اطلاعات بیشتر با پشتیبانی در ارتباط باشید.",
    action: "ثبت مجدد اطلاعات هویتی",
    href: "/auth",
  },
  {
    icon: "network",
    title: "اختلال در برقراری ارتباط با شبکه",
    text: "ارتباط شما با سامانه حنا قطع شده است. لطفاً وضعیت مودم یا شبکه تلفن همراه خود را بررسی کرده و مجدداً امتحان کنید.",
    action: "تلاش مجدد ارتباطی",
    href: "/empty-error-states",
  },
  {
    icon: "help",
    title: "متاسفانه خطایی در بارگذاری سامانه رخ داده است",
    text: "سیستم در حال حاضر با حجم بالایی از ترافیک مواجه است. آرامش خود را حفظ کنید؛ ما در تلاش برای برطرف کردن آن هستیم.",
    action: "به‌روزرسانی صفحه",
    href: "/empty-error-states",
  },
] as const;

export default function EmptyErrorStatesPage() {
  return (
    <div className={styles.page}>
      <LandingHeader referencePage />
      <main className={styles.main} dir="rtl">
        <header className={styles.heading}>
          <h1>مجموعه حالت‌های خالی و خطاهای کاربردی سامانه</h1>
          <p>این صفحه به عنوان یک مجموعه مرجع و یکپارچه، نشان‌دهنده خطاهای ساختاریافته و سناریوهای عدم وجود داده در بخش‌های مختلف حنا است.</p>
        </header>
        <section className={styles.grid} dir="ltr" aria-label="حالت‌های خالی و خطا">
          {states.map((state) => (
            <article className={styles.card} dir="rtl" key={state.icon}>
              <div className={styles.iconContainer}>
                <Image className={styles.icon} src={"/empty-error-states/" + state.icon + ".svg"} alt="" width={28} height={28} />
              </div>
              <div className={styles.copy}>
                <h2>{state.title}</h2>
                <p>{state.text}</p>
              </div>
              <Link className={styles.action} href={state.href}>{state.action}</Link>
            </article>
          ))}
          <article className={styles.privacy} dir="rtl">
            <Image className={styles.privacyIcon} src="/empty-error-states/help.svg" alt="" width={28} height={28} />
            <div>
              <h2>راهنمای حل مشکلات و حریم خصوصی</h2>
              <p>تمام تراکنش‌ها، موجودی‌ها و اعتبارهای حمایتی ثبت شده در حساب شما به صورت کاملاً کدگذاری شده و منطبق بر قوانین امنیت داده‌های اجتماعی نگهداری می‌شوند. در صورت بروز مکرر هر یک از این خطاها، با خط مستقیم ۲۴ ساعته پشتیبانی حنا تماس حاصل فرمایید.</p>
            </div>
          </article>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
