"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./figma-buyer-account.module.css";

const nav = [
  ["اطلاعات حساب", "#account-info"],
  ["آدرس‌های من", "/account/addresses"],
  ["سفارش‌های من", "/buyer/orders?mode=preview"],
  ["روش‌های پرداخت", "#payments"],
  ["اعتبارهای من", "/benefits#food-credit"],
  ["طرح‌های فعال", "/benefits#special-plans"],
  ["مشارکت‌های اجتماعی", "/social"],
  ["پشتیبانی", "/support"],
  ["تنظیمات", "#settings"],
];

export function FigmaBuyerAccount() {
  const [legalPurchase, setLegalPurchase] = useState(false);

  return (
    <main className={styles.page} dir="rtl" data-testid="preview-account">
      <div className={styles.layout}>
        <aside className={styles.navCard} aria-label="بخش‌های حساب کاربری">
          {nav.map(([label, href], index) => (
            <Link key={label} href={href} aria-current={index === 0 ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </aside>
        <section className={styles.content} aria-label="حساب من">
          <article className={styles.legalCard} data-testid="preview-account-legal">
            <h2>خرید حقوقی</h2>
            <label className={styles.legalOption}>
              <input type="checkbox" checked={legalPurchase}
                onChange={event => setLegalPurchase(event.target.checked)}
                aria-describedby="preview-legal-help" />
              <span>درخواست صدور فاکتور رسمی</span>
            </label>
            <p id="preview-legal-help">با انتخاب این گزینه، درخواست صدور فاکتور رسمی برای خریدهای شما در آینده مشخص می‌شود.</p>
            <p className={styles.previewNote}>نسخه نمایشی؛ انتخاب در این صفحه آزمایشی است و فاکتور رسمی صادر نمی‌شود.</p>
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
