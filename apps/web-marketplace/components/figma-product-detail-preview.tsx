"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./figma-product-detail-preview.module.css";
import {
  LANDING_PREVIEW_CART_EVENT,
  readLandingPreviewCart,
  saveLandingPreviewCart,
  type LandingPreviewProduct,
} from "../lib/landing-preview-products";

const cheeseGallery = [
  { src: "/landing/product-detail-main.png", alt: "پنیر سفید ایرانی ممتاز" },
  { src: "/landing/product-detail-flatbread.png", alt: "پنیر روی نان محلی" },
  { src: "/landing/product-detail-cheese.png", alt: "نمای نزدیک پنیر سفید" },
] as const;

export function FigmaProductDetailPreview({ product }: { product: LandingPreviewProduct }) {
  const isCheese = product.id === "cheese";
  const title = isCheese ? "پنیر سفید ایرانی ممتاز هراز" : product.title;
  // Do not substitute cheese photos or invented specifications for other products.
  const gallery = isCheese ? cheeseGallery : [
    { src: "/landing/" + product.image, alt: product.title },
  ];
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [added, setAdded] = useState(false);

  function addToCart() {
    setAdded(false);
    const current = readLandingPreviewCart();
    const item = current.find((entry) => entry.productId === product.id);
    if ((item?.quantity ?? 0) + quantity > 99) {
      setNotice("حداکثر تعداد این کالا در سبد ۹۹ عدد است.");
      return;
    }
    const next = item
      ? current.map((entry) => entry.productId === product.id
          ? { ...entry, quantity: entry.quantity + quantity } : entry)
      : [...current, { productId: product.id, quantity }];
    if (!saveLandingPreviewCart(next)) {
      setNotice("افزودن کالا به سبد انجام نشد؛ دوباره تلاش کنید.");
      return;
    }
    window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
    setAdded(true);
    setNotice(product.title + " به سبد خرید اضافه شد.");
  }

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.breadcrumbs}>
        <Link href="/">صفحه اصلی</Link><span>/</span>
        <Link href="/products">محصولات</Link><span>/</span>
        <span>{product.title}</span>
      </div>

      <div className={styles.layout}>
        <section className={styles.gallery} aria-label="تصاویر محصول">
          <div className={styles.heroImage}>
            <Image src={gallery[activeImage].src} alt={gallery[activeImage].alt}
              fill priority sizes="(max-width: 700px) 100vw, 34vw" />
          </div>
          {gallery.length > 1 && <div className={styles.thumbnails}>
            {gallery.slice(1).map((image, index) => {
              const imageIndex = index + 1;
              return <button key={image.src} type="button"
                aria-label={image.alt} aria-pressed={activeImage === imageIndex}
                className={activeImage === imageIndex ? styles.thumbnailActive : styles.thumbnail}
                onClick={() => setActiveImage(activeImage === imageIndex ? 0 : imageIndex)}>
                <Image src={image.src} alt="" width={88} height={88} />
              </button>;
            })}
          </div>}
        </section>

        <section className={styles.information}>
          {product.badge && <p className={styles.category}>{isCheese ? "لبنیات ممتاز" : product.badge}</p>}
          <h1>{title}</h1>
          <p className={styles.weight}>{isCheese ? "وزن خالص: ۴۰۰ گرم" : product.detail}</p>
          <p className={styles.disclosure}>این اطلاعات و قیمت‌ها نمونهٔ طراحی هستند؛ خرید واقعی انجام نمی‌شود.</p>

          <section className={styles.purchase} aria-label="قیمت و افزودن به سبد">
            <div className={styles.priceRow}>
              <span>قیمت پایه بازارگاه (حدودی):</span>
              <div>{product.oldPrice && <del>{product.oldPrice} تومان</del>}<strong>{product.price} تومان</strong></div>
            </div>
            <hr className={styles.purchaseDivider} />
            <p className={styles.hint}>💡 بعد از افزودن به سبد، می‌توانید فروشگاه‌های نزدیک را مقایسه کنید و فروشگاه موردنظر خود را برای ادامه خرید انتخاب کنید.</p>
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
            {added && <Link className={styles.cartLink} href="/buyer/cart?mode=preview">مشاهده سبد خرید</Link>}
          </section>

          <section className={styles.specifications}>
            <h2>مشخصات و ویژگی‌های محصول</h2>
            {isCheese ? <dl><dt>برند تولیدکننده</dt><dd>هراز</dd>
              <dt>وزن خالص</dt><dd>۴۰۰ گرم</dd></dl>
              : <dl><dt>اطلاعات نمونه</dt><dd>{product.detail}</dd></dl>}
          </section>
        </section>
      </div>
    </main>
  );
}
