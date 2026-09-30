"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StatusPayload = {
  trackingCode: string;
  overallStatus: "UNDER_REVIEW" | "NEEDS_INFORMATION" | "APPROVED" | "REJECTED";
  applicantType: "NATURAL" | "LEGAL";
  identityStatus: "VERIFIED" | "RECORDED";
  submittedAtUtc: string;
  accuracyConfirmedAtUtc: string;
  reviewReason: string | null;
  reviewedAtUtc: string | null;
  activatedAtUtc: string | null;
  sellerAccessEnabled: boolean;
  sellerPanelEnabled: false;
  steps: Array<{
    key: "IDENTITY" | "BUSINESS" | "ACTIVITY" | "ADDITIONAL" | "REVIEW";
    status: "COMPLETED" | "UNDER_REVIEW" | "NEEDS_INFORMATION" |
      "APPROVED" | "REJECTED";
  }>;
};

const labels: Record<StatusPayload["steps"][number]["key"], string> = {
  IDENTITY: "اطلاعات هویتی",
  BUSINESS: "اطلاعات کسب‌وکار",
  ACTIVITY: "محدوده فعالیت",
  ADDITIONAL: "اطلاعات تکمیلی",
  REVIEW: "بررسی درخواست",
};

const reviewCopy = {
  UNDER_REVIEW: {
    badge: "در حال بررسی",
    title: "درخواست در حال بررسی است",
    message: "اطلاعات ثبت‌نام شما دریافت شده و درخواست در حال بررسی است.",
  },
  NEEDS_INFORMATION: {
    badge: "نیازمند تکمیل اطلاعات",
    title: "اطلاعات بیشتری برای بررسی لازم است",
    message: "بررسی‌کننده برای ادامه فرایند، تکمیل اطلاعات را درخواست کرده است.",
  },
  APPROVED: {
    badge: "تأیید شده",
    title: "درخواست فروشندگی تأیید شده است",
    message: "بررسی درخواست با تأیید پایان یافته است؛ فعال‌سازی پنل فروشنده مرحله‌ای مستقل است.",
  },
  REJECTED: {
    badge: "رد شده",
    title: "درخواست فروشندگی تأیید نشد",
    message: "نتیجه بررسی درخواست ثبت شده است.",
  },
} as const;

function statusLabel(status: StatusPayload["steps"][number]["status"]) {
  switch (status) {
    case "COMPLETED": return "تکمیل شده";
    case "UNDER_REVIEW": return "در حال بررسی";
    case "NEEDS_INFORMATION": return "نیازمند تکمیل اطلاعات";
    case "APPROVED": return "تأیید شده";
    case "REJECTED": return "رد شده";
  }
}

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
  const copy = reviewCopy[value.overallStatus];
  return (
    <section className="seller-status-card"
      aria-labelledby="seller-status-title">
      <div className="seller-status-card__hero">
        <span className="seller-status-card__badge">{copy.badge}</span>
        <div>
          <h2 id="seller-status-title">{copy.title}</h2>
          <p>{copy.message}</p>
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
              {statusLabel(step.status)}
            </span>
            <strong>{labels[step.key]}</strong>
          </div>
        ))}
      </div>

      {value.reviewReason && (
        <div className="seller-status-card__review-note" role="status">
          <strong>یادداشت بررسی</strong>
          <p>{value.reviewReason}</p>
          {value.reviewedAtUtc && (
            <time dateTime={value.reviewedAtUtc}>
              {new Intl.DateTimeFormat("fa-IR", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(value.reviewedAtUtc))}
            </time>
          )}
        </div>
      )}

      {value.overallStatus === "NEEDS_INFORMATION" && (
        <div className="seller-status-card__action-required">
          <strong>اقدام شما لازم است</strong>
          <p>
            برای ادامه بررسی، پاسخ اصلاحی را ثبت و درخواست را دوباره
            ارسال کنید.
          </p>
          <Link className="primary-button"
            href="/seller/register/amendment">
            تکمیل اطلاعات و ارسال مجدد
          </Link>
        </div>
      )}

      <div className="seller-status-card__panel-lock">
        <strong>
          {value.sellerAccessEnabled
            ? "دسترسی فروشندگی فعال شد"
            : "ورود به پنل فروشنده"}
        </strong>
        <p>
          {value.sellerAccessEnabled
            ? "نقش فروشنده برای این حساب فعال است. رابط پنل فروشنده در مرحله مستقل بعدی متصل می‌شود."
            : "پس از تأیید نهایی و فعال‌سازی، دسترسی فروشندگی برای این حساب ایجاد می‌شود."}
        </p>
        {value.activatedAtUtc && (
          <time dateTime={value.activatedAtUtc}>
            زمان فعال‌سازی: {new Intl.DateTimeFormat("fa-IR", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(value.activatedAtUtc))}
          </time>
        )}
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
