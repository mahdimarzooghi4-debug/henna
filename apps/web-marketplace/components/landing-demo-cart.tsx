"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

  return (
    <main dir="rtl" className="buyer-cart-page">
      <p className="buyer-cart-eyebrow">سبد خرید</p>
      <h1>سبد خرید</h1>
      <p className="buyer-cart-intro">کالاهایی که از پیشنهادهای صفحه انتخاب کرده‌ای در اینجا هستند.</p>
      <div className="buyer-cart-note">
        این اقلام و قیمت‌ها نمونهٔ نمایشی صفحه‌اند؛ این سبد برای پیش‌نمایش است و سفارشی ثبت نمی‌کند.
      </div>
      {!loaded ? <p role="status">در حال دریافت سبد…</p> :
        items.length === 0 ? (
          <section className="buyer-cart-panel">
            <h2>سبد خرید خالی است</h2>
            <p>از پیشنهادهای صفحه، کالاها را به سبد اضافه کن.</p>
            <Link href="/#offers">رفتن به پیشنهادهای امروز</Link>
          </section>
        ) : (
          <section className="buyer-cart-panel" aria-labelledby="landing-cart-items-title">
            <h2 id="landing-cart-items-title">
              اقلام سبد · {new Intl.NumberFormat("fa-IR").format(
                items.reduce((total, item) => total + item.quantity, 0))}
            </h2>
            <ul className="buyer-cart-list">
              {items.map((item) => {
                const product = LANDING_PREVIEW_PRODUCTS.find((entry) => entry.id === item.productId);
                if (!product) return null;
                return (
                  <li className="buyer-cart-item" key={item.productId}>
                    <div>
                      <Image src={"/landing/" + product.image} alt={product.title} width={96} height={72} />
                      <h3>{product.title}</h3>
                      <p>{product.detail}</p>
                      <p>قیمت نمایشی: {product.price} تومان</p>
                      <div className="buyer-cart-quantity">
                        <button type="button" aria-label={"کم کردن تعداد " + product.title}
                          disabled={item.quantity <= 1}
                          onClick={() => save(items.map((entry) => entry.productId === item.productId
                            ? { ...entry, quantity: entry.quantity - 1 } : entry))}>−</button>
                        <span>تعداد: {new Intl.NumberFormat("fa-IR").format(item.quantity)}</span>
                        <button type="button" aria-label={"افزایش تعداد " + product.title}
                          disabled={item.quantity >= 99}
                          onClick={() => save(items.map((entry) => entry.productId === item.productId
                            ? { ...entry, quantity: entry.quantity + 1 } : entry))}>+</button>
                      </div>
                    </div>
                    <button type="button" onClick={() => {
                      removeLandingPreviewProduct(item.productId);
                      sync();
                      window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
                    }}>حذف از سبد</button>
                  </li>
                );
              })}
            </ul>
            <Link className="buyer-cart-back" href="/products">ادامهٔ خرید از کاتالوگ</Link>
          </section>
        )}
    </main>
  );
}
