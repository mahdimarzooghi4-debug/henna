"use client";

import { useCallback, useEffect, useState } from "react";
import {
  organizationDate,
  organizationRial,
  parseOrganizationDashboard,
  type OrganizationDashboardData,
} from "../lib/organization-portal";

type State =
  | { kind: "loading" }
  | { kind: "ready"; value: OrganizationDashboardData }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

export function OrganizationDashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/organization/dashboard", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        signal,
        headers: { Accept: "application/json" },
      });
      const raw: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = raw && typeof raw === "object" && "message" in raw &&
          typeof raw.message === "string"
          ? raw.message
          : "دریافت وضعیت سازمان تأیید نشد.";
        setState(response.status === 401 || response.status === 403
          ? { kind: "denied", message }
          : { kind: "error", message });
        return;
      }
      const parsed = parseOrganizationDashboard(raw);
      setState(parsed
        ? { kind: "ready", value: parsed }
        : { kind: "error", message: "پاسخ سازمانی قابل اعتماد نیست." });
    } catch {
      if (!signal?.aborted)
        setState({
          kind: "error",
          message: "ارتباط با سرویس سازمانی برقرار نشد.",
        });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <main className="organization-portal organization-portal--gate" dir="rtl">
        <p className="form-status" role="status">
          در حال دریافت وضعیت واقعی سازمان…
        </p>
      </main>
    );
  }

  if (state.kind === "denied") {
    return (
      <main className="organization-portal organization-portal--gate" dir="rtl">
        <img className="organization-portal__logo" src="/hana-logo.png" alt="حنا" />
        <section className="organization-portal__message">
          <h1>پرتال سازمانی حنا</h1>
          <p role="alert">{state.message}</p>
          <a className="auth-card__secondary" href="/">بازگشت به حنا</a>
        </section>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="organization-portal organization-portal--gate" dir="rtl">
        <img className="organization-portal__logo" src="/hana-logo.png" alt="حنا" />
        <section className="organization-portal__message">
          <h1>پرتال سازمانی حنا</h1>
          <p role="alert">{state.message}</p>
          <button type="button" className="primary-button"
            onClick={() => void load()}>
            تلاش دوباره
          </button>
        </section>
      </main>
    );
  }

  const data = state.value;
  const funded = data.programs.reduce((sum, item) => sum + item.fundedRial, 0);
  const remaining = data.programs.reduce(
    (sum, item) => sum + item.unallocatedRial, 0);
  const beneficiaries = data.organizations.reduce(
    (sum, item) => sum + item.beneficiaryCount, 0);

  return (
    <main className="organization-portal" dir="rtl">
      <header className="organization-portal__header">
        <div>
          <img className="organization-portal__logo" src="/hana-logo.png" alt="حنا" />
          <p className="seller-panel__eyebrow">پرتال سازمانی</p>
          <h1>داشبورد سازمان‌های تحت مدیریت</h1>
          <p>
            این صفحه فقط دادهٔ ثبت‌شده و مجاز همان سازمان‌ها را نشان می‌دهد؛
            ورودی منبع داده یا تخصیص جدید بدون مسیر مصوب مالی ساخته نمی‌شود.
          </p>
        </div>
        <button type="button" className="seller-commerce__refresh"
          onClick={() => void load()}>
          تازه‌سازی
        </button>
      </header>

      <section className="organization-portal__metrics"
        aria-label="خلاصه واقعی پرتال سازمانی">
        <article>
          <span>سازمان تحت مدیریت</span>
          <strong>{new Intl.NumberFormat("fa-IR").format(data.organizations.length)}</strong>
        </article>
        <article>
          <span>مشمول ثبت‌شده</span>
          <strong>{new Intl.NumberFormat("fa-IR").format(beneficiaries)}</strong>
        </article>
        <article>
          <span>طرح ثبت‌شده</span>
          <strong>{new Intl.NumberFormat("fa-IR").format(data.programs.length)}</strong>
        </article>
        <article>
          <span>اعتبار تخصیص‌نیافته</span>
          <strong>{organizationRial(remaining)}</strong>
        </article>
      </section>

      <section className="organization-portal__panel">
        <div className="seller-commerce__section-title">
          <div>
            <h2>سازمان‌ها</h2>
            <p>عضویت مدیریتی فعال، بدون نمایش هویت مشمولان.</p>
          </div>
        </div>
        <div className="organization-portal__org-grid">
          {data.organizations.map(item => (
            <article key={item.id} className="organization-portal__org-card">
              <h3>{item.name}</h3>
              <dl className="seller-commerce__facts">
                <div><dt>مدیر فعال</dt><dd>{item.managerCount}</dd></div>
                <div><dt>مشمول فعال</dt><dd>{item.beneficiaryCount}</dd></div>
                <div><dt>طرح</dt><dd>{item.programCount}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="organization-portal__panel">
        <div className="seller-commerce__section-title">
          <div>
            <h2>طرح‌های مرتبط</h2>
            <p>
              منابع و ضرایب فقط از رکوردهای مصوب سرور می‌آیند؛ این نما امکان
              تغییر خودسرانه الگوریتم یا تأمین مالی نمی‌دهد.
            </p>
          </div>
          <span>کل ثبت‌شده: {organizationRial(funded)}</span>
        </div>

        {data.programs.length === 0 ? (
          <p className="seller-commerce__empty">
            هنوز طرحی برای سازمان‌های تحت مدیریت ثبت نشده است.
          </p>
        ) : (
          <div className="organization-portal__programs">
            {data.programs.map(program => (
              <article key={program.id} className="organization-portal__program">
                <div>
                  <h3>{program.name}</h3>
                  <p>انقضا: {organizationDate(program.expiresAtUtc)}</p>
                </div>
                <dl>
                  <div>
                    <dt>اعتبار ثبت‌شده</dt>
                    <dd>{organizationRial(program.fundedRial)}</dd>
                  </div>
                  <div>
                    <dt>باقی‌مانده تخصیص</dt>
                    <dd>{organizationRial(program.unallocatedRial)}</dd>
                  </div>
                  <div>
                    <dt>دسته مجاز</dt>
                    <dd>{new Intl.NumberFormat("fa-IR").format(program.categoryCount)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="organization-portal__signals">
        <article>
          <span>اعلان خوانده‌نشده مدیر</span>
          <strong>{new Intl.NumberFormat("fa-IR").format(data.unreadNotifications)}</strong>
        </article>
        <article>
          <span>تیکت باز مدیر</span>
          <strong>{new Intl.NumberFormat("fa-IR").format(data.openTickets)}</strong>
        </article>
      </section>

      <p className="organization-portal__boundary">
        همگام‌سازی افراد/API بیرونی سازمان و ایجاد منبع مالی واقعی هنوز نیازمند
        اتصال و دادهٔ مورد تأیید است؛ این صفحه هیچ «همگام‌سازی موفق» یا تخصیص
        ساختگی نمایش نمی‌دهد.
      </p>
    </main>
  );
}
