import type { Metadata } from "next";
import Link from "next/link";
import styles from "./seller-app-preview.module.css";

const sellerAppPreview = "https://henna-seller-app-preview.onrender.com/";

export const metadata: Metadata = {
  title: "پیش‌نمایش کامل اپ فروشنده حنا",
  description: "مشاهده تعاملی نسخه موبایل اپ فروشنده حنا در سایت.",
};

export default function SellerAppPreviewPage() {
  return (
    <main className={styles.page} dir="rtl" data-testid="seller-app-preview-page">
      <header className={styles.bar}>
        <Link href="/download">بازگشت به اپلیکیشن‌ها</Link>
        <strong>پیش‌نمایش کامل اپ فروشنده حنا</strong>
        <a href={sellerAppPreview} target="_blank" rel="noopener noreferrer">بازکردن جداگانه</a>
      </header>
      <section className={styles.frame} aria-label="اپ فروشنده حنا">
        <iframe data-testid="seller-app-preview" title="اپ فروشنده حنا" src={sellerAppPreview}
          allow="clipboard-read; clipboard-write" referrerPolicy="strict-origin-when-cross-origin" />
      </section>
    </main>
  );
}
