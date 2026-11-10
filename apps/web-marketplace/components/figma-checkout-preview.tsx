"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./figma-checkout-preview.module.css";
import { LANDING_PREVIEW_CART_EVENT, LANDING_PREVIEW_PRODUCTS, readLandingPreviewCart, saveLandingPreviewCart, type LandingPreviewCartItem } from "../lib/landing-preview-products";

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
  const router = useRouter();
  const [items, setItems] = useState<LandingPreviewCartItem[]>([]);
  const [sellerId, setSellerId] = useState("store-1");
  const [payment, setPayment] = useState("online");
  // Preview only: pickup has no courier fee; courier quotes are not available.
  const [delivery, setDelivery] = useState<"pickup" | "courier">("pickup");
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

  function placePreviewOrder() {
    if (delivery === "courier") {
      setNotice("هزینه پیک هنوز مشخص نشده است؛ ثبت سفارش با پیک امکان‌پذیر نیست.");
      return;
    }
    if (!items.length) {
      setNotice("برای ثبت سفارش، ابتدا کالا را به سبد اضافه کنید.");
      return;
    }
    try {
      window.sessionStorage.setItem("henna:figma-preview-order:v1", JSON.stringify({
        total: subtotal, sellerName: selectedSeller,
        address: "دریافت حضوری از " + selectedSeller,
        deliveryMethod: "pickup", deliveryFee: 0, legal, items,
      }));
    } catch {
      setNotice("ثبت اطلاعات نمونه انجام نشد؛ دوباره تلاش کنید.");
      return;
    }
    if (!saveLandingPreviewCart([])) {
      setNotice("سبد خرید نمونه پاک نشد؛ دوباره تلاش کنید.");
      return;
    }
    window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
    router.push("/buyer/success?mode=preview");
  }

  if (!items.length) return <main className={styles.page} dir="rtl" data-testid="preview-checkout-page"><div className={styles.container}><section className={styles.empty}>
    <h1>سبد خرید خالی است</h1><p>برای تکمیل سفارش، ابتدا کالاها را به سبد اضافه کنید.</p>
    <Link href="/#offers">رفتن به کالاها</Link>
  </section></div></main>;

  return <main className={styles.page} dir="rtl" data-testid="preview-checkout-page">
    <div className={styles.container}>
    <div className={styles.layout} data-testid="preview-checkout-layout">
      <aside className={styles.side} data-testid="preview-checkout-summary">
        <section className={styles.summary}>
          <h2>خلاصه سفارش</h2>
          <div><span>مجموع اقلام:</span><strong>{format(subtotal)} تومان</strong></div>
          <div><span>کد تخفیف:</span><strong className={styles.terracotta}>-</strong></div>
          <div><span>روش تحویل:</span><strong>{delivery === "pickup" ? "تحویل حضوری" : "ارسال با پیک"}</strong></div>
          <div><span>هزینه ارسال:</span><strong data-testid="preview-delivery-fee">{delivery === "pickup" ? "۰ تومان" : "در انتظار تعیین هزینه پیک"}</strong></div>
          <div><span>اعتبار حمایتی:</span><strong>در صورت موجود بودن</strong></div>
          <div><span>اعتبار شخصی:</span><strong>اعتبار شخصی تأمین‌شده توسط کاربر</strong></div>
          <div className={styles.total}><span>مبلغ قابل پرداخت:</span><strong data-testid="preview-checkout-total">{delivery === "pickup" ? format(subtotal) + " تومان" : "پس از تعیین هزینه پیک"}</strong></div>
          {delivery === "courier" && <p className={styles.notice} id="courier-quote-notice">هزینه پیک هنوز مشخص نشده است؛ تا تعیین هزینه، ثبت سفارش با پیک غیرفعال است.</p>}
          <button type="button" className={styles.primary} onClick={placePreviewOrder} disabled={delivery === "courier"} aria-describedby={delivery === "courier" ? "courier-quote-notice" : undefined}>ثبت سفارش</button>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
        </section>
        <section className={styles.hint}><strong>خرید حقوقی و دریافت فاکتور رسمی</strong><p>با فعال‌کردن این گزینه، درخواست صدور فاکتور رسمی به نام شرکت ثبت‌شده در حساب کاربری مشخص می‌شود.</p></section>
      </aside>

      <section className={styles.fields} data-testid="preview-checkout-fields">
        <h1>تکمیل و ثبت سفارش</h1>
        <section className={styles.card}>
          <h2>۱. نوع خرید</h2>
          <label className={styles.toggleRow}><span><strong>خرید حقوقی و دریافت فاکتور رسمی</strong><small>این گزینه اختیاری است. اطلاعات شرکت از حساب کاربری استفاده می‌شود.</small></span>
            <input type="checkbox" checked={legal} onChange={(event) => setLegal(event.target.checked)} aria-label="خرید حقوقی و دریافت فاکتور رسمی" />
          </label>
          {legal && <p className={styles.description} data-testid="preview-legal-company-note">اطلاعات شرکت از حساب کاربری شما دریافت می‌شود؛ نیازی به وارد کردن دوباره نیست. در نسخه نمایشی فاکتور رسمی صادر نمی‌شود.</p>}
        </section>

        <section className={styles.card}>
          <h2>۲. روش تحویل</h2>
          <div className={styles.deliveryOptions} role="group" aria-label="روش تحویل">
            <label className={`${styles.deliveryOption} ${delivery === "pickup" ? styles.deliveryActive : ""}`}>
              <input type="radio" name="delivery" value="pickup" aria-label="تحویل حضوری از فروشگاه" checked={delivery === "pickup"} onChange={() => {setDelivery("pickup"); setNotice("");}} />
              <span><strong>تحویل حضوری از فروشگاه</strong><small>بدون هزینه پیک؛ دریافت سفارش از فروشگاه انتخاب‌شده</small></span>
            </label>
            <label className={`${styles.deliveryOption} ${delivery === "courier" ? styles.deliveryActive : ""}`}>
              <input type="radio" name="delivery" value="courier" aria-label="ارسال با پیک" checked={delivery === "courier"} onChange={() => {setDelivery("courier"); setNotice("");}} />
              <span><strong>ارسال با پیک</strong><small>تحویل در نشانی شما؛ هزینه پس از تعیین مبلغ معتبر ارسال</small></span>
            </label>
          </div>
          <div className={styles.selectedDelivery}>فروشگاه انتخاب‌شده <strong>{selectedSeller}</strong></div>
        </section>

        <section className={styles.card}>
          <h2>۳. {delivery === "pickup" ? "اطلاعات دریافت حضوری" : "آدرس و موقعیت تحویل"}</h2>
          {delivery === "pickup" ? <div className={styles.pickupInfo} data-testid="preview-pickup-info">
            <strong>{selectedSeller}</strong>
            <p className={styles.description}>سفارش را از فروشگاه انتخاب‌شده دریافت می‌کنید. نشانی و زمان واقعی دریافت در نسخه نمایشی تأیید نشده‌اند.</p>
          </div> : <div className={styles.courierFields} data-testid="preview-courier-fields">
            <button type="button" className={styles.map} onClick={() => setNotice("موقعیت نمونه روی نقشه انتخاب شد.")} aria-label="تغییر موقعیت روی نقشه">
              <img src="/landing/checkout-map.png" alt="" />
            </button>
            <label className={styles.inputLabel}>آدرس دقیق پستی<input defaultValue="آدرس نمونه" /></label>
            <div className={styles.inputGrid}>
              <label className={styles.inputLabel}>نام و نام خانوادگی گیرنده<input defaultValue="کاربر نمونه" /></label>
              <label className={styles.inputLabel}>شماره تماس گیرنده<input type="tel" defaultValue="شماره تماس نمونه" /></label>
            </div>
            <p className={styles.description}>نقشه و نشانی نمونه‌اند؛ هزینه و زمان پیک واقعی در این نسخه محاسبه نمی‌شوند.</p>
          </div>}
        </section>

        <section className={styles.card}>
          <h2>۴. روش پرداخت</h2>
          <div className={styles.paymentOptions}>
            {[["cod", delivery === "pickup" ? "پرداخت هنگام دریافت حضوری" : "پرداخت در محل (کارتخوان سیار)"], ["online", "پرداخت آنلاین با کارت بانکی"], ["credit", "اعتبار حمایتی (در صورت موجود بودن)"]].map(([key, label]) =>
              <label className={`${styles.payment} ${payment === key ? styles.paymentActive : ""}`} key={key}>
                <input type="radio" name="payment" value={key} checked={payment === key} onChange={() => setPayment(key)} />{label}
              </label>)}
          </div>
        </section>
        <p className={styles.disclosure}>اطلاعات این صفحه نمونه است و پرداخت یا سفارش واقعی انجام نمی‌شود.</p>
        <Link className={styles.back} href="/buyer/review?mode=preview">بازگشت به بررسی سبد</Link>
      </section>
    </div>
    </div>
  </main>;
}
