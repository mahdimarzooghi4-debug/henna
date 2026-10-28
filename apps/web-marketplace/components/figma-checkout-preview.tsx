"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./figma-checkout-preview.module.css";
import { LANDING_PREVIEW_CART_EVENT, LANDING_PREVIEW_PRODUCTS, readLandingPreviewCart, type LandingPreviewCartItem } from "../lib/landing-preview-products";

const selectedSellerKey = "henna:figma-preview-selected-seller:v1";
const sellers: Record<string, string> = {
  "store-3": "فروشگاه نمونه ۳ (محله رسالت)",
  "store-1": "فروشگاه نمونه ۱ (محله رسالت)",
  "store-2": "فروشگاه نمونه ۲ (محله رسالت)",
};
function amount(value: string) {
  return Number(value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٬,]/g, "")) || 0;
}
const format = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export function FigmaCheckoutPreview() {
  const [items, setItems] = useState<LandingPreviewCartItem[]>([]);
  const [sellerId, setSellerId] = useState("store-1");
  const [payment, setPayment] = useState("online");
  const [legal, setLegal] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setItems(readLandingPreviewCart());
    try { setSellerId(window.localStorage.getItem(selectedSellerKey) ?? "store-1"); } catch { /* preview default */ }
    const sync = () => setItems(readLandingPreviewCart());
    window.addEventListener(LANDING_PREVIEW_CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANDING_PREVIEW_CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const subtotal = items.reduce((sum, item) => {
    const product = LANDING_PREVIEW_PRODUCTS.find((entry) => entry.id === item.productId);
    return sum + (product ? amount(product.price) * item.quantity : 0);
  }, 0);
  const selectedSeller = sellers[sellerId] ?? sellers["store-1"];

  if (!items.length) return <main className={styles.page} dir="rtl"><section className={styles.empty}>
    <h1>سبد خرید خالی است</h1><p>برای تکمیل سفارش، ابتدا کالاها را به سبد اضافه کنید.</p>
    <Link href="/#offers">رفتن به کالاها</Link>
  </section></main>;

  return <main className={styles.page} dir="rtl">
    <div className={styles.layout}>
      <aside className={styles.side}>
        <section className={styles.summary}>
          <h2>خلاصه سفارش</h2>
          <div><span>مجموع اقلام:</span><strong>{format(subtotal)} تومان</strong></div>
          <div><span>کد تخفیف:</span><strong className={styles.terracotta}>-</strong></div>
          <div><span>هزینه ارسال محلی:</span><strong>رایگان</strong></div>
          <div><span>اعتبار حمایتی:</span><strong>در صورت موجود بودن</strong></div>
          <div><span>اعتبار شخصی:</span><strong>اعتبار شخصی تأمین‌شده توسط کاربر</strong></div>
          <div className={styles.total}><span>مبلغ قابل پرداخت:</span><strong>{format(subtotal)} تومان</strong></div>
          <button type="button" className={styles.primary} onClick={() => setNotice("این صفحه پیش‌نمایش است؛ سفارش واقعی ثبت نمی‌شود.")}>ثبت سفارش</button>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
        </section>
        <section className={styles.hint}><strong>خرید حقوقی و دریافت فاکتور رسمی</strong><p>با فعال‌کردن این گزینه، فاکتور سفارش به نام شرکت ثبت‌شده صادر می‌شود.</p></section>
      </aside>

      <section className={styles.fields}>
        <h1>تکمیل و ثبت سفارش</h1>
        <section className={styles.card}>
          <h2>۱. نوع خرید</h2>
          <label className={styles.toggleRow}><span><strong>خرید حقوقی و دریافت فاکتور رسمی</strong><small>این گزینه اختیاری است. با فعال‌کردن آن، فاکتور سفارش به نام شرکت صادر می‌شود.</small></span>
            <input type="checkbox" checked={legal} onChange={(event) => setLegal(event.target.checked)} aria-label="خرید حقوقی و دریافت فاکتور رسمی" />
          </label>
          {legal && <label className={styles.inputLabel}>نام شرکت و شناسه ملی<input placeholder="نام شرکت ثبت‌شده" /></label>}
        </section>

        <section className={styles.card}>
          <h2>۲. آدرس و موقعیت تحویل</h2>
          <button type="button" className={styles.map} onClick={() => setNotice("موقعیت نمونه روی نقشه انتخاب شد.")}>
            <span className={styles.mapPin}>●</span><span className={styles.mapAction}>تغییر موقعیت روی نقشه</span>
          </button>
          <label className={styles.inputLabel}>آدرس دقیق پستی<input defaultValue="آدرس نمونه" /></label>
          <div className={styles.inputGrid}>
            <label className={styles.inputLabel}>نام و نام خانوادگی گیرنده<input defaultValue="کاربر نمونه" /></label>
            <label className={styles.inputLabel}>شماره تماس گیرنده<input type="tel" defaultValue="شماره تماس نمونه" /></label>
          </div>
        </section>

        <section className={styles.card}>
          <h2>۳. روش تحویل</h2>
          <p className={styles.description}>سفارش شما از فروشگاه انتخاب‌شده ارسال می‌شود. زمان برآوردی پس از تأیید فروشگاه نمایش داده می‌شود.</p>
          <div className={styles.selectedDelivery}>تحویل از فروشگاه انتخاب‌شده <strong>{selectedSeller}</strong></div>
        </section>

        <section className={styles.card}>
          <h2>۴. روش پرداخت</h2>
          <div className={styles.paymentOptions}>
            {[["cod", "پرداخت در محل (کارتخوان سیار)"], ["online", "پرداخت آنلاین با کارت بانکی"], ["credit", "اعتبار حمایتی (در صورت موجود بودن)"]].map(([key, label]) =>
              <label className={`${styles.payment} ${payment === key ? styles.paymentActive : ""}`} key={key}>
                <input type="radio" name="payment" value={key} checked={payment === key} onChange={() => setPayment(key)} />{label}
              </label>)}
          </div>
        </section>
        <p className={styles.disclosure}>اطلاعات این صفحه نمونه است و پرداخت یا سفارش واقعی انجام نمی‌شود.</p>
        <Link className={styles.back} href="/buyer/review?mode=preview">بازگشت به بررسی سبد</Link>
      </section>
    </div>
  </main>;
}
