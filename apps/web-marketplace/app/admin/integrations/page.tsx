"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  parseExternalIntegrationStatus,
  type ExternalIntegrationStatus,
} from "../../../lib/external-integration-status";
import {
  parseMonoDeliveryStatusView,
  type MonoDeliveryStatusView,
} from "../../../lib/mono-delivery-status";

type State =
  | { kind: "loading" }
  | { kind: "ready"; value: ExternalIntegrationStatus }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body &&
      typeof (body as Record<string, unknown>).message === "string"
      ? (body as Record<string, string>).message
      : "وضعیت اتصال‌ها قابل دریافت نیست.";
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}

const labels = {
  sms: {
    title: "پیامک OTP",
    note: "ورود عمومی فقط پس از adapter واقعی SMS فعال می‌شود.",
  },
  sellerIdentity: {
    title: "احراز هویت فروشنده حقیقی",
    note: "تطبیق کد ملی و شماره همراه فقط با provider مجاز انجام می‌شود.",
  },
  payment: {
    title: "PSP / پرداخت بیرونی",
    note: "هیچ پرداخت بانکی تا اتصال adapter واقعی موفق اعلام نمی‌شود.",
  },
  ibanOwnership: {
    title: "احراز مالکیت شبا",
    note: "برداشت فقط پس از تأیید واقعی تعلق شبا به همان خریدار مجاز است؛ فرمت شبا کافی نیست.",
  },
  logistics: {
    title: "لجستیک بیرونی",
    note: "حنا ناوگان داخلی جعل نمی‌کند؛ فقط adapter قراردادشده متصل می‌شود.",
  },
} as const;

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; value: MonoDeliveryStatusView }
  | { kind: "error"; message: string };

const orderIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function MonoDeliveryStatusLookup() {
  const [orderId, setOrderId] = useState("");
  const [state, setState] = useState<LookupState>({ kind: "idle" });

  const lookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = orderId.trim();
    if (!orderIdPattern.test(normalized)) {
      setState({ kind: "error", message: "شناسه سفارش معتبر نیست." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const response = await fetch(
        "/api/admin/integrations/mono/order-status?orderId=" +
        encodeURIComponent(normalized), {
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          headers: { Accept: "application/json" },
        });
      const raw: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = raw && typeof raw === "object" && "message" in raw &&
          typeof (raw as Record<string, unknown>).message === "string"
          ? (raw as Record<string, string>).message
          : "وضعیت سفارش قابل دریافت نیست.";
        throw Error(message);
      }
      const parsed = parseMonoDeliveryStatusView(raw);
      if (!parsed || parsed.orderId !== normalized.toLowerCase())
        throw Error("پاسخ وضعیت با سفارش واردشده تطبیق ندارد.");
      setState({ kind: "ready", value: parsed });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error
        ? error.message : "وضعیت سفارش قابل دریافت نیست." });
    }
  };

  const value = state.kind === "ready" ? state.value : null;
  return (
    <section className="admin-ops__section">
      <h2>وضعیت درخواست حمل مونو</h2>
      <p>
        این بخش فقط وضعیت سفارش هم‌بسته را می‌خواند؛ ارسال درخواست، تأیید قیمت
        یا ایجاد مأموریت انجام نمی‌دهد.
      </p>
      <form onSubmit={lookup} className="seller-commerce__form">
        <label htmlFor="mono-order-id">شناسه سفارش حنا</label>
        <input id="mono-order-id" name="orderId" inputMode="text"
          autoComplete="off" maxLength={36} value={orderId}
          onChange={event => setOrderId(event.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        <button type="submit" className="seller-commerce__refresh"
          disabled={state.kind === "loading"}>
          {state.kind === "loading" ? "در حال دریافت…" : "خواندن وضعیت"}
        </button>
      </form>
      {state.kind === "error" &&
        <p className="form-status form-status--error" role="alert">
          {state.message}
        </p>}
      {value && (
        <div className="admin-ops__grid" aria-live="polite">
          <article className="admin-ops__section">
            <h3>هم‌بستگی حنا و مونو</h3>
            <p>وضعیت محلی: {value.correlationState}</p>
            <p>شناسه درخواست مونو: {value.deliveryRequestId ?? "هنوز ثبت نشده"}</p>
            {!value.deliveryRequestId &&
              <p>این سفارش هنوز شناسهٔ درخواست ثبت‌شده در مونو ندارد.</p>}
            {value.providerStatus && <p>وضعیت درخواست: {value.providerStatus}</p>}
            {value.missionId && <p>شناسه مأموریت: {value.missionId}</p>}
            {value.missionStatus && <p>وضعیت مأموریت: {value.missionStatus}</p>}
          </article>
          {value.missionId && <article className="admin-ops__section" aria-live="polite">
            <h3>موقعیت فعلی پیک</h3>
            {value.courierLocation ? <>
              <p>آخرین دریافت: {new Date(value.courierLocation.observedAt).toLocaleString("fa-IR")}</p>
              {value.courierLocation.accuracyMeters !== null &&
                <p>دقت گزارش‌شده: حدود {Math.round(value.courierLocation.accuracyMeters).toLocaleString("fa-IR")} متر</p>}
              <p dir="ltr">{value.courierLocation.latitude.toFixed(5)}, {value.courierLocation.longitude.toFixed(5)}</p>
              <a href={`geo:${value.courierLocation.latitude},${value.courierLocation.longitude}?q=${value.courierLocation.latitude},${value.courierLocation.longitude}`}>
                بازکردن موقعیت در نقشهٔ دستگاه
              </a>
              <small>تنها آخرین موقعیت تازهٔ مأموریت فعال نمایش داده می‌شود.</small>
            </> : <p>موقعیت تازه‌ای برای این مأموریت در دسترس نیست.</p>}
          </article>}
          <article className="admin-ops__section">
            <h3>قیمت و زمان تحویل اعلام‌شده</h3>
            {value.quote ? <>
              <p>کرایه: {value.quote.fareToman.toLocaleString("fa-IR")} تومان</p>
              <p>سهم خریدار: {value.quote.buyerShareToman.toLocaleString("fa-IR")} تومان</p>
              <p>سهم فروشنده: {value.quote.sellerShareToman.toLocaleString("fa-IR")} تومان</p>
              <p>{value.quote.isExpired ? "این Quote منقضی شده است." : "Quote هنوز منقضی اعلام نشده است."}</p>
            </> : <p>هنوز Quoteای در پاسخ مونو موجود نیست.</p>}
            {value.promise
              ? <p>زمان تحویل تعهدشده: {new Date(value.promise.committedDeliveryAt).toLocaleString("fa-IR")}</p>
              : <p>هنوز Promise ثبت‌شده‌ای موجود نیست.</p>}
          </article>
        </div>
      )}
    </section>
  );
}

export default function AdminIntegrationsPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const raw = await readJson(await fetch("/api/admin/integrations/status", {
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        signal,
        headers: { Accept: "application/json" },
      }));
      const parsed = parseExternalIntegrationStatus(raw);
      if (!parsed) throw Error("پاسخ وضعیت اتصال‌ها قابل اعتماد نیست.");
      setState({ kind: "ready", value: parsed });
    } catch (error) {
      if (signal?.aborted) return;
      const status = (error as Error & { status?: number }).status;
      const message = error instanceof Error
        ? error.message : "وضعیت اتصال‌ها قابل دریافت نیست.";
      setState(status === 401 || status === 403
        ? { kind: "denied", message }
        : { kind: "error", message });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <main className="admin-ops">
      <header className="admin-ops__header">
        <div>
          <img src="/hana-logo.png" alt="حنا" className="support-panel__logo" />
          <p className="seller-panel__eyebrow">مرزهای بیرونی حنا</p>
          <h1>آمادگی اتصال سرویس‌ها</h1>
          <p>
            این صفحه availability واقعی adapterها را نشان می‌دهد؛
            وجود تنظیمات یا UI به‌تنهایی هیچ سرویس بیرونی را آماده اعلام نمی‌کند.
          </p>
        </div>
        <div className="admin-ops__header-actions">
          <Link href="/admin/operations" className="auth-card__secondary">
            عملیات داخلی
          </Link>
          <button type="button" className="seller-commerce__refresh"
            disabled={state.kind === "loading"} onClick={() => void load()}>
            تازه‌سازی
          </button>
        </div>
      </header>

      {state.kind === "loading" &&
        <p className="form-status">در حال بررسی adapterها…</p>}
      {(state.kind === "error" || state.kind === "denied") &&
        <p className="form-status form-status--error" role="alert">
          {state.message}
        </p>}

      {state.kind === "ready" && (
        <>
          <section className="admin-ops__section">
            <h2>گیت اتصال بیرونی</h2>
            <p className={state.value.allExternalReady
              ? "admin-integrity admin-integrity--ok"
              : "admin-integrity admin-integrity--bad"} role="status">
              {state.value.allExternalReady
                ? "همه adapterهای بیرونی موردنیاز آماده گزارش شده‌اند."
                : "حداقل یک adapter بیرونی هنوز آماده نیست؛ انتشار وابسته به آن باید بسته بماند."}
            </p>
          </section>

          <section className="admin-ops__grid">
            {(Object.keys(labels) as Array<keyof typeof labels>).map(key => {
              const entry = state.value[key];
              return (
                <article className="admin-ops__section" key={key}>
                  <h2>{labels[key].title}</h2>
                  <p className={entry.configured
                    ? "admin-integrity admin-integrity--ok"
                    : "admin-integrity admin-integrity--bad"}>
                    {entry.configured ? "adapter آماده است" : "adapter آماده نیست"}
                  </p>
                  <p>{labels[key].note}</p>
                </article>
              );
            })}
          </section>
        </>
      )}
      <MonoDeliveryStatusLookup />
    </main>
  );
}
