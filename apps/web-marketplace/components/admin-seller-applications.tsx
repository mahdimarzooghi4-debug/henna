"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

type ReviewStatus = "UNDER_REVIEW" | "NEEDS_INFORMATION" | "APPROVED" | "REJECTED";
type ReviewAction = "NEEDS_INFORMATION" | "APPROVED" | "REJECTED";
type StatusFilter = "ALL" | ReviewStatus;
type ApplicationListItem = {
  applicationId: string;
  storeName: string;
  ownerName: string;
  applicantType: "NATURAL" | "LEGAL";
  identityStatus: "VERIFIED" | "RECORDED";
  businessCategoryId: string | null;
  businessName: string | null;
  offeringType: "GOOD" | null;
  status: "SUBMITTED";
  revision: number;
  trackingCode: string;
  reviewStatus: ReviewStatus;
  reviewedAtUtc: string | null;
  submittedAtUtc: string;
};
type ApplicationPage = { items: ApplicationListItem[]; page: number; pageSize: number; total: number };
type ReviewHistoryItem = { expectedRevision: number; decision: ReviewStatus; reason: string | null; createdAtUtc: string };
type ApplicationDetail = ApplicationListItem & {
  nationalCodeMasked: string | null;
  legalNationalIdMasked: string | null;
  legalName: string | null;
  legalRepresentativeName: string | null;
  legalRepresentativePhoneMasked: string | null;
  businessDescription: string | null;
  businessPhone: string | null;
  activityProvinceId: string | null;
  activityCityId: string | null;
  activityAddress: string;
  activityHours: string;
  sellerDelivery: boolean;
  pickup: boolean;
  serviceArea: string | null;
  registrationContactName: string;
  registrationContactRole: string | null;
  backupPhoneMasked: string | null;
  websiteOrSocial: string | null;
  businessEmail: string | null;
  responseHours: string;
  documentsRequired: false;
  phoneMasked: string | null;
  city: string;
  address: string;
  postalCode: string;
  reviewReason: string | null;
  reviewedAtUtc: string | null;
  reviewHistory: ReviewHistoryItem[];
};

const statuses: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "همه درخواست‌ها" },
  { value: "UNDER_REVIEW", label: "در حال بررسی" },
  { value: "NEEDS_INFORMATION", label: "نیازمند تکمیل اطلاعات" },
  { value: "APPROVED", label: "تأیید شده" },
  { value: "REJECTED", label: "رد شده" },
];
const statusLabel: Record<ReviewStatus, string> = {
  UNDER_REVIEW: "در حال بررسی",
  NEEDS_INFORMATION: "نیازمند تکمیل اطلاعات",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
};
const nav = [
  { group: "نمای کلی", items: [{ label: "داشبورد", icon: "imgFrame" }] },
  { group: "بازارگاه", items: [
    { label: "کاربران و حساب‌ها", icon: "imgUsersIcon" },
    { label: "سازمان‌ها", icon: "imgUsersIcon" },
    { label: "فروشندگان و ارائه‌دهندگان", icon: "imgStoreIcon" },
    { label: "درخواست‌های ثبت‌نام فروشنده", icon: "imgClipboardIcon", active: true },
    { label: "کالاها و خدمات", icon: "imgFrame1" },
    { label: "دسته‌بندی‌ها", icon: "imgFolderIcon" },
    { label: "سفارش‌ها", icon: "imgFrame2" },
  ] },
  { group: "عملیات و طرح‌ها", items: [
    { label: "طرح‌ها و اعتبارها", icon: "imgFrame3" },
    { label: "مشارکت اجتماعی", icon: "imgMessageIcon" },
    { label: "ارسال و ارائه‌دهندگان لجستیک", icon: "imgFrame4" },
    { label: "تسویه‌ها و تراکنش‌ها", icon: "imgFrame5" },
    { label: "پشتیبانی", icon: "imgHelpIcon" },
    { label: "اعلان‌ها", icon: "imgFrame6" },
  ] },
  { group: "مدیریت سامانه", items: [
    { label: "گزارش‌ها", icon: "imgFrame7" },
    { label: "محتوا", icon: "imgFileIcon" },
    { label: "کاربران پنل و دسترسی‌ها", icon: "imgShieldIcon" },
    { label: "تنظیمات", icon: "imgSettingsIcon" },
  ] },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "ثبت نشده";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "ثبت نشده";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "short", timeZone: "Asia/Tehran",
  }).format(date);
}

function applicantType(value: "NATURAL" | "LEGAL") {
  return value === "LEGAL" ? "شخص حقوقی" : "شخص حقیقی";
}

function identityStatus(value: "VERIFIED" | "RECORDED") {
  return value === "VERIFIED" ? "تأیید شده" : "ثبت شده";
}

async function responseMessage(response: Response) {
  try {
    const value: unknown = await response.json();
    if (value && typeof value === "object" && "message" in value && typeof value.message === "string")
      return value.message;
  } catch { /* Use the local safe fallback below. */ }
  return response.status === 401 ? "برای ادامه دوباره وارد شوید."
    : response.status === 403 ? "دسترسی مدیریت برای این حساب فعال نیست."
      : "دریافت اطلاعات انجام نشد؛ دوباره تلاش کنید.";
}

function AdminShell({ children, assetPrefix }: { children: ReactNode; assetPrefix: "list" | "detail" }) {
  return (
    <div className="admin-shell" dir="ltr">
      <div className="admin-main" dir="rtl">
        <header className="admin-topbar">
          <div className="admin-topbar__account">
            <span className="admin-topbar__role">پنل مدیریت</span>
            <span className="admin-topbar__divider" aria-hidden="true" />
            <span className="admin-topbar__notification" aria-label="اعلان‌ها">
              <img src={`/admin-assets/${assetPrefix}-imgNotifBtn.svg`} alt="" width="36" height="36" />
            </span>
          </div>
        </header>
        {children}
      </div>
      <aside className="admin-sidebar" dir="rtl" aria-label="منوی مدیریت">
        <div className="admin-sidebar__brand">
          <img src={`/admin-assets/${assetPrefix}-imgLogo.png`} alt="نشان حنا" width="48" height="48" />
          <div><strong>مدیریت حنا</strong><span>پنل مدیریت بازارگاه</span></div>
        </div>
        <nav className="admin-sidebar__nav">
          {nav.map((group) => <section className="admin-sidebar__group" key={group.group}>
            <h2>{group.group}</h2>
            {group.items.map((item) => <div
              className={`admin-sidebar__item${"active" in item && item.active ? " admin-sidebar__item--active" : ""}`}
              key={item.label}
              aria-current={"active" in item && item.active ? "page" : undefined}
              title={item.label}
            >
              <span>{item.label}</span>
              <img src={`/admin-assets/${assetPrefix}-${item.icon}.svg`} alt="" width="20" height="20" />
            </div>)}
          </section>)}
        </nav>
      </aside>
    </div>
  );
}

function Notice({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  return <p className={`admin-notice admin-notice--${tone}`} role="status">{children}</p>;
}

export function AdminSellerApplicationsList() {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApplicationPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), reviewStatus: filter });
    fetch(`/api/admin/seller-applications?${query}`, {
      cache: "no-store", credentials: "same-origin", signal: abort.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(await responseMessage(response));
      return response.json() as Promise<ApplicationPage>;
    }).then((result) => setData(result)).catch((reason: unknown) => {
      if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "دریافت فهرست انجام نشد.");
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [filter, page, refresh]);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return <AdminShell assetPrefix="list">
    <main className="admin-content">
      <div className="admin-page-heading">
        <h1>درخواست‌های ثبت‌نام فروشنده</h1>
        <p>بررسی درخواست‌های ثبت‌نام فروشندگان و ارائه‌دهندگان در بازارگاه حنا</p>
      </div>

      <div className="admin-filters" role="group" aria-label="فیلتر وضعیت بررسی">
        {statuses.map((status) => <button
          type="button"
          key={status.value}
          className={`admin-filter${filter === status.value ? " admin-filter--active" : ""}`}
          aria-pressed={filter === status.value}
          onClick={() => { setFilter(status.value); setPage(1); }}
        >{status.label}</button>)}
      </div>

      <section className="admin-table-card" aria-label="فهرست درخواست‌ها">
        {error ? <div className="admin-empty"><Notice>{error}</Notice><button className="admin-secondary-button" type="button" onClick={() => setRefresh((x) => x + 1)}>تلاش دوباره</button></div>
          : loading ? <div className="admin-empty" role="status">در حال دریافت فهرست…</div>
            : data?.items.length === 0 ? <div className="admin-empty">در این وضعیت درخواستی ثبت نشده است.</div>
              : <div className="admin-table-scroll"><div className="admin-table" role="table" aria-label="درخواست‌های ثبت‌نام فروشنده">
                <div className="admin-table__row admin-table__head" role="row">
                  <span role="columnheader">متقاضی</span><span role="columnheader">حقیقی / حقوقی</span>
                  <span role="columnheader">کسب‌وکار</span><span role="columnheader">وضعیت هویتی</span>
                  <span role="columnheader">وضعیت درخواست</span><span role="columnheader">تاریخ ثبت</span>
                  <span role="columnheader">عملیات</span>
                </div>
                {data?.items.map((item) => <div className="admin-table__row" role="row" key={item.applicationId}>
                  <span className="admin-applicant" role="cell">{item.ownerName}</span>
                  <span role="cell">{applicantType(item.applicantType)}</span>
                  <span role="cell">{item.businessName ?? item.storeName}</span>
                  <span className={`admin-identity admin-identity--${item.identityStatus.toLowerCase()}`} role="cell">{identityStatus(item.identityStatus)}</span>
                  <span role="cell"><span className={`admin-badge admin-badge--${item.reviewStatus.toLowerCase()}`}>{statusLabel[item.reviewStatus]}</span></span>
                  <span role="cell">{formatDate(item.submittedAtUtc)}</span>
                  <span role="cell"><a className="admin-row-link" href={`/admin/seller-applications/${item.applicationId}`}>بررسی درخواست</a></span>
                </div>)}
              </div></div>}
        {data && data.total > 0 && <div className="admin-pagination">
          <span>{data.total.toLocaleString("fa-IR")} درخواست</span>
          <div><button type="button" className="admin-secondary-button" disabled={page <= 1 || loading} onClick={() => setPage((x) => Math.max(1, x - 1))}>قبلی</button>
            <span>صفحه {page.toLocaleString("fa-IR")} از {pageCount.toLocaleString("fa-IR")}</span>
            <button type="button" className="admin-secondary-button" disabled={page >= pageCount || loading} onClick={() => setPage((x) => Math.min(pageCount, x + 1))}>بعدی</button></div>
        </div>}
      </section>
    </main>
  </AdminShell>;
}

function Field({ label, value }: { label: string; value: string | boolean | null | undefined }) {
  let display = "ثبت نشده";
  if (typeof value === "boolean") display = value ? "دارد" : "ندارد";
  else if (typeof value === "string" && value.trim()) display = value;
  return <div className="admin-detail-field"><dt>{label}</dt><dd>{display}</dd></div>;
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`admin-badge admin-badge--${status.toLowerCase()}`}>{statusLabel[status]}</span>;
}

export function AdminSellerApplicationDetail({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revisionConflict, setRevisionConflict] = useState(false);
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/seller-applications/${encodeURIComponent(applicationId)}`, {
        cache: "no-store", credentials: "same-origin",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setApplication(await response.json() as ApplicationDetail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "دریافت پرونده انجام نشد.");
    } finally { setLoading(false); }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!application || !action || submitting) return;
    const cleanReason = reason.trim();
    if ((action === "NEEDS_INFORMATION" || action === "REJECTED") && !cleanReason) {
      setNotice(action === "REJECTED" ? "برای رد درخواست، ثبت دلیل الزامی است." : "برای درخواست تکمیل اطلاعات، دلیل بررسی را وارد کنید.");
      return;
    }
    if ((action === "NEEDS_INFORMATION" || action === "REJECTED") && cleanReason.length > 500) {
      setNotice("دلیل بررسی نباید از ۵۰۰ نویسه بیشتر باشد.");
      return;
    }
    setSubmitting(true); setNotice(""); setRevisionConflict(false);
    try {
      const response = await fetch(`/api/admin/seller-applications/${encodeURIComponent(applicationId)}/review`, {
        method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: application.revision, decision: action, reason: action === "NEEDS_INFORMATION" || action === "REJECTED" ? cleanReason : null }),
      });
      if (response.status === 409) {
        setRevisionConflict(true);
        setNotice("پرونده هم‌زمان تغییر کرده است. وضعیت تازه را دریافت و دوباره بررسی کنید.");
        return;
      }
      if (!response.ok) throw new Error(await responseMessage(response));
      setNotice(action === "APPROVED" ? "نتیجه بررسی ثبت شد. این کار به‌تنهایی دسترسی فروشنده را فعال نمی‌کند." : action === "REJECTED" ? "رد درخواست ثبت شد." : "درخواست تکمیل اطلاعات ثبت شد.");
      setAction(null); setReason("");
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "ثبت نتیجه انجام نشد.");
    } finally { setSubmitting(false); }
  }

  return <AdminShell assetPrefix="detail">
    <main className="admin-content admin-content--detail">
      <div className="admin-detail-heading">
        <div className="admin-detail-heading__copy">
          <h1>جزئیات درخواست ثبت‌نام فروشنده</h1>
          <p>بررسی اطلاعات ثبت‌شدهٔ درخواست فروشندگی و وضعیت بررسی آن</p>
        </div>
        <a className="admin-back-link" href="/admin/seller-applications">بازگشت به درخواست‌ها</a>
      </div>

      {error ? <div className="admin-empty"><Notice>{error}</Notice><button className="admin-secondary-button" type="button" onClick={() => void load()}>تلاش دوباره</button></div>
        : loading && !application ? <div className="admin-empty" role="status">در حال دریافت پرونده…</div>
          : application && <>
            <div className="admin-detail-actions">
              {application.reviewStatus === "UNDER_REVIEW" ? <>
                <button type="button" className="admin-secondary-button" onClick={() => { setAction("NEEDS_INFORMATION"); setNotice(""); }}>درخواست تکمیل اطلاعات</button>
                <button type="button" className="admin-primary-button" onClick={() => { setAction("APPROVED"); setNotice(""); }}>ثبت نتیجه نهایی بررسی</button>
                <button type="button" className="admin-danger-button" onClick={() => { setAction("REJECTED"); setReason(""); setNotice(""); }}>رد درخواست</button>
              </> : <span className="admin-detail-actions__state">وضعیت فعلی: <StatusBadge status={application.reviewStatus} /></span>}
            </div>

            {notice && <Notice tone={notice.includes("ثبت شد") ? "success" : "info"}>{notice}</Notice>}
            {revisionConflict && <button type="button" className="admin-secondary-button admin-refresh-conflict" onClick={() => { setRevisionConflict(false); void load(); }}>دریافت وضعیت تازه</button>}

            {action && (action === "REJECTED" ? <div className="admin-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) { setAction(null); setReason(""); } }}>
              <form className="admin-review-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-reject-title" onSubmit={submitReview}>
                <h2 id="admin-reject-title">رد درخواست فروشندگی</h2>
                <p>با ثبت این تصمیم، وضعیت بررسی درخواست به «رد شده» تغییر می‌کند و نتیجه در سوابق بررسی ثبت می‌شود.</p>
                <label className="admin-review-form__reason">
                  <span>دلیل رد درخواست <b aria-hidden="true">*</b></span>
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required rows={3} autoFocus />
                  <small>ثبت دلیل الزامی است · {reason.length.toLocaleString("fa-IR")} از ۵۰۰ نویسه</small>
                </label>
                <div className="admin-review-form__actions">
                  <button type="button" className="admin-secondary-button" disabled={submitting} onClick={() => { setAction(null); setReason(""); }}>بازگشت</button>
                  <button type="submit" className="admin-danger-button" disabled={submitting || !reason.trim()}>{submitting ? "در حال ثبت…" : "تأیید رد درخواست"}</button>
                </div>
              </form>
            </div> : <form className="admin-review-form" onSubmit={submitReview}>
              <h2>{action === "APPROVED" ? "تأیید درخواست" : "درخواست تکمیل اطلاعات"}</h2>
              {action === "NEEDS_INFORMATION" ? <label className="admin-review-form__reason">
                <span>دلیل درخواست <b aria-hidden="true">*</b></span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required rows={3} />
                <small>{reason.length.toLocaleString("fa-IR")} از ۵۰۰ نویسه</small>
              </label> : <p>ثبت تأیید، پرونده را فعال نمی‌کند و به‌تنهایی دسترسی پنل فروشنده نمی‌دهد.</p>}
              <div className="admin-review-form__actions">
                <button type="button" className="admin-secondary-button" disabled={submitting} onClick={() => { setAction(null); setReason(""); }}>انصراف</button>
                <button type="submit" className="admin-primary-button" disabled={submitting || (action === "NEEDS_INFORMATION" && !reason.trim())}>{submitting ? "در حال ثبت…" : "ثبت نتیجه"}</button>
              </div>
            </form>)}

            <div className="admin-detail-grid">
              <section className="admin-detail-card admin-detail-card--business">
                <h2>اطلاعات کسب‌وکار، محدوده فعالیت و اطلاعات تکمیلی</h2>
                <dl className="admin-detail-list">
                  <Field label="نام تجاری کسب‌وکار" value={application.businessName ?? application.storeName} />
                  <Field label="محدوده فعالیت" value={application.city} />
                  <Field label="نشانی فعالیت" value={application.activityAddress} />
                  <Field label="محدودهٔ ارائهٔ خدمت" value={application.serviceArea} />
                  <Field label="ساعات فعالیت" value={application.activityHours} />
                  <Field label="تحویل توسط فروشنده" value={application.sellerDelivery} />
                  <Field label="تحویل حضوری" value={application.pickup} />
                  <Field label="نام مسئول ثبت‌نام" value={application.registrationContactName} />
                  <Field label="نقش مسئول ثبت‌نام" value={application.registrationContactRole} />
                  <Field label="ساعات پاسخ‌گویی" value={application.responseHours} />
                  <Field label="تلفن پشتیبان" value={application.backupPhoneMasked} />
                  <Field label="وب‌سایت یا شبکهٔ اجتماعی" value={application.websiteOrSocial} />
                  <Field label="ایمیل کسب‌وکار" value={application.businessEmail} />
                </dl>
              </section>

              <section className="admin-detail-card admin-detail-card--status">
                <h2>وضعیت فعلی درخواست</h2>
                <dl className="admin-detail-list admin-detail-list--status">
                  <Field label="وضعیت ثبت‌نام" value="ارسال‌شده" />
                  <div className="admin-detail-field"><dt>وضعیت بررسی پرونده</dt><dd><StatusBadge status={application.reviewStatus} /></dd></div>
                  <Field label="تاریخ ثبت درخواست" value={formatDate(application.submittedAtUtc)} />
                  <Field label="کد پیگیری" value={application.trackingCode} />
                  {application.reviewReason && <Field label="دلیل آخرین بررسی" value={application.reviewReason} />}
                  {application.reviewedAtUtc && <Field label="تاریخ آخرین بررسی" value={formatDate(application.reviewedAtUtc)} />}
                  <Field label="وضعیت هویتی" value={identityStatus(application.identityStatus)} />
                </dl>
              </section>

              <section className="admin-detail-card admin-detail-card--documents">
                <h2>مدارک در صورت نیاز</h2>
                {!application.documentsRequired && <p className="admin-no-documents">برای این مرحله از ثبت‌نام مدرکی لازم نیست.</p>}
              </section>

              <section className="admin-detail-card admin-detail-card--identity">
                <h2>نوع متقاضی و اطلاعات هویتی</h2>
                <dl className="admin-detail-list">
                  <Field label="نوع متقاضی ثبت‌نام" value={applicantType(application.applicantType)} />
                  <Field label="نام متقاضی" value={application.ownerName} />
                  {application.legalName && <Field label="نام حقوقی" value={application.legalName} />}
                  {application.legalRepresentativeName && <Field label="نمایندهٔ قانونی" value={application.legalRepresentativeName} />}
                  <Field label="شماره تماس تأییدشده" value={application.phoneMasked} />
                  {application.legalRepresentativePhoneMasked && <Field label="شمارهٔ نمایندهٔ قانونی" value={application.legalRepresentativePhoneMasked} />}
                  <Field label="کد ملی" value={application.nationalCodeMasked ?? application.legalNationalIdMasked} />
                  <Field label="نشانی ثبت‌شده" value={application.address} />
                  <Field label="کد پستی" value={application.postalCode} />
                  <Field label="نتیجهٔ استعلام هویت" value={identityStatus(application.identityStatus)} />
                </dl>
              </section>
            </div>
          </>}
    </main>
  </AdminShell>;
}
