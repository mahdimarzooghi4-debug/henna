"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SellerAccess = {
  sellerAccess: true;
  sellerPanelEnabled: true;
  trackingCode: string;
  activatedAtUtc: string;
  storeName: string;
  businessName: string;
  offeringType: "GOOD" | "SERVICE" | "BOTH";
  capabilities: {
    dashboard: true;
    orders: false;
    listings: boolean;
    inventory: false;
    pricing: false;
    settlements: false;
    reports: false;
  };
};


const capabilityCards = [
  ["سفارش‌ها", "orders"],
  ["کالاهای فروشگاه", "listings"],
  ["موجودی و دسترس‌پذیری", "inventory"],
  ["قیمت‌گذاری", "pricing"],
  ["تسویه‌حساب‌ها", "settlements"],
  ["گزارش‌ها", "reports"],
] as const;

function offeringLabel(value: SellerAccess["offeringType"]) {
  if (value === "GOOD") return "کالا";
  if (value === "SERVICE") return "خدمت";
  return "کالا و خدمت";
}

export function SellerDashboardView() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; value: SellerAccess }
    | { kind: "denied"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/seller/access", {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (controller.signal.aborted) return;
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object") {
        setState({
          kind: "denied",
          message: typeof (body as Record<string, unknown>).message === "string"
            ? (body as Record<string, unknown>).message as string
            : "دسترسی پنل فروشنده قابل تأیید نیست.",
        });
        return;
      }
      setState({ kind: "ready", value: body as SellerAccess });
    }).catch(() => {
      if (!controller.signal.aborted)
        setState({
          kind: "denied",
          message: "دسترسی پنل فروشنده قابل تأیید نیست.",
        });
    });
    return () => controller.abort();
  }, []);

  if (state.kind === "loading") {
    return (
      <main className="seller-panel-gate">
        <p className="form-status" role="status">
          در حال بررسی دسترسی فروشندگی…
        </p>
      </main>
    );
  }

  if (state.kind === "denied") {
    return (
      <main className="seller-panel-gate">
        <section className="seller-panel-denied">
          <h1>پنل فروشنده</h1>
          <p role="alert">{state.message}</p>
          <Link className="primary-button" href="/seller/register/status">
            مشاهده وضعیت درخواست
          </Link>
          <Link className="auth-card__secondary" href="/">
            بازگشت به حنا
          </Link>
        </section>
      </main>
    );
  }

  const seller = state.value;
  const navigation = [
    { label: "داشبورد", href: "/seller", enabled: true, active: true },
    { label: "سفارش‌ها", href: "", enabled: false, active: false },
    { label: "کالاهای فروشگاه", href: "/seller/offers", enabled: seller.capabilities.listings, active: false },
    { label: "موجودی و دسترس‌پذیری", href: "", enabled: false, active: false },
    { label: "قیمت‌گذاری", href: "", enabled: false, active: false },
    { label: "طرح‌ها و اعتبارها", href: "", enabled: false, active: false },
    { label: "ارسال و محدوده فعالیت", href: "", enabled: false, active: false },
    { label: "تسویه‌حساب‌ها", href: "", enabled: false, active: false },
    { label: "گزارش‌ها", href: "", enabled: false, active: false },
    { label: "اطلاعات کسب‌وکار", href: "", enabled: false, active: false },
    { label: "پشتیبانی", href: "", enabled: false, active: false },
  ] as const;
  return (
    <main className="seller-panel">
      <aside className="seller-panel__sidebar"
        aria-label="ناوبری پنل فروشنده">
        <div className="seller-panel__identity">
          <span className="seller-panel__avatar" aria-hidden="true">م‌آ</span>
          <div>
            <strong>مدیریت پنل</strong>
            <p>{seller.businessName}</p>
          </div>
        </div>

        <nav className="seller-panel__nav">
          {navigation.map(({ label, href, enabled, active }) => enabled
            ? <Link key={label} href={href}
                className={active
                  ? "seller-panel__nav-item seller-panel__nav-item--active"
                  : "seller-panel__nav-item"}>
                {label}
              </Link>
            : <span key={label}
                className="seller-panel__nav-item seller-panel__nav-item--disabled"
                aria-disabled="true">
                {label}
                <small>متصل نشده</small>
              </span>)}
        </nav>
      </aside>

      <section className="seller-panel__content">
        <header className="seller-panel__header">
          <div>
            <p className="seller-panel__eyebrow">
              پنل فروشندگان و ارائه‌دهندگان
            </p>
            <h1>پیشخوان مدیریت کسب‌وکار</h1>
            <p>
              وضعیت فعال‌سازی و قابلیت‌های متصل‌شده کسب‌وکار شما
              در این صفحه نمایش داده می‌شود.
            </p>
          </div>
          <Link className="auth-card__secondary"
            href="/seller/register/status">
            وضعیت ثبت‌نام
          </Link>
        </header>

        <section className="seller-panel__business-card">
          <div>
            <span>کسب‌وکار فعال</span>
            <h2>{seller.businessName}</h2>
            <p>{seller.storeName}</p>
          </div>
          <dl>
            <div>
              <dt>نوع ارائه</dt>
              <dd>{offeringLabel(seller.offeringType)}</dd>
            </div>
            <div>
              <dt>وضعیت فروشندگی</dt>
              <dd className="seller-panel__active">فعال</dd>
            </div>
            <div>
              <dt>کد پیگیری</dt>
              <dd dir="ltr">{seller.trackingCode}</dd>
            </div>
            <div>
              <dt>زمان فعال‌سازی</dt>
              <dd>
                <time dateTime={seller.activatedAtUtc}>
                  {new Intl.DateTimeFormat("fa-IR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(seller.activatedAtUtc))}
                </time>
              </dd>
            </div>
          </dl>
        </section>

        <section className="seller-panel__capabilities"
          aria-labelledby="seller-capabilities-heading">
          <div className="seller-panel__section-heading">
            <div>
              <h2 id="seller-capabilities-heading">قابلیت‌های عملیاتی</h2>
              <p>
                فقط قابلیت‌هایی که backend واقعی دارند فعال می‌شوند.
              </p>
            </div>
          </div>

          <div className="seller-panel__capability-grid">
            {capabilityCards.map(([label, key]) => (
              <article className="seller-panel__capability" key={key}>
                <strong>{label}</strong>
                <span className={seller.capabilities[key]
                  ? "seller-panel__capability-state seller-panel__capability-state--ready"
                  : "seller-panel__capability-state"}>
                  {seller.capabilities[key]
                    ? "فعال"
                    : "هنوز متصل نشده"}
                </span>
                <p>
                  {seller.capabilities[key]
                    ? "این قابلیت از سرویس واقعی حنا تغذیه می‌شود."
                    : "برای این بخش هنوز قرارداد اجرایی متصل نشده است؛ داده نمونه نمایش داده نمی‌شود."}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="seller-panel__notice">
          <strong>دسترسی فروشندگی فعال است.</strong>
          <p>
            فعال‌شدن نقش فروشنده فقط دسترسی این پنل را باز کرده است.
            سفارش، موجودی، قیمت‌گذاری و تسویه هرکدام در برش مستقل
            و پس از اتصال backend واقعی فعال می‌شوند.
          </p>
        </section>
      </section>
    </main>
  );
}
