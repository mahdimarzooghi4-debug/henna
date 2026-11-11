"use client";
import {useState} from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./seller-registration-start.module.css";

const benefits=[
  ["مدیریت کالاها و خدمات","بارگذاری، ویرایش و تنظیم قیمت برای کالاها و خدمات شخصی یا محلی."],
  ["دریافت و مدیریت سفارش‌ها","دریافت و مدیریت سفارش‌ها از طریق پنل فروشنده."],
  ["مدیریت موجودی و دسترس‌پذیری","کنترل موجودی انبار یا ساعات ارائه خدمت به صورت آنلاین."],
  ["مشاهده وضعیت مالی و تسویه","مشاهده وضعیت مالی و اطلاعات تسویه در پنل فروشنده."],
] as const;

export function SellerRegistrationStart(){
  const [returning,setReturning]=useState(false);
  return <>
    <section className={styles.grid} data-testid="seller-register-start-desktop">
      <div className={styles.panel}>
        <Image className={styles.logo} src="/hana-logo.png" alt="حنا" width={147} height={82} unoptimized />
        <h1>ثبت‌نام فروشنده / ارائه‌دهنده</h1>
        <p>برای ارائه کالا یا خدمت در بازارگاه حنا، مراحل ثبت‌نام کسب‌وکار را تکمیل کنید.</p>
        <div className={styles.buttons}>
          <Link className={styles.primary} href="/seller/register/new">شروع ثبت‌نام جدید</Link>
          <button type="button" className={styles.secondary} onClick={()=>setReturning(s=>!s)}
            aria-expanded={returning} aria-controls="seller-returning-actions-desktop">
            قبلاً ثبت‌نام کرده‌ام
          </button>
        </div>
        <div className={styles.returning} id="seller-returning-actions-desktop">
          <h2>پیگیری پرونده قبلی:</h2>
          <div className={styles.returnButtons}>
            <Link href="/seller/register/public-status">مشاهده وضعیت درخواست</Link>
            <Link href="/seller/register/account">ادامه ثبت‌نام</Link>
          </div>
          {returning&&<p role="status" className={styles.note}>
            درخواست جدید بدون ورود ثبت می‌شود. پرونده‌های قدیمی متصل به حساب،
            از مسیر جداگانه ادامه پیدا می‌کنند.
          </p>}
        </div>
      </div>
      <div className={styles.panel}>
        <h2 className={styles.benefitsHeading}>امکانات پنل فروشنده / ارائه‌دهنده</h2>
        <div className={styles.benefits}>
          {benefits.map(([title,description])=><div key={title} className={styles.benefit}>
            <span className={styles.star} aria-hidden="true">☆</span>
            <div><strong>{title}</strong><p>{description}</p></div>
          </div>)}
        </div>
        <p className={styles.disclaimer}>دسترسی به پنل فقط پس از بررسی و فعال‌سازی مستقل فروشندگی ممکن است.</p>
      </div>
    </section>
    <section className={styles.mobileStart} data-testid="seller-register-start-mobile">
      <div className={styles.mobileHero}>
        <div className={styles.mobileBadgeRow}>
          <span>ثبت‌نام جدید</span>
          <span className={styles.mobileHanaTag}>بازارگاه اجتماعی</span>
        </div>
        <h1>ثبت‌نام فروشنده / ارائه‌دهنده</h1>
        <p className={styles.mobileIntro}>برای ارائه کالا یا خدمت در بازارگاه حنا، مراحل ثبت‌نام کسب‌وکار را تکمیل کنید.</p>
        <div className={styles.mobileBenefits}>
          {benefits.map(([title,description])=><div key={title} className={styles.mobileBenefit}>
            <span className={styles.mobileStar} aria-hidden="true">☆</span>
            <div><strong>{title}</strong><p>{description}</p></div>
          </div>)}
        </div>
      </div>
      <div className={styles.mobileActions}>
        <Link aria-label="شروع ثبت‌نام جدید" className={styles.primary} href="/seller/register/new">شروع ثبت‌نام</Link>
        <button type="button" className={styles.secondary} onClick={()=>setReturning(s=>!s)}
          aria-expanded={returning} aria-controls="seller-returning-actions-mobile">
          قبلاً ثبت‌نام کرده‌ام
        </button>
        <div className={styles.mobileReturning} id="seller-returning-actions-mobile">
          <h2>پیگیری درخواست قبلی:</h2>
          <div className={styles.mobileReturnButtons}>
            <Link href="/seller/register/account">ادامه ثبت‌نام</Link>
            <Link href="/seller/register/public-status">مشاهده وضعیت درخواست</Link>
          </div>
          {returning&&<p role="status" className={styles.note}>
            درخواست جدید بدون ورود ثبت می‌شود. پرونده‌های قدیمی متصل به حساب،
            از مسیر جداگانه ادامه پیدا می‌کنند.
          </p>}
        </div>
      </div>
    </section>
  </>;
}
