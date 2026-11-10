"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { LANDING_PREVIEW_PRODUCTS, type LandingPreviewCartItem } from "../lib/landing-preview-products";
import styles from "./figma-order-tracking.module.css";

type OrderSummary = {
  total: number;
  sellerName: string;
  address: string;
  legal?: boolean;
  items: LandingPreviewCartItem[];
};

const orderKey = "henna:figma-preview-order:v1";
const format = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export function FigmaOrderTracking() {
  const [order, setOrder] = useState<OrderSummary>({
    total: 0,
    sellerName: "فروشگاه نمونه ۱",
    address: "نشانی نمونه",
    items: [],
  });

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(orderKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<OrderSummary>;
        setOrder({
          total: typeof parsed.total === "number" ? parsed.total : 0,
          sellerName: typeof parsed.sellerName === "string" ? parsed.sellerName : "فروشگاه نمونه ۱",
          address: typeof parsed.address === "string" ? parsed.address : "نشانی نمونه",
          legal: Boolean(parsed.legal),
          items: Array.isArray(parsed.items) ? parsed.items : [],
        });
      }
    } catch {
      // The preview remains usable when browser storage is unavailable.
    }
  }, []);

  const stages = ["ثبت سفارش", "تأیید فروشگاه", "آماده‌سازی", "ارسال", "تحویل"];

  return (
    <main className={styles.page} dir="rtl" data-testid="buyer-tracking-page">
      <div className={styles.layout} data-testid="buyer-tracking-layout">
        <aside className={styles.sidebar} data-testid="buyer-tracking-sidebar">
          <section className={`${styles.card} ${styles.storeBrief}`}>
            <h2>مشخصات فروشگاه</h2>
            <div className={styles.divider} />
            <strong>{order.sellerName}</strong>
            <p className={styles.muted}>فاصله تا مقصد: ۱.۲ کیلومتر</p>
            <a className={styles.contact} href="tel:02100000000">تماس با فروشگاه</a>
          </section>

          <section className={`${styles.card} ${styles.orderItemsCard}`} data-testid="buyer-tracking-items">
            <h2>اقلام این سفارش</h2>
            <div className={styles.divider} />
            {order.items.map((item) => {
              const product = LANDING_PREVIEW_PRODUCTS.find((candidate) => candidate.id === item.productId);
              return product ? (
                <div className={styles.item} key={item.productId}>
                  <span>{product.title} × {format(item.quantity)}</span>
                  <b>{product.price} تومان</b>
                </div>
              ) : null;
            })}
            {(order.items.length > 0 || order.total > 0) && (
              <div className={styles.total} data-testid="buyer-tracking-total">
                <span>مبلغ کل</span>
                <strong>{format(order.total)} تومان</strong>
              </div>
            )}
          </section>
        </aside>

        <section className={styles.core} data-testid="buyer-tracking-core">
          <div className={styles.heading} data-testid="buyer-tracking-heading">
            <Link href="/buyer/orders?mode=preview" className={styles.back} data-testid="buyer-tracking-back">
              بازگشت به سفارش‌ها
            </Link>
            <div className={styles.statusHeader} data-testid="buyer-tracking-status">
              <p className={styles.invoice}>فاکتور رسمی: به نام شرکت ثبت‌شده</p>
              {order.legal && <span className={styles.legal}>خرید حقوقی</span>}
              <div className={styles.titleBlock}>
                <h1>وضعیت سفارش</h1>
              </div>
            </div>
          </div>

          <section className={styles.timeline} aria-label="مراحل سفارش" data-testid="buyer-tracking-timeline">
            {stages.map((stage, index) => (
              <Fragment key={stage}>
                <div className={styles.stage} data-testid="buyer-tracking-stage">
                  <span className={[${styles.node}, index < 3 ? styles.done : ""].filter(Boolean).join(" ")} aria-hidden="true">
                    {index < 3 ? "✓" : ""}
                  </span>
                  <strong className={index === 2 ? styles.active : ""}>{stage}</strong>
                </div>
                {index < stages.length - 1 && (
                  <span className={styles.connector} aria-hidden="true" data-testid="buyer-tracking-connector" />
                )}
              </Fragment>
            ))}
          </section>

          <section className={`${styles.card} ${styles.recipientCard}`} data-testid="buyer-tracking-recipient">
            <h2>اطلاعات تحویل گیرنده</h2>
            <div className={styles.divider} />
            <dl className={styles.recipient}>
              <div>
                <dt>تحویل‌گیرنده:</dt>
                <dd>گیرنده نمونه (۰۹۱۰۰۰۰۰۰۰۰)</dd>
              </div>
              <div>
                <dt>نشانی تحویل:</dt>
                <dd>{order.address}</dd>
              </div>
            </dl>
          </section>
        </section>
      </div>
    </main>
  );
}
