"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./figma-seller-comparison-preview.module.css";
import {
  LANDING_PREVIEW_CART_EVENT, readLandingPreviewCart,
} from "../lib/landing-preview-products";

// Existing illustrative seller fixtures only. These are not live quotes,
// actual inventory, geolocation measurements or delivery promises.
const sellers = [
  { id: "store-3", name: "فروشگاه نمونه ۳", distance: 2.4, price: 260000 },
  { id: "store-1", name: "فروشگاه نمونه ۱", distance: 1.2, price: 265000 },
  { id: "store-2", name: "فروشگاه نمونه ۲", distance: 0.8, price: 270000 },
] as const;
type Sort = "price" | "complete" | "distance";
const selectedSellerKey = "henna:figma-preview-selected-seller:v1";
const format = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

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

  // Preserve the existing sample availability convention. Derive the
  // presentation from the current cart count, not the two-item Figma mock.
  const offers = sellers.map(seller => ({
    ...seller, available: Math.min(itemCount, seller.id === "store-3" ? 1 : itemCount),
  }));
  const minPrice = Math.min(...offers.map(seller => seller.price));
  const minDistance = Math.min(...offers.map(seller => seller.distance));
  const maxAvailable = Math.max(...offers.map(seller => seller.available));
  const visibleSellers = [...offers].sort((a, b) => sort === "price"
    ? a.price - b.price
    : sort === "distance" ? a.distance - b.distance
      : b.available - a.available || a.price - b.price);

  return (
    <main className={styles.page} dir="rtl" data-testid="preview-comparison-page">
      <div className={styles.container} data-testid="preview-comparison-content">
        <div className={styles.intro}>
          <h1>مقایسه فروشگاه‌های نزدیک</h1>
          <p>برای یک سبد یکسان، فروشگاه‌ها را بر اساس قیمت کل، موجودی و زمان ارسال مقایسه کنید. انتخاب فروشگاه الزامی است.</p>
        </div>
        {itemCount === 0 ? <div className={styles.empty}>
          سبد نمونه خالی است. ابتدا یک کالا اضافه کنید.
          <Link href="/#offers">رفتن به پیشنهادها</Link>
        </div> : <>
          <div className={styles.filters} role="group" aria-label="مرتب‌سازی فروشگاه‌ها">
            {([ ["price", "ارزان‌ترین سبد"], ["complete", "کامل‌ترین سبد"], ["distance", "نزدیک‌ترین"] ] as const).map(([value, label]) =>
              <button key={value} type="button" dir="rtl" aria-pressed={sort === value}
                className={sort === value ? styles.activeFilter : styles.filter}
                onClick={() => setSort(value)}>{label}</button>)}
            <button type="button" dir="rtl" className={styles.filter} disabled>زمان تحویل</button>
          </div>
          <div className={styles.list} data-testid="preview-seller-list">
            {visibleSellers.map((seller) => {
              const missing = itemCount - seller.available;
              const tags = [
                seller.price === minPrice ? "کمترین قیمت کل" : "",
                seller.available === maxAvailable && missing === 0 ? "کامل‌ترین سبد" : "",
                seller.distance === minDistance ? "نزدیک‌ترین" : "",
              ].filter(Boolean);
              return <article className={styles.card} key={seller.id} data-testid="preview-seller-card" data-seller-id={seller.id}>
                <div className={styles.sellerIdentity} data-testid="preview-seller-identity">
                  <h2>{seller.name}</h2>
                  <p>فاصله تا شما: {format(seller.distance)} کیلومتر</p>
                </div>
                <div className={styles.available} data-testid="preview-seller-availability">
                  <strong>{format(seller.available)} از {format(itemCount)}{tags.length ? " · " + tags.join(" · ") : " کالا موجود"}</strong>
                  <span className={missing ? styles.missing : undefined}>{format(missing)} کالا ناموجود</span>
                </div>
                <div className={styles.offer} data-testid="preview-seller-price">
                  <strong>{format(seller.price)} تومان</strong>
                  <span>هزینه ارسال: هنگام نهایی‌سازی محاسبه می‌شود</span>
                </div>
                <div className={styles.action} data-testid="preview-seller-action">
                  <button type="button" aria-pressed={selected === seller.id} onClick={() => {
                    setSelected(seller.id);
                    try { window.localStorage.setItem(selectedSellerKey, seller.id); } catch { /* preview selection is optional */ }
                  }}>
                    {selected === seller.id ? "این فروشگاه انتخاب شد" : "انتخاب این فروشگاه"}
                  </button>
                  <span>زمان تحویل: پس از انتخاب فروشگاه مشخص می‌شود</span>
                </div>
              </article>;
            })}
          </div>
          {selected && <div className={styles.selection}>
            <p className={styles.selected} role="status">فروشگاه نمونه انتخاب شد.</p>
            <Link className={styles.continue} href="/buyer/review?mode=preview">ادامه به بازبینی سبد</Link>
          </div>}
          <p className={styles.disclaimer}>فروشگاه‌ها و قیمت‌های این صفحه نمونه‌ی نمایشی فیگما هستند و سفارش واقعی ثبت نمی‌کنند.</p>
        </>}
        <Link className={styles.back} href="/buyer/cart?mode=preview">بازگشت به سبد خرید</Link>
      </div>
    </main>
  );
}
