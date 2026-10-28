"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./figma-basket-review-preview.module.css";
import {
  LANDING_PREVIEW_CART_EVENT, LANDING_PREVIEW_PRODUCTS, readLandingPreviewCart,
  saveLandingPreviewCart, type LandingPreviewCartItem,
} from "../lib/landing-preview-products";

const selectedSellerKey = "henna:figma-preview-selected-seller:v1";
const sellers: Record<string, { name: string; distance: string }> = {
  "store-3": { name: "فروشگاه نمونه ۳ (محله رسالت)", distance: "۲.۴ کیلومتر" },
  "store-1": { name: "فروشگاه نمونه ۱ (محله رسالت)", distance: "۱.۲ کیلومتر" },
  "store-2": { name: "فروشگاه نمونه ۲ (محله رسالت)", distance: "۰.۸ کیلومتر" },
};
function amount(value: string) {
  return Number(value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٬,]/g, "")) || 0;
}
const format = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export function FigmaBasketReviewPreview() {
  const [items, setItems] = useState<LandingPreviewCartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sellerId, setSellerId] = useState("store-1");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  useEffect(() => {
    const sync = () => {
      setItems(readLandingPreviewCart());
      setLoaded(true);
    };
    sync();
    try { setSellerId(window.localStorage.getItem(selectedSellerKey) ?? "store-1"); } catch { /* use default preview */ }
    window.addEventListener(LANDING_PREVIEW_CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANDING_PREVIEW_CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function save(next: LandingPreviewCartItem[]) {
    if (!saveLandingPreviewCart(next)) return;
    setItems(readLandingPreviewCart());
    window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => {
    const product = LANDING_PREVIEW_PRODUCTS.find((entry) => entry.id === item.productId);
    return sum + (product ? amount(product.price) * item.quantity : 0);
  }, 0);
  const discount = items.reduce((sum, item) => {
    const product = LANDING_PREVIEW_PRODUCTS.find((entry) => entry.id === item.productId);
    return sum + (product?.oldPrice ? (amount(product.oldPrice) - amount(product.price)) * item.quantity : 0);
  }, 0);
  const seller = sellers[sellerId] ?? sellers["store-1"];

  return <main className={styles.page} dir="rtl">
    {!loaded ? <p role="status">در حال دریافت سبد نمونه…</p> : items.length === 0 ? (
      <section className={styles.empty}><h1>سبد خرید خالی است</h1>
        <p>برای بازبینی، ابتدا کالاها را به سبد اضافه کنید.</p><Link href="/#offers">رفتن به پیشنهادها</Link></section>
    ) : <div className={styles.layout}>
      <section className={styles.lines}>
        <div className={styles.seller}>
          <div><span>فروشگاه انتخابی: </span><strong>{seller.name}</strong>
            <p>فاصله تا مقصد شما: {seller.distance} · ارسال از فروشگاه انتخاب‌شده</p></div>
          <span className={styles.sellerBadge}>فروشگاه انتخابی</span>
        </div>
        <h1>اقلام سبد خرید شما</h1>
        <ul className={styles.list}>{items.map((item) => {
          const product = LANDING_PREVIEW_PRODUCTS.find((entry) => entry.id === item.productId);
          if (!product) return null;
          return <li className={styles.item} key={item.productId}>
            <div className={styles.product}>
              <Image src={"/landing/" + product.image} alt={product.title} width={64} height={64} />
              <div><h2>{product.title}</h2><p>{product.detail}</p></div>
            </div>
            <span className={styles.quantity}>تعداد: {format(item.quantity)}</span>
            <strong className={styles.price}>{product.price} تومان</strong>
            <span className={styles.available}>موجود در انبار فروشگاه</span>
          </li>;
        })}</ul>
        <div className={styles.actions}>
          <Link href="/buyer/compare?mode=preview">بازگشت به مقایسه</Link>
          <button type="button" disabled>حذف کالای ناموجود</button>
        </div>
      </section>
      <aside className={styles.summary}>
        <h2>فاکتور و خلاصه خرید شما</h2>
        <div><span>جمع کالاها: {format(count)} کالا</span><strong>{format(subtotal + discount)} تومان</strong></div>
        <div><span>تخفیف ویژه کالابرگ:</span><strong className={styles.discount}>{format(discount)} تومان</strong></div>
        <div><span>هزینه ارسال محلی:</span><strong>رایگان</strong></div>
        <div className={styles.total}><span>مبلغ نهایی:</span><strong>{format(subtotal)} تومان</strong></div>
        <p>قیمت‌ها تا زمان نهایی‌سازی سفارش نمونه هستند.</p>
        {checkoutNotice && <p role="status">{checkoutNotice}</p>}
        <Link className={styles.checkout} href="/buyer/checkout?mode=preview">ادامه ثبت سفارش</Link>
        <Link className={styles.compare} href="/buyer/compare?mode=preview">بازگشت به مقایسه فروشگاه‌ها</Link>
      </aside>
    </div>}
  </main>;
}
