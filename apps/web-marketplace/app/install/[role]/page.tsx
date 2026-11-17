import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingFooter, LandingHeader } from "../../../components/landing-chrome";
import { PwaActivation } from "../pwa-activation";
import styles from "../install.module.css";

type Props = { params: Promise<{role: string}> };
const applications = {
  buyer: { label: "خریدار", start: "/products", name: "حنا - خریدار" },
  seller: { label: "فروشنده", start: "/seller", name: "حنا - فروشنده" },
} as const;
function select(role: string) {
  return role === "buyer" || role === "seller" ? applications[role] : null;
}
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {role} = await params;
  const app = select(role);
  if(!app) return {title: "حنا"};
  return {
    title: "نصب حنا برای آیفون | "+app.label,
    description: "راهنمای نصب نسخه وب حنا روی آیفون برای "+app.label,
    manifest: "/pwa-"+role+".webmanifest",
    appleWebApp: {capable: true, title: app.name, statusBarStyle: "default"},
    icons: {apple: "/pwa/icon-192.png"},
  };
}
export default async function InstallPwaPage({params}: Props) {
  const {role}=await params;
  const app=select(role);
  if(!app) notFound();
  return (
    <>
      <LandingHeader />
      <main className={styles.page} dir="rtl" data-testid={"install-ios-"+role}>
        <div className={styles.container}>
          <span className={styles.eyebrow}>نسخه قابل نصب برای iOS</span>
          <h1>نصب اپلیکیشن {app.label} حنا</h1>
          <p className={styles.description}>با افزودن نسخه وب حنا به صفحه اصلی آیفون، از آیکن اختصاصی آن وارد بخش {app.label} شوید. برای نصب به فایل IPA یا App Store نیاز نیست.</p>
          <PwaActivation startUrl={app.start} />
          <section className={styles.steps} aria-label="مراحل نصب در Safari">
            <h2>مراحل نصب در آیفون</h2>
            <ol>
              <li>این صفحه را با مرورگر <strong>Safari</strong> در آیفون باز کنید.</li>
              <li>از منوی صفحه، گزینه <strong>اشتراک‌گذاری (Share)</strong> را انتخاب کنید.</li>
              <li>روی <strong>افزودن به صفحه اصلی (Add to Home Screen)</strong> بزنید.</li>
              <li>گزینه <strong>Open as Web App</strong> را روشن نگه دارید و روی <strong>افزودن (Add)</strong> بزنید.</li>
            </ol>
          </section>
          <p className={styles.notice}>این نسخه به اینترنت نیاز دارد. قابلیت‌های مالی، پرداخت و فروش واقعی فقط پس از فعال‌شدن سرویس‌های مربوطه قابل استفاده‌اند.</p>
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
