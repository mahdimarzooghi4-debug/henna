"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./figma-seller-comparison-preview.module.css";
import {
  LANDING_PREVIEW_CART_EVENT, readLandingPreviewCart,
} from "../lib/landing-preview-products";

const sellers = [
  { id: "store-3", name: "فروشگاه نمونه ۳", distance: "۲.۴ کیلومتر", price: 260000, tags: ["کمترین قیمت کل", "۱ از ۲ کالا ناموجود"] },
  { id: "store-1", name: "فروشگاه نمونه ۱", distance: "۱.۲ کیلومتر", price: 265000, tags: ["کامل‌ترین سبد", "نزدیک‌ترین"] },
  { id: "store-2", name: "فروشگاه نمونه ۲", distance: "۰.۸ کیلومتر", price: 270000, tags: ["۲ از ۲ کالا موجود"] },
] as const;
type Sort = "price" | "complete" | "distance";
const selectedSellerKey = "henna:figma-preview-selected-seller:v1";

export function FigmaSellerComparisonPreview() {
  const [sort, setSort] = useState<Sort>("price");
  const [selected, setSelected] = useState("");
  const [itemCount, setItemCount] = useState(0);
  useEffect(() => {
    const sync = () => setItemCount(readLandingPreviewCart().reduce((sum, item) => sum + item.quantity, 0));
    sync();
    window.addEventListener(LANDING_PREVIEW_CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANDING_PREVIEW_CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const visibleSellers = [...sellers].sort((a, b) => sort === "price"
    ? a.price - b.price
    : sort === "distance" ? a.distance.localeCompare(b.distance, "fa")
      : b.tags.length - a.tags.length);

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.intro}>
        <h1>مقایسه فروشگاه‌های نزدیک</h1>
        <p>برای یک سبد یکسان، فروشگاه‌ها را بر اساس قیمت کل، موجودی و زمان ارسال مقایسه کنید. انتخاب فروشگاه الزامی است.</p>
      </div>
      {itemCount === 0 ? <div className={styles.empty}>
        سبد نمونه خالی است. ابتدا یک کالا اضافه کنید.
        <Link href="/#offers">رفتن به پیشنهادها</Link>
      </div> : <>
        <div className={styles.filters} role="group" aria-label="مرتب‌سازی فروشگاه‌ها">
          {([ ["price", "قیمت کل"], ["complete", "کامل‌ترین سبد"], ["distance", "نزدیک‌ترین"] ] as const).map(([value, label]) =>
            <button key={value} type="button" aria-pressed={sort === value}
              className={sort === value ? styles.activeFilter : styles.filter}
              onClick={() => setSort(value)}>{label}</button>)}
          <button type="button" className={styles.filter} disabled>زمان تحویل</button>
        </div>
        <div className={styles.list}>
          {visibleSellers.map((seller) => <article className={styles.card} key={seller.id}>
            <div className={styles.sellerIdentity}>
              <h2>{seller.name}</h2>
              <p>فاصله تا شما: {seller.distance}</p>
            </div>
            <div className={styles.badges}>{seller.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className={styles.available}><strong>{Math.min(itemCount, seller.id === "store-3" ? 1 : itemCount)} از {itemCount} کالا موجود</strong>
              <span>زمان تحویل: پس از انتخاب فروشگاه مشخص می‌شود</span>
              <span>هزینه ارسال: هنگام نهایی‌سازی محاسبه می‌شود</span>
            </div>
            <div className={styles.offer}>
              <strong>{new Intl.NumberFormat("fa-IR").format(seller.price)} تومان</strong>
              <span>قیمت کل سبد:</span>
              <button type="button" onClick={() => {
                setSelected(seller.id);
                try { window.localStorage.setItem(selectedSellerKey, seller.id); } catch { /* preview selection is optional */ }
              }}>
                {selected === seller.id ? "این فروشگاه انتخاب شد" : "انتخاب این فروشگاه"}
              </button>
            </div>
          </article>)}
        </div>
        {selected && <p className={styles.selected} role="status">
          فروشگاه نمونه انتخاب شد.
        </p>}
        {selected && <Link className={styles.continue} href="/buyer/review?mode=preview">ادامه به بازبینی سبد</Link>}
        <p className={styles.disclaimer}>فروشگاه‌ها و قیمت‌های این صفحه نمونه‌ی نمایشی فیگما هستند و سفارش واقعی ثبت نمی‌کنند.</p>
      </>}
      <Link className={styles.back} href="/buyer/cart?mode=preview">بازگشت به سبد خرید</Link>
    </main>
  );
}
