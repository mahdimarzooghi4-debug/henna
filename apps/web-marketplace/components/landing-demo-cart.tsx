"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./landing-demo-cart.module.css";
import {
  LANDING_PREVIEW_CART_EVENT,
  LANDING_PREVIEW_PRODUCTS,
  readLandingPreviewCart,
  removeLandingPreviewProduct,
  saveLandingPreviewCart,
  type LandingPreviewCartItem,
} from "../lib/landing-preview-products";

export function LandingCartCount() {
  const [count, setCount] = useState(0);
  const sync = useCallback(() => {
    setCount(readLandingPreviewCart().reduce((total, item) => total + item.quantity, 0));
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener(LANDING_PREVIEW_CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANDING_PREVIEW_CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  return <>{new Intl.NumberFormat("fa-IR").format(count)}</>;
}

export function LandingDemoCartPage() {
  const [items, setItems] = useState<LandingPreviewCartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const sync = useCallback(() => {
    setItems(readLandingPreviewCart());
    setLoaded(true);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener(LANDING_PREVIEW_CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANDING_PREVIEW_CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  function save(itemsToSave: LandingPreviewCartItem[]) {
    if (!saveLandingPreviewCart(itemsToSave)) return;
    setItems(readLandingPreviewCart());
    window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
  }

  const totalCount = items.reduce((total, item) => total + item.quantity, 0);
  const amount = (value: string) => Number(value.replace(/[۰-۹]/g,
    (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٬,]/g, "")) || 0;
  const format = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
  const subtotal = items.reduce((total, item) => {
    const product = LANDING_PREVIEW_PRODUCTS.find((entry) => entry.id === item.productId);
    return total + (product ? amount(product.price) * item.quantity : 0);
  }, 0);
  const discount = items.reduce((total, item) => {
    const product = LANDING_PREVIEW_PRODUCTS.find((entry) => entry.id === item.productId);
    return total + (product?.oldPrice
      ? (amount(product.oldPrice) - amount(product.price)) * item.quantity : 0);
  }, 0);

  return (
    <main dir="rtl" className={styles.page}>
      <p className={styles.notice}>این سبد نمونه‌ی نمایشی است؛ مبلغ‌ها تقریبی‌اند و سفارش واقعی ثبت نمی‌شود.</p>
      {!loaded ? <p role="status">در حال دریافت سبد…</p> : items.length === 0 ? (
        <section className={styles.empty}>
          <h1>سبد خرید خالی است</h1>
          <p>برای شروع، یک کالا به سبد خرید اضافه کن.</p>
          <Link href="/#offers">رفتن به پیشنهادهای امروز</Link>
        </section>
      ) : (
        <div className={styles.layout}>
          <section className={styles.items} aria-labelledby="landing-cart-items-title">
            <h1 id="landing-cart-items-title" className={styles.title}>اقلام سبد خرید شما</h1>
            <ul className={styles.list}>
              {items.map((item) => {
                const product = LANDING_PREVIEW_PRODUCTS.find((entry) => entry.id === item.productId);
                if (!product) return null;
                return <li className={styles.item} key={item.productId}>
                  <div className={styles.product}>
                    <Image className={styles.image} src={"/landing/" + product.image}
                      alt={product.title} width={70} height={70} />
                    <div className={styles.productInfo}><h3>{product.title}</h3><p>{product.detail}</p></div>
                  </div>
                  <div className={styles.quantity} aria-label={"تعداد " + product.title}>
                    <button type="button" aria-label={"افزایش تعداد " + product.title}
                      disabled={item.quantity >= 99}
                      onClick={() => save(items.map((entry) => entry.productId === item.productId
                        ? { ...entry, quantity: Math.min(99, entry.quantity + 1) } : entry))}>+</button>
                    <span>{format(item.quantity)}</span>
                    <button type="button" aria-label={"کاهش تعداد " + product.title}
                      disabled={item.quantity <= 1}
                      onClick={() => save(items.map((entry) => entry.productId === item.productId
                        ? { ...entry, quantity: Math.max(1, entry.quantity - 1) } : entry))}>−</button>
                  </div>
                  <div className={styles.actionsPrice}>
                    <button type="button" className={styles.remove} onClick={() => {
                      removeLandingPreviewProduct(item.productId);
                      sync();
                      window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
                    }}>حذف کالا ×</button>
                    <strong className={styles.price}>{product.price} تومان</strong>
                  </div>
                </li>;
              })}
            </ul>
          </section>
          <aside className={styles.summary} aria-labelledby="cart-summary-title">
            <h2 id="cart-summary-title">خلاصه سبد خرید</h2>
            <div className={styles.divider} />
            <div className={styles.metrics}>
              <div className={styles.line}><span>تعداد اقلام:</span><strong>{format(totalCount)} کالا</strong></div>
              <div className={styles.line}><span>قیمت پایه کل کالاها:</span><strong>{format(subtotal + discount)} تومان</strong></div>
            </div>
            <div className={styles.comparison}>
              <h3>مقایسه فروشگاه‌ها برای همین سبد</h3>
              <p>حنا فروشگاه‌های محله را بر اساس موجودی کامل کالاها، قیمت کل، فاصله و اطلاعات شناخته‌شده ارسال برای همین سبد مقایسه می‌کند.</p>
            </div>
            <Link className={styles.compareButton} href="/buyer/compare?mode=preview">مشاهده مقایسه فروشگاه‌ها</Link>
          </aside>
        </div>
      )}
    </main>
  );
}
