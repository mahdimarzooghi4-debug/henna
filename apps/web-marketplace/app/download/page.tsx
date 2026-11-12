import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../components/landing-chrome";
import styles from "./download.module.css";

const release = "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-1783-1";
const packages = [
  {
    id: "buyer",
    role: "خریدار",
    title: "اپلیکیشن خریدار حنا",
    description: "آشنایی و آزمایش تجربه خرید و مشاهده کالاها در نسخه پیش‌نمایش اندروید.",
    filename: "hana-buyer-preview.apk",
    checksum: "b4678532df09d6c68950da8ffa41ab6d1e99cd10b27c2f51237d18f1021e595c",
  },
  {
    id: "seller",
    role: "فروشنده",
    title: "اپلیکیشن فروشنده حنا",
    description: "آزمایش رابط فروشنده در نسخه پیش‌نمایش اندروید؛ بدون انجام عملیات واقعی فروش.",
    filename: "hana-seller-preview.apk",
    checksum: "6f67f11266306c796c0c711f7666b5ae4af1b66602196691fb4567d815c6e0ed",
  },
] as const;

export const metadata: Metadata = {
  title: "دریافت اپلیکیشن حنا | نسخه آزمایشی اندروید",
  description: "دریافت نسخه‌های آزمایشی اندروید خریدار و فروشنده حنا با لینک رسمی و اطلاعات بررسی صحت فایل.",
};

export default function DownloadAppPage() {
  return (
    <>
      <LandingHeader />
      <main className={styles.page} dir="rtl" data-testid="download-app-page">
        <div className={styles.container}>
          <div className={styles.intro}>
            <span className={styles.eyebrow}>اپلیکیشن اندروید حنا</span>
            <h1>دریافت اپلیکیشن حنا</h1>
            <p>برای خریداران و فروشندگان، دو نسخه جداگانه پیش‌نمایش اندروید در دسترس است. نسخه موردنظر خود را انتخاب کنید.</p>
          </div>
          <aside className={styles.warning} role="note">
            <strong>این فایل‌ها نسخه آزمایشی اندروید هستند.</strong>
            <p>نسخه‌های حاضر با امضای آزمایشی ساخته شده‌اند، انتشار رسمی یا فروشگاهی نیستند و مناسب استفاده تجاری واقعی نیستند. از آن‌ها برای پرداخت، سفارش یا عملیات واقعی فروش استفاده نکنید. نسخه بومی iOS در محدوده فعلی حنا قرار ندارد.</p>
          </aside>
          <section className={styles.cards} aria-label="نسخه‌های اپلیکیشن">
            {packages.map((app)=>(
              <article className={styles.card} key={app.id} data-testid={"app-download-"+app.id}>
                <div className={styles.cardHeader}>
                  <span className={styles.role}>{app.role}</span>
                  <span className={styles.status}>نسخه آزمایشی اندروید</span>
                </div>
                <h2>{app.title}</h2>
                <p>{app.description}</p>
                <a
                  className={styles.downloadLink}
                  href={release+"/"+app.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >دریافت نسخه آزمایشی {app.role}</a>
                <span className={styles.fileName} dir="ltr">{app.filename}</span>
                <div className={styles.digest}>
                  <strong>SHA-256 فایل آزمایشی</strong>
                  <code dir="ltr">{app.checksum}</code>
                </div>
              </article>
            ))}
          </section>
          <div className={styles.footnote}>
            <p>این بسته‌ها مربوط به پیش‌نمایش منتشرشده در ۲۰ آبان ۱۴۰۵ هستند و لزوماً شامل آخرین تغییرات نسخه وب نیستند.</p>
            <a href={release+"/SHA256SUMS.txt"} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">بررسی صحت فایل‌ها</a>
            <a href="https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-mobile-preview-1783-1" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">اطلاعات انتشار آزمایشی</a>
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
