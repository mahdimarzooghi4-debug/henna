"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  parseExternalIntegrationStatus,
  type ExternalIntegrationStatus,
} from "../../../lib/external-integration-status";

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
  logistics: {
    title: "لجستیک بیرونی",
    note: "حنا ناوگان داخلی جعل نمی‌کند؛ فقط adapter قراردادشده متصل می‌شود.",
  },
} as const;

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
    </main>
  );
}
