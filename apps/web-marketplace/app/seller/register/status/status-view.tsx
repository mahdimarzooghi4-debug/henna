"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StatusPayload = {
  trackingCode: string;
  overallStatus: "UNDER_REVIEW";
  applicantType: "NATURAL" | "LEGAL";
  identityStatus: "VERIFIED" | "RECORDED";
  submittedAtUtc: string;
  accuracyConfirmedAtUtc: string;
  sellerPanelEnabled: false;
  steps: Array<{
    key: "IDENTITY" | "BUSINESS" | "ACTIVITY" | "ADDITIONAL" | "REVIEW";
    status: "COMPLETED" | "UNDER_REVIEW";
  }>;
};

const labels: Record<StatusPayload["steps"][number]["key"], string> = {
  IDENTITY: "اطلاعات هویتی",
  BUSINESS: "اطلاعات کسب‌وکار",
  ACTIVITY: "محدوده فعالیت",
  ADDITIONAL: "اطلاعات تکمیلی",
  REVIEW: "بررسی درخواست",
};

export function SellerApplicationStatusView() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; value: StatusPayload }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/seller/registration/status", {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message = body && typeof body === "object" &&
          "message" in body && typeof body.message === "string"
          ? body.message
          : "وضعیت درخواست فعلاً در دسترس نیست.";
        setState({ kind: "error", message });
        return;
      }
      const body = await response.json() as StatusPayload;
      setState({ kind: "ready", value: body });
    }).catch(() => {
      if (!controller.signal.aborted)
        setState({
          kind: "error",
          message: "وضعیت درخواست فعلاً در دسترس نیست.",
        });
    });
    return () => controller.abort();
  }, []);

  if (state.kind === "loading") {
    return <p className="form-status" role="status">
      در حال دریافت وضعیت درخواست…
    </p>;
  }

  if (state.kind === "error") {
    return (
      <section className="seller-status-card seller-status-card--error">
        <h2>وضعیت درخواست</h2>
        <p role="alert">{state.message}</p>
        <Link className="auth-card__secondary" href="/seller/register">
          بازگشت به ثبت‌نام
        </Link>
      </section>
    );
  }

  const value = state.value;
  return (
    <section className="seller-status-card"
      aria-labelledby="seller-status-title">
      <div className="seller-status-card__hero">
        <span className="seller-status-card__badge">در حال بررسی</span>
        <div>
          <h2 id="seller-status-title">درخواست در حال بررسی است</h2>
          <p>
            اطلاعات ثبت‌نام شما دریافت شده و درخواست در حال بررسی است.
          </p>
        </div>
        <strong dir="ltr">کد پیگیری: {value.trackingCode}</strong>
      </div>

      <dl className="seller-status-card__summary">
        <div>
          <dt>نوع حساب</dt>
          <dd>{value.applicantType === "LEGAL"
            ? "شخص حقوقی"
            : "شخص حقیقی"}</dd>
        </div>
        <div>
          <dt>احراز هویت</dt>
          <dd>{value.identityStatus === "VERIFIED"
            ? "تأیید شده"
            : "اطلاعات ثبت شده"}</dd>
        </div>
        <div>
          <dt>زمان ثبت درخواست</dt>
          <dd>
            <time dateTime={value.submittedAtUtc}>
              {new Intl.DateTimeFormat("fa-IR", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(value.submittedAtUtc))}
            </time>
          </dd>
        </div>
      </dl>

      <div className="seller-status-card__timeline">
        <h3>وضعیت ثبت‌نام فروشنده</h3>
        {value.steps.map((step) => (
          <div className="seller-status-card__step" key={step.key}>
            <span className={step.status === "COMPLETED"
              ? "seller-status-card__state seller-status-card__state--done"
              : "seller-status-card__state"}>
              {step.status === "COMPLETED" ? "تکمیل شده" : "در حال بررسی"}
            </span>
            <strong>{labels[step.key]}</strong>
          </div>
        ))}
      </div>

      <div className="seller-status-card__panel-lock">
        <strong>ورود به پنل فروشنده</strong>
        <p>
          پس از تأیید نهایی درخواست و فعال‌سازی، پنل فروشنده در دسترس
          خواهد بود.
        </p>
        <button type="button" disabled>
          ورود به پنل فروشنده
        </button>
      </div>

      <p className="seller-status-card__note">
        تأیید هویت مستقل از بررسی نهایی درخواست فروشندگی است.
      </p>

      <Link className="auth-card__secondary" href="/">
        بازگشت به حنا
      </Link>
    </section>
  );
}
