"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "./seller-registration-start.module.css";

export function SellerRegistrationStart() {
  function showReturning() {
    document.getElementById("seller-returning-actions")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  return (
    <section className={styles.grid} data-testid="seller-register-start">
      <div className={styles.panel}>
        <Image
          className={styles.logo}
          src="/hana-logo.png"
          alt="حنا"
          width={147}
          height={82}
          unoptimized
        />
        <h1>ثبت‌نام فروشنده</h1>
        <p>
          برای فروش کالا در بازارگاه حنا، مراحل ثبت‌نام فروشگاه خود را تکمیل کنید.
        </p>
        <div className={styles.buttons}>
          <Link className={styles.primary} href="/seller/register/new">
            شروع ثبت‌نام جدید
          </Link>
          <button
            type="button"
            className={styles.secondary}
            onClick={showReturning}
            aria-controls="seller-returning-actions"
          >
            قبلاً ثبت‌نام کرده‌ام
          </button>
        </div>
        <div className={styles.returning} id="seller-returning-actions">
          <h2>پیگیری پرونده قبلی:</h2>
          <div className={styles.returnButtons}>
            <Link href="/seller/register/public-status">مشاهده وضعیت درخواست</Link>
            <Link href="/seller/register/account">ادامه ثبت‌نام</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
