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
  sellerPanelEnabled: boolean;
  steps: Array<{
    key: "IDENTITY" | "BUSINESS" | "ACTIVITY" | "ADDITIONAL" | "REVIEW";
    status: "COMPLETED" | "UNDER_REVIEW" | "NEEDS_INFORMATION" |
      "APPROVED" | "REJECTED";
  }>;
};

const digits = "۰۱۲۳۴۵۶۷۸۹";
const faDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (digit) => digits[Number(digit)]);
const labels: Record<StatusPayload["steps"][number]["key"], string> = {
  IDENTITY: "اطلاعات هویتی",
  BUSINESS: "اطلاعات کسب‌وکار",
  ACTIVITY: "محدوده فعالیت",
  ADDITIONAL: "اطلاعات تکمیلی",
  REVIEW: "بررسی درخواست",
};

function statusLabel(status: StatusPayload["steps"][number]["status"]) {
  switch (status) {
    case "COMPLETED": return "تکمیل شده";
    case "UNDER_REVIEW": return "در حال بررسی";
    case "NEEDS_INFORMATION": return "نیازمند تکمیل اطلاعات";
    case "APPROVED": return "تأیید شده";
    case "REJECTED": return "رد شده";
  }
}

function StatusIcon({ kind }: { kind: "file" | "map" | "store" }) {
  if (kind === "file") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/></svg>;
  if (kind === "map") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 7V4h8v3M4 11h16M10 11v3h4v-3"/></svg>;
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
        setState({ kind: "error", message: "وضعیت درخواست فعلاً در دسترس نیست." });
    });
    return () => controller.abort();
  }, []);

  const actual = state.kind === "ready" ? state.value : null;
  const statusExamples = [
    {
      kind: "incomplete",
      badge: "نیازمند تکمیل اطلاعات",
      code: "۷۸۴۰",
      name: "کسب‌وکار نمونه",
      text: "تصویر مجوز کسب ارائه شده ناخوانا است یا اعتبار آن منقضی شده است. لطفاً مدرک جدید را مجدداً بارگذاری کنید.",
      action: "ویرایش و ارسال مجدد مدارک",
      href: "/seller/register/amendment",
    },
    {
      kind: "reviewing",
      badge: "در حال بررسی کارشناسی",
      code: "۷۸۳۹",
      name: "لبنیات محلی البرز",
      text: "مدارک هویتی و محدوده توزیع در حال انطباق با بانک اطلاعات اصناف است. این فرآیند معمولاً کمتر از ۲۴ ساعت به طول می‌انجامد.",
      action: "پیگیری از پشتیبانی",
      href: "/support",
    },
    {
      kind: "approved",
      badge: "تأیید نهایی شده",
      code: "۷۸۳۸",
      name: "نانوایی سنتی برکت محله",
      text: "نمونه وضعیت تأیید شده: در صورت تأیید درخواست، مراحل بعدی و دسترسی‌های مرتبط در همین بخش اعلام می‌شود.",
      action: "ورود به پنل کار و مدیریت فروشگاه",
      href: "/seller",
    },
  ] as const;

  return <main className="seller-status-page" dir="rtl">
    <section className="seller-status-intro">
      <h1>بررسی وضعیت درخواست عضویت کسب‌وکارها و فروشگاه‌ها</h1>
      <p>در این بخش می‌توانید وضعیت درخواست، بخش‌های ارسال‌شده و موارد نیازمند تکمیل را پیگیری کنید. بررسی درخواست بدون تضمین نتیجه انجام می‌شود.</p>
    </section>

    <section className="seller-status-showcases" aria-label="نمونه وضعیت درخواست‌های فروشندگی">
      <div className="seller-status-heading-row">
        <span>مراحل تقاضای ثبت‌نام در یک نگاه</span>
        <h2>وضعیت تقاضاهای فعال کسب‌وکار</h2>
      </div>
      <div className="seller-status-grid">
        {statusExamples.map((item) => <article
          className={`seller-status-example seller-status-example--${item.kind}`}
          key={item.code}>
          <div className="seller-status-example__top">
            <span className="seller-status-example__badge">{item.badge}</span>
            <span>کد پیگیری: <bdi dir="ltr">#{item.code}</bdi></span>
          </div>
          <h3>{item.name}</h3>
          <p>{item.text}</p>
          <div className="seller-status-example__actions">
            <Link href={item.href}>{item.action}</Link>
          </div>
        </article>)}
      </div>
    </section>

    <section className="seller-submitted-sections">
      <h2>جزئیات بخش‌های ارسال‌شده درخواست شماره <bdi dir="ltr">#۷۸۴۰</bdi></h2>
      <div className="seller-submitted-sections__grid">
        <article className="seller-submitted-section seller-submitted-section--review">
          <div className="seller-submitted-section__top"><span>نیازمند بازنگری</span><StatusIcon kind="file"/></div>
          <h3>بارگذاری مجوز فعالیت و صنف</h3>
          <p>تصویر جواز کسب فاقد کیفیت است. لطفاً یک عکس واضح با فرمت JPG بارگذاری کنید.</p>
        </article>
        <article className="seller-submitted-section">
          <div className="seller-submitted-section__top seller-submitted-section__top--approved"><span>تأیید شده</span><StatusIcon kind="map"/></div>
          <h3>محدوده فعالیت و تحویل محلی</h3>
          <p>توزیع کالاها تا شعاع ۳ کیلومتری محله شما تعیین گردید و مورد تأیید سامانه ترافیکی است.</p>
        </article>
        <article className="seller-submitted-section">
          <div className="seller-submitted-section__top seller-submitted-section__top--approved"><span>تأیید شده</span><StatusIcon kind="store"/></div>
          <h3>مشخصات کسب‌وکار و آدرس</h3>
          <p>نام تجاری، تلفن تماس و آدرس پستی دقیق انبار یا فروشگاه تأیید شد.</p>
        </article>
      </div>
    </section>

    {actual && <details className="seller-status-actual">
      <summary>وضعیت واقعی درخواست این حساب</summary>
      <div className="seller-status-actual__content">
        <p><strong>کد پیگیری:</strong> <bdi dir="ltr">#{faDigits(actual.trackingCode)}</bdi></p>
        <p><strong>وضعیت درخواست:</strong> {actual.overallStatus === "NEEDS_INFORMATION"
          ? "نیازمند تکمیل اطلاعات"
          : actual.overallStatus === "UNDER_REVIEW" ? "در حال بررسی"
            : actual.overallStatus === "APPROVED" ? "تأیید شده" : "رد شده"}</p>
        <p><strong>نوع حساب:</strong> {actual.applicantType === "LEGAL" ? "شخص حقوقی" : "شخص حقیقی"}</p>
        <p><strong>زمان ثبت:</strong> {new Intl.DateTimeFormat("fa-IR", {
          dateStyle: "medium", timeStyle: "short",
        }).format(new Date(actual.submittedAtUtc))}</p>
        {actual.steps.map((step) => <p key={step.key}>
          <strong>{labels[step.key]}:</strong> {statusLabel(step.status)}
        </p>)}
        {actual.reviewReason && <p><strong>یادداشت بررسی:</strong> {actual.reviewReason}</p>}
        {actual.sellerPanelEnabled && <Link href="/seller">ورود به پنل فروشنده</Link>}
      </div>
    </details>}
    {state.kind === "error" && state.message !== "برای مشاهده وضعیت درخواست ابتدا وارد شوید." &&
      <p className="seller-status-service-note" role="status">{state.message}</p>}
  </main>;
}
