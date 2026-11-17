"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";

type FundingState = "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
type FundingDecision = "VERIFIED" | "REJECTED";
type FundingMode = "HENNA_NEEDS_BASED" | "ORGANIZATION_DEFINED";
type FundingListItem = {
  instructionId: string;
  organizationName: string;
  programName: string;
  allocationMode: FundingMode;
  sourceInstructionReference: string;
  state: FundingState;
  revision: number;
  submittedAtUtc: string;
  reviewReason: string | null;
  reviewedAtUtc: string | null;
};
type FundingPage = { items: FundingListItem[]; page: number; pageSize: number; total: number };
type FundingEvent = {
  eventId: string;
  instructionId: string;
  revision: number;
  decision: "VERIFIED" | "REJECTED" | "RESUBMITTED";
  reference: string;
  reason: string | null;
  occurredAtUtc: string;
};
type FundingDetail = FundingListItem & {
  programId: string;
  programRevision: number;
  events: FundingEvent[];
};
type StateFilter = "ALL" | FundingState;

const states: { value: StateFilter; label: string }[] = [
  { value: "PENDING_VERIFICATION", label: "در انتظار بررسی" },
  { value: "ALL", label: "همه دستورها" },
  { value: "VERIFIED", label: "تأیید مرجع" },
  { value: "REJECTED", label: "نیازمند اصلاح" },
];
const stateLabels: Record<FundingState, string> = {
  PENDING_VERIFICATION: "در انتظار بررسی",
  VERIFIED: "مرجع تأیید شده",
  REJECTED: "نیازمند اصلاح",
};
const eventLabels: Record<FundingEvent["decision"], string> = {
  VERIFIED: "تأیید مرجع ثبت‌شده",
  REJECTED: "درخواست اصلاح مرجع",
  RESUBMITTED: "ارسال مجدد مرجع",
};
const nav = [
  { group: "نمای کلی", items: [{ label: "داشبورد", icon: "imgFrame" }] },
  { group: "بازارگاه", items: [
    { label: "کاربران و حساب‌ها", icon: "imgUsersIcon" },
    { label: "سازمان‌ها", icon: "imgUsersIcon", active: true },
    { label: "فروشندگان و ارائه‌دهندگان", icon: "imgStoreIcon" },
    { label: "درخواست‌های ثبت‌نام فروشنده", icon: "imgClipboardIcon" },
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
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran",
  }).format(date);
}

function stateLabel(state: FundingState) { return stateLabels[state]; }
function modeLabel(mode: FundingMode) {
  return mode === "HENNA_NEEDS_BASED" ? "محاسبه بر اساس الگوی حنا" : "تخصیص توسط سازمان";
}
async function responseMessage(response: Response) {
  try {
    const value: unknown = await response.json();
    if (value && typeof value === "object" && "message" in value && typeof value.message === "string")
      return value.message;
  } catch { /* Keep the safe local fallback. */ }
  return response.status === 401 ? "برای ادامه دوباره وارد شوید."
    : response.status === 403 ? "دسترسی مدیریت برای این حساب فعال نیست."
      : "دریافت اطلاعات انجام نشد؛ دوباره تلاش کنید.";
}

function AdminShell({ children, assetPrefix }: { children: ReactNode; assetPrefix: "list" | "detail" }) {
  return <div className="admin-shell" dir="ltr">
    <div className="admin-main" dir="rtl">
      <header className="admin-topbar"><div className="admin-topbar__account">
        <span className="admin-topbar__role">پنل مدیریت</span>
        <span className="admin-topbar__divider" aria-hidden="true" />
        <span className="admin-topbar__notification" aria-label="اعلان‌ها">
          <img src={`/admin-assets/${assetPrefix}-imgNotifBtn.svg`} alt="" width="36" height="36" />
        </span>
      </div></header>
      {children}
    </div>
    <aside className="admin-sidebar" dir="rtl" aria-label="منوی مدیریت">
      <div className="admin-sidebar__brand">
        <img src={`/admin-assets/${assetPrefix}-imgLogo.png`} alt="نشان حنا" width="48" height="48" />
        <div><strong>مدیریت حنا</strong><span>پنل مدیریت بازارگاه</span></div>
      </div>
      <nav className="admin-sidebar__nav">
        {nav.map(group => <section className="admin-sidebar__group" key={group.group}>
          <h2>{group.group}</h2>
          {group.items.map(item => <div
            className={`admin-sidebar__item${"active" in item && item.active ? " admin-sidebar__item--active" : ""}`}
            key={item.label}
            aria-current={"active" in item && item.active ? "page" : undefined}
            title={item.label}
          ><span>{item.label}</span><img src={`/admin-assets/${assetPrefix}-${item.icon}.svg`} alt="" width="20" height="20" /></div>)}
        </section>)}
      </nav>
    </aside>
  </div>;
}

function Notice({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  return <p className={`admin-notice admin-notice--${tone}`} role="status">{children}</p>;
}
function StateBadge({ state }: { state: FundingState }) {
  const className = state === "PENDING_VERIFICATION" ? "under_review"
    : state === "VERIFIED" ? "approved" : "rejected";
  return <span className={`admin-badge admin-badge--${className}`}>{stateLabel(state)}</span>;
}

export function AdminFundingInstructionsList() {
  const [filter, setFilter] = useState<StateFilter>("PENDING_VERIFICATION");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FundingPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError("");
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), state: filter });
    fetch(`/api/admin/organization-funding-instructions?${query}`, {
      cache: "no-store", credentials: "same-origin", signal: abort.signal,
    }).then(async response => {
      if (!response.ok) throw new Error(await responseMessage(response));
      return response.json() as Promise<FundingPage>;
    }).then(setData).catch((cause: unknown) => {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "دریافت فهرست انجام نشد.");
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [filter, page, refresh]);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <AdminShell assetPrefix="list"><main className="admin-content">
    <div className="admin-page-heading">
      <h1>بررسی دستور منبع سازمان</h1>
      <p>صف مرجع‌های ثبت‌شده برای بررسی دستی؛ ثبت نتیجه، دریافت یا تخصیص وجه را تأیید نمی‌کند.</p>
    </div>
    <div className="admin-filters" role="group" aria-label="فیلتر وضعیت بررسی">
      {states.map(item => <button key={item.value} type="button"
        className={`admin-filter${filter === item.value ? " admin-filter--active" : ""}`}
        aria-pressed={filter === item.value}
        onClick={() => { setFilter(item.value); setPage(1); }}>{item.label}</button>)}
    </div>
    <section className="admin-table-card" aria-label="فهرست دستورهای منبع">
      {error ? <div className="admin-empty"><Notice>{error}</Notice><button className="admin-secondary-button" type="button" onClick={() => setRefresh(value => value + 1)}>تلاش دوباره</button></div>
        : loading ? <div className="admin-empty" role="status">در حال دریافت فهرست…</div>
          : data?.items.length === 0 ? <div className="admin-empty">دستوری در این وضعیت ثبت نشده است.</div>
            : <div className="admin-table-scroll"><div className="admin-table admin-funding-table" role="table" aria-label="فهرست دستورهای منبع">
              <div className="admin-table__row admin-table__head" role="row">
                <span role="columnheader">سازمان</span><span role="columnheader">طرح</span>
                <span role="columnheader">مرجع ثبت‌شده</span><span role="columnheader">مدل تخصیص</span>
                <span role="columnheader">وضعیت</span><span role="columnheader">تاریخ ثبت</span>
                <span role="columnheader">عملیات</span>
              </div>
              {data?.items.map(item => <div className="admin-table__row" role="row" key={item.instructionId}>
                <span className="admin-applicant" role="cell">{item.organizationName}</span>
                <span role="cell">{item.programName}</span>
                <span role="cell" dir="auto">{item.sourceInstructionReference}</span>
                <span role="cell">{modeLabel(item.allocationMode)}</span>
                <span role="cell"><StateBadge state={item.state} /></span>
                <span role="cell">{formatDate(item.submittedAtUtc)}</span>
                <span role="cell"><a className="admin-row-link" href={`/admin/organization-funding-instructions/${item.instructionId}`}>بررسی مرجع</a></span>
              </div>)}
            </div></div>}
      {data && data.total > 0 && <div className="admin-pagination">
        <span>{data.total.toLocaleString("fa-IR")} دستور</span>
        <div><button type="button" className="admin-secondary-button" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}>قبلی</button>
          <span>صفحه {page.toLocaleString("fa-IR")} از {pageCount.toLocaleString("fa-IR")}</span>
          <button type="button" className="admin-secondary-button" disabled={page >= pageCount || loading} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>بعدی</button></div>
      </div>}
    </section>
  </main></AdminShell>;
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="admin-detail-field"><dt>{label}</dt><dd>{value ?? "ثبت نشده"}</dd></div>;
}

export function AdminFundingInstructionDetail({ instructionId }: { instructionId: string }) {
  const [instruction, setInstruction] = useState<FundingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<FundingDecision | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/organization-funding-instructions/${encodeURIComponent(instructionId)}`, {
        cache: "no-store", credentials: "same-origin",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setInstruction(await response.json() as FundingDetail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "دریافت دستور انجام نشد.");
    } finally { setLoading(false); }
  }, [instructionId]);
  useEffect(() => { void load(); }, [load]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!instruction || !action || submitting) return;
    const cleanReason = reason.trim();
    if (action === "REJECTED" && !cleanReason) {
      setNotice("برای درخواست اصلاح، ثبت دلیل الزامی است."); return;
    }
    if (cleanReason.length > 1000) { setNotice("دلیل بررسی نباید از ۱۰۰۰ نویسه بیشتر باشد."); return; }
    setSubmitting(true); setNotice(""); setConflict(false);
    try {
      const response = await fetch(`/api/admin/organization-funding-instructions/${encodeURIComponent(instructionId)}/review`, {
        method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: instruction.revision, decision: action, reason: cleanReason || null }),
      });
      if (response.status === 409) {
        setConflict(true); setNotice("دستور هم‌زمان تغییر کرده است. وضعیت تازه را دریافت و دوباره بررسی کنید."); return;
      }
      if (!response.ok) throw new Error(await responseMessage(response));
      setAction(null); setReason("");
      setNotice(action === "VERIFIED"
        ? "بررسی مرجع ثبت شد. این نتیجه به معنی دریافت وجه یا فعال‌شدن تخصیص نیست."
        : "درخواست اصلاح ثبت شد و در سابقهٔ بررسی باقی می‌ماند.");
      await load();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "ثبت بررسی انجام نشد.");
    } finally { setSubmitting(false); }
  }

  return <AdminShell assetPrefix="detail"><main className="admin-content admin-content--detail">
    <div className="admin-detail-heading">
      <div className="admin-detail-heading__copy">
        <h1>بررسی دستور منبع سازمان</h1>
        <p>بازبینی دستی مرجع ثبت‌شده؛ این تصمیم تأیید دریافت وجه نیست.</p>
      </div>
      <a className="admin-back-link" href="/admin/organization-funding-instructions">بازگشت به صف بررسی</a>
    </div>
    <div className="admin-funding-warning" role="note">
      بررسی فقط دربارهٔ مرجع ثبت‌شده است. این صفحه موجودی، دریافت وجه، مالکیت منبع یا تخصیص اعتبار را تأیید نمی‌کند.
    </div>
    {error ? <div className="admin-empty"><Notice>{error}</Notice><button className="admin-secondary-button" type="button" onClick={() => void load()}>تلاش دوباره</button></div>
      : loading && !instruction ? <div className="admin-empty" role="status">در حال دریافت دستور…</div>
        : instruction && <>
          <section className="admin-detail-card admin-funding-detail-card">
            <h2>مشخصات دستور ثبت‌شده</h2>
            <dl className="admin-detail-list admin-funding-fields">
              <Field label="سازمان" value={instruction.organizationName} />
              <Field label="طرح" value={instruction.programName} />
              <Field label="مدل تخصیص ثبت‌شده" value={modeLabel(instruction.allocationMode)} />
              <Field label="مرجع ثبت‌شده" value={instruction.sourceInstructionReference} />
              <Field label="نسخه دستور" value={instruction.revision.toLocaleString("fa-IR")} />
              <Field label="تاریخ ثبت" value={formatDate(instruction.submittedAtUtc)} />
              <div className="admin-detail-field"><dt>وضعیت بررسی</dt><dd><StateBadge state={instruction.state} /></dd></div>
              {instruction.reviewReason && <Field label="دلیل آخرین بررسی" value={instruction.reviewReason} />}
              {instruction.reviewedAtUtc && <Field label="زمان آخرین بررسی" value={formatDate(instruction.reviewedAtUtc)} />}
            </dl>
          </section>

          {notice && <Notice tone={notice.includes("ثبت شد") || notice.includes("ثبت شد و") ? "success" : "info"}>{notice}</Notice>}
          {conflict && <button type="button" className="admin-secondary-button admin-refresh-conflict" onClick={() => { setConflict(false); void load(); }}>دریافت وضعیت تازه</button>}

          {instruction.state === "PENDING_VERIFICATION" ? <section className="admin-review-form">
            <h2>نتیجه بررسی مرجع</h2>
            <p>تأیید مرجع به معنی تأیید موجودی یا انجام پرداخت نیست.</p>
            <div className="admin-detail-actions">
              <button type="button" className="admin-primary-button" onClick={() => { setAction("VERIFIED"); setNotice(""); }}>تأیید مرجع ثبت‌شده</button>
              <button type="button" className="admin-danger-button" onClick={() => { setAction("REJECTED"); setReason(""); setNotice(""); }}>رد و درخواست اصلاح</button>
            </div>
          </section> : <div className="admin-detail-actions__state">وضعیت فعلی: <StateBadge state={instruction.state} /></div>}

          {action && <div className="admin-dialog-backdrop" onMouseDown={event => {
            if (event.target === event.currentTarget && !submitting) { setAction(null); setReason(""); }
          }}>
            <form className="admin-review-dialog" role="dialog" aria-modal="true" aria-labelledby="funding-review-title" onSubmit={submitReview}>
              <h2 id="funding-review-title">{action === "VERIFIED" ? "تأیید مرجع ثبت‌شده" : "رد مرجع و درخواست اصلاح"}</h2>
              <p>{action === "VERIFIED"
                ? "این تصمیم فقط نتیجهٔ بررسی مرجع است و دریافت یا تخصیص وجه را ثبت نمی‌کند."
                : "برای درخواست اصلاح، دلیل را بنویسید. سابقهٔ تصمیم در پرونده باقی می‌ماند."}</p>
              <label className="admin-review-form__reason">
                <span>دلیل بررسی {action === "REJECTED" && <b aria-hidden="true">*</b>}</span>
                <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000}
                  required={action === "REJECTED"} rows={3} autoFocus={action === "REJECTED"} />
                <small>{action === "REJECTED" ? "ثبت دلیل الزامی است · " : "اختیاری · "}{reason.length.toLocaleString("fa-IR")} از ۱۰۰۰ نویسه</small>
              </label>
              <div className="admin-review-form__actions">
                <button type="button" className="admin-secondary-button" disabled={submitting} onClick={() => { setAction(null); setReason(""); }}>بازگشت</button>
                <button type="submit" className={action === "VERIFIED" ? "admin-primary-button" : "admin-danger-button"}
                  disabled={submitting || (action === "REJECTED" && !reason.trim())}>{submitting ? "در حال ثبت…" : "ثبت تصمیم"}</button>
              </div>
            </form>
          </div>}

          <section className="admin-detail-card admin-funding-history" aria-label="سوابق بررسی">
            <h2>سوابق بررسی</h2>
            {instruction.events.length === 0 ? <p className="admin-no-documents">هنوز رویدادی برای این دستور ثبت نشده است.</p>
              : <ol className="admin-funding-history__list">{instruction.events.map(event => <li key={event.eventId}>
                <div><strong>{eventLabels[event.decision]}</strong><time dateTime={event.occurredAtUtc}>{formatDate(event.occurredAtUtc)}</time></div>
                <p>نسخه {event.revision.toLocaleString("fa-IR")} · مرجع: <b dir="auto">{event.reference}</b></p>
                {event.reason && <p>دلیل: {event.reason}</p>}
              </li>)}</ol>}
          </section>
        </>}
  </main></AdminShell>;
}
