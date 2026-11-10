"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./figma-buyer-account.module.css";

import { BuyerAccountNav } from "./buyer-account-nav";

export function FigmaBuyerAccount() {
  const [notice, setNotice] = useState("");

  return (
    <main className={styles.page} dir="rtl" data-testid="preview-account">
      <div className={styles.layout}>
        <BuyerAccountNav active="account" />
        <section className={styles.content} aria-label="حساب من">
          <article className={styles.legalCard} data-testid="preview-account-legal">
            <div className={styles.legalHeading}>
              <h2>خرید حقوقی</h2>
              <p>اطلاعات شرکت ثبت‌شده در حساب شما برای درخواست فاکتور رسمی هنگام خرید استفاده می‌شود.</p>
            </div>
            <div className={styles.legalState}>
              <strong>اطلاعات شرکت نمونه ثبت شده است</strong>
              <p>در زمان خرید با انتخاب گزینه خرید حقوقی، درخواست فاکتور رسمی به نام شرکت ثبت‌شده مشخص می‌شود.</p>
            </div>
            <div className={styles.legalActions}>
              <button className={styles.edit} type="button" onClick={() => setNotice("ویرایش اطلاعات شرکت در نسخه نمونه فعال نیست.")}>ویرایش اطلاعات</button>
              <button className={styles.view} type="button" onClick={() => setNotice("اطلاعات شرکت نمونه ثبت شده است.")}>مشاهده اطلاعات</button>
            </div>
            {notice && <p className={styles.notice} role="status">{notice}</p>}
          </article>
          <section className={styles.summary} data-testid="preview-account-summary">
            <h1>حساب من</h1>
            <p>همه بخش‌های حساب، سفارش‌ها، آدرس‌ها، روش‌های پرداخت و اعتبارهای شما در یک صفحه جمع‌وجور نمایش داده می‌شود.</p>
          </section>
          <article className={styles.infoCard} id="account-info" data-testid="preview-account-info">
            <h2>اطلاعات حساب</h2>
            <div className={styles.divider} />
            <dl className={styles.fields}>
              <div className={styles.fullField}><dt>نام و نام خانوادگی</dt><dd>کاربر نمونه</dd></div>
              <div><dt>ایمیل</dt><dd>ایمیل نمونه</dd></div>
              <div><dt>شماره تلفن همراه</dt><dd>شماره تماس نمونه</dd></div>
            </dl>
            <div className={styles.infoActions}>
              <Link href="/buyer/profile?mode=preview" className={styles.edit}>ویرایش اطلاعات حساب</Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
