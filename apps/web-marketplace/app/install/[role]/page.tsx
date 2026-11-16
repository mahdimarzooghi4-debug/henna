import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingFooter, LandingHeader } from "../../../components/landing-chrome";
import { PwaActivation } from "../pwa-activation";
import styles from "../install.module.css";

type Props = { params: Promise<{role: string}> };
const applications = {
  buyer: { label: "خریدار", start: "/", name: "حنا خریدار", icon: "/pwa/buyer-icon-512.png" },
  seller: { label: "فروشنده", start: "/seller", name: "حنا فروشنده", icon: "/pwa/seller-icon-512.png" },
} as const;
function select(role: string) {
  return role === "buyer" || role === "seller" ? applications[role] : null;
}
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {role} = await params;
  const app = select(role);
  if(!app) return {title: "حنا"};
  return {
    title: "نصب PWA حنا | "+app.label,
    description: "نصب نسخه وب حنا برای "+app.label+" روی تلفن همراه یا رایانه.",
    manifest: "/pwa-"+role+".webmanifest",
    appleWebApp: {capable: true, title: app.name, statusBarStyle: "default"},
    icons: {apple: app.icon},
  };
}
export default async function InstallPwaPage({params}: Props) {
  const {role}=await params;
  const app=select(role);
  if(!app) notFound();
  return (
    <>
      <LandingHeader />
      <main className={styles.page} dir="rtl" data-testid={"install-pwa-"+role}>
        <div className={styles.container}>
          <span className={styles.eyebrow}>نسخه وب قابل نصب (PWA)</span>
          <h1>نصب اپلیکیشن {app.label} حنا</h1>
          <p className={styles.description}>نسخه وب‌اپ {app.label} حنا را با نام و آیکون اختصاصی به صفحه اصلی اضافه کنید. در اندروید و Chrome امکان نصب مستقیم وجود دارد؛ در آیفون، آن را از Safari به صفحه اصلی اضافه کنید.</p>
          <PwaActivation startUrl={app.start} label={app.label} />
          <section className={styles.steps} aria-label="مراحل نصب در اندروید و Chrome">
            <h2>نصب در اندروید و Chrome</h2>
            <ol>
              <li>اگر دکمه نصب بالای صفحه نمایش داده شد، آن را انتخاب کنید.</li>
              <li>در غیر این صورت، منوی سه‌نقطه Chrome را باز کنید و <strong>Install app</strong> یا <strong>Add to Home screen</strong> را بزنید.</li>
              <li>پس از تأیید، آیکون «حنا {app.label}» در صفحه اصلی دستگاه قرار می‌گیرد.</li>
            </ol>
          </section>
          <section className={styles.steps} aria-label="مراحل نصب در Safari آیفون">
            <h2>نصب در آیفون و Safari</h2>
            <ol>
              <li>این صفحه را با مرورگر <strong>Safari</strong> در آیفون یا آیپد باز کنید.</li>
              <li>از منوی صفحه، گزینه <strong>اشتراک‌گذاری (Share)</strong> را انتخاب کنید.</li>
              <li>روی <strong>افزودن به صفحه اصلی (Add to Home Screen)</strong> بزنید.</li>
              <li>گزینه <strong>Open as Web App</strong> را روشن نگه دارید و روی <strong>افزودن (Add)</strong> بزنید.</li>
            </ol>
          </section>
          <p className={styles.notice}>این نسخه به اینترنت نیاز دارد. نصب PWA فقط میان‌بری مستقل برای نسخه وب است؛ ورود، دسترسی‌ها و امکانات به حساب فروشنده یا خریدار وابسته‌اند. پرداخت و فروش واقعی در این پیش‌نمایش فعال نیست.</p>
          <div className={styles.links}>
            <Link href={app.start}>ورود به نسخه وب {app.label}</Link>
            <Link href="/download">بازگشت به دریافت اپلیکیشن</Link>
          </div>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
