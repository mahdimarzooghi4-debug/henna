"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LANDING_PREVIEW_PRODUCTS, type LandingPreviewCartItem } from "../lib/landing-preview-products";
import styles from "./figma-order-tracking.module.css";

type OrderSummary = {
  total: number;
  sellerName: string;
  address: string;
  deliveryMethod?: "pickup" | "courier";
  deliveryFee?: number;
  legal: boolean;
  items: LandingPreviewCartItem[];
};
const orderKey = "henna:figma-preview-order:v1";
const format = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const productIds = new Set(LANDING_PREVIEW_PRODUCTS.map(product => product.id));

function readPreviewOrder(): OrderSummary | null {
  try {
    const raw = window.sessionStorage.getItem(orderKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrderSummary> | null;
    if (!parsed || typeof parsed.total !== "number" || !Number.isFinite(parsed.total) ||
        parsed.total < 0 || typeof parsed.sellerName !== "string" || !parsed.sellerName.trim() ||
        typeof parsed.address !== "string" || !Array.isArray(parsed.items) || !parsed.items.length) return null;
    const items = parsed.items.filter(item => item && typeof item.productId === "string" &&
      productIds.has(item.productId) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99);
    if (items.length !== parsed.items.length) return null;
    return {
      total: parsed.total, sellerName: parsed.sellerName, address: parsed.address,
      deliveryMethod: parsed.deliveryMethod === "pickup" || parsed.deliveryMethod === "courier" ? parsed.deliveryMethod : undefined,
      deliveryFee: typeof parsed.deliveryFee === "number" && Number.isFinite(parsed.deliveryFee) && parsed.deliveryFee >= 0 ? parsed.deliveryFee : undefined,
      legal: parsed.legal === true, items,
    };
  } catch { return null; }
}

export function FigmaOrderTracking() {
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setOrder(readPreviewOrder()); setLoaded(true); }, []);

  if (!order) return (
    <main className={styles.page} dir="rtl" data-testid="preview-tracking-page">
      <div className={styles.container}>
        <section className={styles.card} data-testid={loaded ? "preview-tracking-empty" : "preview-tracking-loading"}>
          <h1>وضعیت سفارش</h1>
          <p className={styles.muted}>{loaded ? "سفارش نمونه‌ای برای پیگیری در این نشست وجود ندارد." : "در حال خواندن سفارش نمونه..."}</p>
          <Link className={styles.back} href="/buyer/orders?mode=preview">بازگشت به سفارش‌ها</Link>
          <Link className={styles.back} href="/products">مشاهده کالاها</Link>
        </section>
      </div>
    </main>
  );

  const pickup = order.deliveryMethod === "pickup";
  const stages = ["ثبت سفارش", "تأیید فروشگاه", "آماده‌سازی", pickup ? "آماده دریافت" : "ارسال", "تحویل"];
  // The local preview stores only the checkout snapshot. No seller confirmation,
  // preparation, shipment or delivery event exists in this preview contract.
  return (
    <main className={styles.page} dir="rtl" data-testid="preview-tracking-page">
      <div className={styles.container}>
        <div className={styles.layout} data-testid="preview-tracking-layout">
          <section className={styles.core} data-testid="preview-tracking-core">
            <div className={styles.heading}>
              <div className={styles.titleBlock}>
                <div className={styles.titleRow}>
                  <h1>وضعیت سفارش</h1>
                  {order.legal && <div className={styles.invoice} data-testid="preview-tracking-legal">
                    <span className={styles.legal}>خرید حقوقی</span>
                    <span className={styles.muted}>درخواست فاکتور رسمی</span>
                  </div>}
                </div>
                <p>کد پیگیری سفارش: نمونه</p>
              </div>
              <Link href="/buyer/orders?mode=preview" className={styles.back}>بازگشت به سفارش‌ها</Link>
            </div>
            <section className={styles.timeline} aria-label="مراحل سفارش">
              {stages.map((stage, index) => (
                <div className={styles.stage} key={stage} data-testid="preview-tracking-stage"
                  aria-current={index === 0 ? "step" : undefined}>
                  <span className={index === 0 ? styles.node + " " + styles.done : styles.node} aria-hidden="true">{index === 0 ? "✓" : ""}</span>
                  <strong className={index === 0 ? styles.active : undefined}>{stage}</strong>
                  {index < stages.length - 1 && <span className={styles.connector} aria-hidden="true" />}
                </div>
              ))}
            </section>
            <section className={styles.card}>
              <h2>اطلاعات تحویل گیرنده</h2>
              <div className={styles.divider} />
              <dl className={styles.recipient}>
                <div><dt>روش تحویل:</dt><dd data-testid="preview-tracking-delivery">{pickup ? "تحویل حضوری از فروشگاه" : order.deliveryMethod === "courier" ? "ارسال با پیک" : "مشخص نشده"}</dd></div>
                <div><dt>{pickup ? "محل دریافت:" : "نشانی تحویل:"}</dt><dd data-testid="preview-tracking-address">{order.address}</dd></div>
                {pickup && <div><dt>هزینه پیک:</dt><dd>۰ تومان</dd></div>}
                {!pickup && <div><dt>اطلاعات تحویل‌گیرنده:</dt><dd>در نسخه نمونه تأیید نشده است</dd></div>}
              </dl>
            </section>
            <p className={styles.notice}>این سفارش فقط در مسیر نمایشی ثبت شده است؛ تأیید فروشگاه، پرداخت، آماده‌سازی و تحویل واقعی انجام نشده‌اند.</p>
          </section>
          <aside className={styles.sidebar} data-testid="preview-tracking-sidebar">
            <section className={styles.card} data-testid="preview-tracking-seller">
              <h2>مشخصات فروشگاه</h2>
              <div className={styles.divider} />
              <strong>{order.sellerName}</strong>
              <p className={styles.muted}>فاصله و اطلاعات تماس واقعی تأیید نشده‌اند.</p>
              <button type="button" className={styles.contact} disabled>تماس با فروشگاه</button>
            </section>
            <section className={styles.card} data-testid="preview-tracking-items">
              <h2>اقلام این سفارش</h2>
              <div className={styles.divider} />
              {order.items.map(item => {
                const product = LANDING_PREVIEW_PRODUCTS.find(entry => entry.id === item.productId);
                return product ? <div className={styles.item} key={item.productId} data-testid="preview-tracking-item">
                  <span>{product.title} × {format(item.quantity)}</span>
                  <b>{product.price} تومان</b>
                </div> : null;
              })}
              <div className={styles.total}><span>مبلغ کل</span><strong data-testid="preview-tracking-total">{format(order.total)} تومان</strong></div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
