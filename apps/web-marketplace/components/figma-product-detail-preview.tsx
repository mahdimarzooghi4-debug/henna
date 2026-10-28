"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./figma-product-detail-preview.module.css";
import {
  LANDING_PREVIEW_CART_EVENT,
  readLandingPreviewCart,
  saveLandingPreviewCart,
} from "../lib/landing-preview-products";

const gallery = [
  { src: "/landing/product-detail-main.png", alt: "پنیر سفید ایرانی ممتاز" },
  { src: "/landing/product-detail-cheese.png", alt: "نمای نزدیک پنیر سفید" },
  { src: "/landing/product-detail-flatbread.png", alt: "پنیر روی نان محلی" },
] as const;

export function FigmaProductDetailPreview() {
  const [activeImage, setActiveImage] = useState(0);
  const [activeThumbnail, setActiveThumbnail] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");

  function addToCart() {
    const current = readLandingPreviewCart();
    const item = current.find((entry) => entry.productId === "cheese");
    if ((item?.quantity ?? 0) + quantity > 99) {
      setNotice("حداکثر تعداد این کالا در سبد ۹۹ عدد است.");
      return;
    }
    const next = item
      ? current.map((entry) => entry.productId === "cheese"
          ? { ...entry, quantity: entry.quantity + quantity } : entry)
      : [...current, { productId: "cheese", quantity }];
    if (!saveLandingPreviewCart(next)) {
      setNotice("افزودن کالا به سبد انجام نشد؛ دوباره تلاش کنید.");
      return;
    }
    window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
    setNotice("پنیر سفید ایرانی ممتاز به سبد خرید اضافه شد.");
  }

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.breadcrumbs}>
        <Link href="/">صفحه اصلی</Link><span>/</span>
        <Link href="/products">لبنیات ممتاز</Link><span>/</span>
        <span>پنیر سفید ایرانی ممتاز</span>
      </div>

      <div className={styles.layout}>
        <section className={styles.gallery} aria-label="تصاویر محصول">
          <div className={styles.heroImage}>
            <Image src={gallery[activeImage].src} alt={gallery[activeImage].alt}
              fill priority sizes="(max-width: 700px) 100vw, 34vw" />
          </div>
          <div className={styles.thumbnails}>
            {gallery.slice(1).map((image, index) => {
              const imageIndex = index + 1;
              return <button key={image.src} type="button"
                aria-label={image.alt} aria-pressed={activeThumbnail === imageIndex}
                className={activeThumbnail === imageIndex ? styles.thumbnailActive : styles.thumbnail}
                onClick={() => { setActiveImage(imageIndex); setActiveThumbnail(imageIndex); }}>
                <Image src={image.src} alt="" width={88} height={88} />
              </button>;
            })}
          </div>
        </section>

        <section className={styles.information}>
          <p className={styles.category}>لبنیات ممتاز</p>
          <h1>پنیر سفید ایرانی ممتاز</h1>
          <p className={styles.weight}>وزن خالص: ۴۰۰ گرم</p>

          <section className={styles.purchase} aria-label="قیمت و افزودن به سبد">
            <div className={styles.priceRow}>
              <span>قیمت پایه بازار (حدودی):</span>
              <div><del>۶۵,۰۰۰ تومان</del><strong>۵۴,۰۰۰ تومان</strong></div>
            </div>
            <p className={styles.hint}>💡 بعد از افزودن به سبد، می‌توانید فروشگاه‌های نزدیک را مقایسه کنید و از فروشگاه موردنظرتان برای ادامه خرید انتخاب کنید.</p>
            <div className={styles.controls}>
              <div className={styles.stepper} aria-label="تعداد کالا">
                <button type="button" aria-label="افزایش تعداد" disabled={quantity >= 99}
                  onClick={() => setQuantity((value) => Math.min(99, value + 1))}>+</button>
                <output aria-live="polite">{new Intl.NumberFormat("fa-IR").format(quantity)}</output>
                <button type="button" aria-label="کاهش تعداد" disabled={quantity <= 1}
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
              </div>
              <button type="button" className={styles.addButton} onClick={addToCart}>
                افزودن به سبد خرید
              </button>
            </div>
            {notice && <p className={styles.notice} role="status">{notice}</p>}
            <Link className={styles.cartLink} href="/buyer/cart?mode=preview">مشاهده سبد خرید</Link>
          </section>

          <section className={styles.specifications}>
            <h2>مشخصات و ویژگی‌های محصول</h2>
            <dl><dt>برند تولیدکننده</dt><dd>هراز</dd>
              <dt>وزن خالص</dt><dd>۴۰۰ گرم</dd></dl>
          </section>
          <p className={styles.disclosure}>قیمت این صفحه نمایشی است و سفارش واقعی ثبت نمی‌کند.</p>
        </section>
      </div>
    </main>
  );
}
