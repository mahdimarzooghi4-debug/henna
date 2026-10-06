"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  adminSellerId,
  adminSellerIntent,
  adminSellerTime,
  parseAdminSellerDetail,
  parseAdminSellerList,
  parseAdminSellerMutation,
  type AdminSellerDetail,
  type AdminSellerIntent,
  type AdminSellerListItem,
} from "../../../lib/admin-sellers";
import {
  adminSellerPendingDetails,
  adminSellerSuccessMessage,
  clearAdminSellerIntent,
  persistAdminSellerIntent,
  restoreAdminSellerIntent,
} from "../../../lib/web-pending-admin-sellers";

type ListState =
  | { kind: "loading" }
  | { kind: "ready"; items: AdminSellerListItem[]; total: number }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

type DetailState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; value: AdminSellerDetail }
  | { kind: "error"; message: string };

class AdminSellerError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const reviewLabel: Record<AdminSellerListItem["reviewStatus"], string> = {
  UNDER_REVIEW: "در انتظار بررسی",
  NEEDS_INFORMATION: "نیازمند اطلاعات",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
};
const offeringLabel = {
  GOOD: "کالا",
  SERVICE: "خدمت",
  BOTH: "کالا و خدمت",
} as const;

async function json(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body &&
      typeof body.message === "string"
      ? body.message : "عملیات مدیریتی تأیید نشد.";
    throw new AdminSellerError(response.status, message);
  }
  return body;
}

export default function AdminSellersPage() {
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListState>({ kind: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>({ kind: "idle" });
  const [reason, setReason] = useState("");
  const [suspensionReason, setSuspensionReason] = useState("");
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [storageFailure, setStorageFailure] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] =
    useState<AdminSellerIntent | null>(null);
  const [uncertain, setUncertain] = useState<{
    path: string;
    decision?: "APPROVED" | "NEEDS_INFORMATION" | "REJECTED";
  } | null>(null);

  const loadList = useCallback(async (
    requestedPage: number,
    signal?: AbortSignal,
  ) => {
    setList({ kind: "loading" });
    try {
      const raw = await json(await fetch(
        "/api/admin/seller-applications?page=" + requestedPage,
        {
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          signal,
          headers: { Accept: "application/json" },
        },
      ));
      const parsed = parseAdminSellerList({
        ...(raw as Record<string, unknown>),
        page: requestedPage,
        pageSize: 20,
      }, requestedPage);
      if (!parsed) throw new AdminSellerError(503, "پاسخ فهرست قابل اعتماد نیست.");
      setList({ kind: "ready", items: parsed.items, total: parsed.total });
    } catch (error) {
      if (signal?.aborted) return;
      if (error instanceof AdminSellerError &&
          (error.status === 401 || error.status === 403)) {
        setList({ kind: "denied", message: error.message });
      } else {
        setList({
          kind: "error",
          message: error instanceof Error
            ? error.message : "دریافت پرونده‌ها ممکن نشد.",
        });
      }
    }
  }, []);

  const loadDetail = useCallback(async (
    id: string,
    signal?: AbortSignal,
  ) => {
    setDetail({ kind: "loading" });
    setReason("");
    try {
      const raw = await json(await fetch(
        "/api/admin/seller-applications/" + id,
        {
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          signal,
          headers: { Accept: "application/json" },
        },
      ));
      const parsed = parseAdminSellerDetail({
        ...(raw as Record<string, unknown>),
        applicationId: id,
      }, id);
      if (!parsed) throw new AdminSellerError(503, "جزئیات پرونده معتبر نیست.");
      setDetail({ kind: "ready", value: parsed });
    } catch (error) {
      if (!signal?.aborted)
        setDetail({
          kind: "error",
          message: error instanceof Error
            ? error.message : "دریافت جزئیات ممکن نشد.",
        });
    }
  }, []);

  const selectApplication = useCallback((id: string) => {
    if (!adminSellerId(id) || pendingIntent) return;
    setSelected(id);
    setNotice("");
    setUncertain(null);
    setSuspensionReason("");
    void loadDetail(id);
  }, [loadDetail, pendingIntent]);

  useEffect(() => {
    try {
      const restored = restoreAdminSellerIntent();
      if (!restored) return;
      const details = adminSellerPendingDetails(restored);
      if (!details) throw Error();
      setPendingIntent(restored);
      setSelected(details.applicationId);
      setUncertain({
        path: restored.path,
        decision: details.kind === "review" ? details.decision : undefined,
      });
      void loadDetail(details.applicationId);
      if (details.kind === "review") setReason(details.reason);
      if (details.kind === "suspend") setSuspensionReason(details.reason);
      setNotice(
        "یک عملیات فروشنده نتیجه قطعی ندارد. همان کلید و بدنه برای تکرار امن پس از reload بازیابی شد.");
    } catch {
      setStorageFailure(
        "وضعیت retry امن عملیات فروشنده قابل اعتماد نیست. mutation جدید برای جلوگیری از ارسال تکراری متوقف شد.");
    }
  }, [loadDetail]);

  useEffect(() => {
    const controller = new AbortController();
    void loadList(page, controller.signal);
    return () => controller.abort();
  }, [loadList, page]);

  useEffect(() => {
    if (selected || list.kind !== "ready") return;
    const requested = new URLSearchParams(window.location.search)
      .get("application");
    if (requested && adminSellerId(requested) &&
        list.items.some(item => item.id === requested)) {
      selectApplication(requested);
      return;
    }
    if (list.items.length === 1)
      selectApplication(list.items[0].id);
  }, [list, selectApplication, selected]);

  const sendIntent = useCallback(async (
    intent: AdminSellerIntent,
  ) => {
    const details = adminSellerPendingDetails(intent);
    if (!details) {
      setStorageFailure(
        "retry ذخیره‌شده عملیات فروشنده معتبر نیست. mutation جدید متوقف شد.");
      return;
    }
    setBusyPath(intent.path);
    setNotice("");
    try {
      const response = await fetch(
        "/api/admin/seller-applications/" + intent.path,
        {
          method: "POST",
          body: intent.body,
          cache: "no-store",
          credentials: "same-origin",
          redirect: "error",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": intent.key,
          },
        },
      );
      const raw = await json(response);
      const parsed = parseAdminSellerMutation({
        ...(raw as Record<string, unknown>),
        applicationId: details.applicationId,
      }, details.applicationId);
      if (!parsed)
        throw new AdminSellerError(503, "پاسخ عملیات قابل اعتماد نیست.");
      if (!clearAdminSellerIntent(intent.key)) {
        setStorageFailure(
          "پاسخ سرور دریافت شد، اما پاک‌سازی retry محلی تأیید نشد. mutation جدید متوقف است.");
        return;
      }
      setPendingIntent(null);
      setUncertain(null);
      setNotice(adminSellerSuccessMessage(details));
      await Promise.all([
        loadDetail(details.applicationId),
        loadList(page),
      ]);
    } catch (error) {
      if (error instanceof AdminSellerError && error.status === 503) {
        setPendingIntent(intent);
        setUncertain({
          path: intent.path,
          decision: details.kind === "review"
            ? details.decision : undefined,
        });
        setNotice(
          "نتیجه این عملیات هنوز قطعی نیست. همان action، کلید و بدنه پس از reload نیز برای تکرار امن حفظ شده‌اند.");
      } else {
        if (!clearAdminSellerIntent(intent.key)) {
          setStorageFailure(
            "نتیجه سرور قطعی است، اما پاک‌سازی retry محلی تأیید نشد. mutation جدید متوقف است.");
          return;
        }
        setPendingIntent(null);
        setUncertain(null);
        setNotice(error instanceof Error
          ? error.message : "ثبت عملیات ممکن نشد.");
        if (error instanceof AdminSellerError && error.status === 409)
          await Promise.all([
            loadDetail(details.applicationId),
            loadList(page),
          ]);
      }
    } finally {
      setBusyPath(null);
    }
  }, [loadDetail, loadList, page]);

  const mutate = useCallback(async (
    path: string,
    input: unknown,
    decision?: "APPROVED" | "NEEDS_INFORMATION" | "REJECTED",
  ) => {
    if (!selected || pendingIntent) return;
    const intent = adminSellerIntent(null, path, input);
    try {
      persistAdminSellerIntent(intent);
    } catch {
      setStorageFailure(
        "ذخیره retry امن عملیات فروشنده تأیید نشد؛ هیچ mutationی به سرور ارسال نشد.");
      return;
    }
    setPendingIntent(intent);
    setUncertain({ path, decision });
    await sendIntent(intent);
  }, [pendingIntent, selected, sendIntent]);

  const retryPending = useCallback(async () => {
    if (!pendingIntent) return;
    await sendIntent(pendingIntent);
  }, [pendingIntent, sendIntent]);

  const review = (
    decision: "APPROVED" | "NEEDS_INFORMATION" | "REJECTED",
  ) => {
    if (detail.kind !== "ready" || !reason.trim()) return;
    void mutate(
      detail.value.id + "/review",
      {
        revision: detail.value.revision,
        decision,
        reason: reason.trim(),
      },
      decision,
    );
  };

  const activate = () => {
    if (detail.kind !== "ready") return;
    void mutate(
      detail.value.id + "/activate",
      { revision: detail.value.revision },
    );
  };

  const suspend = () => {
    if (detail.kind !== "ready" || !suspensionReason.trim()) return;
    void mutate(
      detail.value.id + "/suspend",
      {
        revision: detail.value.revision,
        reason: suspensionReason.trim(),
      },
    );
  };

  const restore = () => {
    if (detail.kind !== "ready") return;
    void mutate(
      detail.value.id + "/restore",
      { revision: detail.value.revision },
    );
  };

  if (storageFailure) {
    return (
      <main className="admin-sellers admin-sellers--gate">
        <img src="/hana-logo.png" alt="حنا" className="admin-sellers__logo" />
        <section className="admin-sellers__panel">
          <h1>مدیریت درخواست‌های فروشندگی</h1>
          <p role="alert">{storageFailure}</p>
        </section>
      </main>
    );
  }

  if (list.kind === "denied") {
    return (
      <main className="admin-sellers admin-sellers--gate">
        <img src="/hana-logo.png" alt="حنا" className="admin-sellers__logo" />
        <section className="admin-sellers__panel">
          <h1>مدیریت درخواست‌های فروشندگی</h1>
          <p role="alert">{list.message}</p>
          <Link href="/" className="auth-card__secondary">بازگشت به حنا</Link>
        </section>
      </main>
    );
  }

  const selectedDetail = detail.kind === "ready" ? detail.value : null;
  const reviewFrozen = uncertain?.path.endsWith("/review") ?? false;
  const activateFrozen = uncertain?.path.endsWith("/activate") ?? false;
  const suspendFrozen = uncertain?.path.endsWith("/suspend") ?? false;
  const restoreFrozen = uncertain?.path.endsWith("/restore") ?? false;

  return (
    <main className="admin-sellers">
      <header className="admin-sellers__header">
        <div>
          <img src="/hana-logo.png" alt="حنا" className="admin-sellers__logo" />
          <p className="seller-panel__eyebrow">عملیات مدیریتی</p>
          <h1>بررسی و فعال‌سازی فروشندگان</h1>
          <p>
            تأیید پرونده و فعال‌سازی دو عملیات مستقل‌اند. APPROVED به‌تنهایی
            نقش SELLER را فعال نمی‌کند.
          </p>
        </div>
        <nav className="admin-sellers__links">
          <Link href="/admin/allocation-proposals">پیشنهادهای تخصیص</Link>
          <Link href="/">حنا</Link>
        </nav>
      </header>

      {notice && <p className="form-status admin-sellers__notice" role="status">
        {notice}
      </p>}
      {pendingIntent && (
        <button type="button" className="primary-button"
          disabled={busyPath !== null}
          onClick={() => void retryPending()}>
          {busyPath !== null
            ? "در حال تکرار امن…"
            : "تکرار امن عملیات فروشنده قبلی"}
        </button>
      )}

      <div className="admin-sellers__grid">
        <section className="admin-sellers__panel">
          <div className="seller-commerce__section-title">
            <div>
              <h2>پرونده‌های ثبت‌شده</h2>
              <p>
                {list.kind === "ready"
                  ? "کل پرونده‌ها: " + new Intl.NumberFormat("fa-IR").format(list.total)
                  : "در حال دریافت…"}
              </p>
            </div>
            <span>صفحه {new Intl.NumberFormat("fa-IR").format(page)}</span>
          </div>

          {list.kind === "loading" &&
            <p className="form-status">در حال دریافت پرونده‌ها…</p>}
          {list.kind === "error" &&
            <p className="form-status form-status--error">{list.message}</p>}
          {list.kind === "ready" && list.items.length === 0 &&
            <p className="seller-commerce__empty">
              پرونده SUBMITTED در این صفحه وجود ندارد.
            </p>}
          {list.kind === "ready" && (
            <div className="admin-sellers__list">
              {list.items.map(item => (
                <button type="button" key={item.id}
                  data-application-id={item.id}
                  className={selected === item.id
                    ? "admin-sellers__item admin-sellers__item--selected"
                    : "admin-sellers__item"}
                  disabled={busyPath !== null || pendingIntent !== null}
                  onClick={() => selectApplication(item.id)}>
                  <strong>{item.businessName ?? item.storeName}</strong>
                  <span>{reviewLabel[item.reviewStatus]}</span>
                  <small>{adminSellerTime(item.submittedAtUtc)}</small>
                </button>
              ))}
            </div>
          )}
          <div className="seller-commerce__pager">
            <button type="button" disabled={page === 1 || busyPath !== null || pendingIntent !== null}
              onClick={() => {
                setSelected(null);
                setPage(value => Math.max(1, value - 1));
              }}>
              صفحه قبل
            </button>
            <button type="button"
              disabled={list.kind !== "ready" ||
                list.items.length < 20 || busyPath !== null || pendingIntent !== null}
              onClick={() => {
                setSelected(null);
                setPage(value => value + 1);
              }}>
              صفحه بعد
            </button>
          </div>
        </section>

        <section className="admin-sellers__panel admin-sellers__detail">
          {detail.kind === "idle" &&
            <p className="seller-commerce__empty">
              یک پرونده را برای بررسی انتخاب کنید.
            </p>}
          {detail.kind === "loading" &&
            <p className="form-status">در حال دریافت جزئیات…</p>}
          {detail.kind === "error" &&
            <p className="form-status form-status--error">{detail.message}</p>}

          {selectedDetail && (
            <>
              <div className="admin-sellers__detail-head">
                <div>
                  <p className="seller-panel__eyebrow">
                    {reviewLabel[selectedDetail.reviewStatus]}
                  </p>
                  <h2>{selectedDetail.businessName ?? selectedDetail.storeName}</h2>
                  <p>
                    کد پیگیری <bdi dir="ltr">{selectedDetail.trackingCode}</bdi>
                  </p>
                </div>
                <span className="seller-commerce__state">
                  نسخه {new Intl.NumberFormat("fa-IR").format(selectedDetail.revision)}
                </span>
              </div>

              <dl className="admin-sellers__facts">
                <div><dt>مالک/نماینده</dt><dd>{selectedDetail.ownerName}</dd></div>
                <div><dt>نوع متقاضی</dt><dd>
                  {selectedDetail.applicantType === "LEGAL" ? "حقوقی" : "حقیقی"}
                </dd></div>
                <div><dt>احراز هویت</dt><dd>{selectedDetail.identityStatus}</dd></div>
                <div><dt>نوع ارائه</dt><dd>{offeringLabel[selectedDetail.offeringType]}</dd></div>
                <div><dt>شماره حساب ثبت‌نام</dt><dd>{selectedDetail.phoneMasked}</dd></div>
                <div><dt>شماره کسب‌وکار</dt><dd>{selectedDetail.businessPhone}</dd></div>
                <div><dt>شهر</dt><dd>{selectedDetail.city}</dd></div>
                <div><dt>کدپستی</dt><dd>{selectedDetail.postalCode}</dd></div>
                <div><dt>دریافت حضوری</dt><dd>{selectedDetail.pickup ? "بله" : "خیر"}</dd></div>
                <div><dt>ارسال فروشنده</dt><dd>{selectedDetail.sellerDelivery ? "ثبت شده" : "خیر"}</dd></div>
              </dl>

              <section className="admin-sellers__text">
                <h3>شرح کسب‌وکار</h3>
                <p>{selectedDetail.businessDescription}</p>
                <h3>نشانی فعالیت</h3>
                <p>{selectedDetail.activityAddress}</p>
                <h3>مختصات ثبت‌شده</h3>
                <p>
                  {selectedDetail.activityLatitude !== null &&
                  selectedDetail.activityLongitude !== null
                    ? `${selectedDetail.activityLatitude.toFixed(6)}، ${selectedDetail.activityLongitude.toFixed(6)}`
                    : "ثبت نشده"}
                </p>
                <h3>ساعات فعالیت و پاسخ‌گویی</h3>
                <p>{selectedDetail.activityHours} · {selectedDetail.responseHours}</p>
                <h3>محدوده خدمت</h3>
                <p>{selectedDetail.serviceArea}</p>
              </section>

              {selectedDetail.reviewReason && (
                <div className="support-incident__result">
                  <strong>دلیل بررسی ثبت‌شده</strong>
                  <p>{selectedDetail.reviewReason}</p>
                </div>
              )}

              {selectedDetail.reviewStatus === "UNDER_REVIEW" && (
                <section className="admin-sellers__actions">
                  <label className="field">
                    <span className="field__label">دلیل مستند تصمیم</span>
                    <textarea className="field__input support-incident__reason"
                      value={reason}
                      maxLength={500}
                      disabled={reviewFrozen || busyPath !== null || pendingIntent !== null}
                      onChange={event => setReason(event.target.value)}
                      placeholder="نتیجه بررسی هویت و اطلاعات کسب‌وکار را ثبت کنید." />
                  </label>
                  <div className="admin-sellers__decision-grid">
                    {([
                      ["APPROVED", "تأیید پرونده"],
                      ["NEEDS_INFORMATION", "نیاز به اطلاعات"],
                      ["REJECTED", "رد پرونده"],
                    ] as const).map(([decision, label]) => (
                      <button type="button" key={decision}
                        className={decision === "REJECTED"
                          ? "support-incident__reject"
                          : "primary-button"}
                        disabled={!reason.trim() || busyPath !== null || pendingIntent !== null ||
                          (reviewFrozen &&
                            uncertain?.decision !== decision)}
                        onClick={() => review(decision)}>
                        {busyPath?.endsWith("/review")
                          ? "در حال ثبت…"
                          : reviewFrozen && uncertain?.decision === decision
                            ? "تکرار امن همان تصمیم"
                            : label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {selectedDetail.reviewStatus === "APPROVED" &&
                selectedDetail.activatedAtUtc === null && (
                <section className="admin-sellers__activation">
                  <strong>مرحله مستقل فعال‌سازی</strong>
                  <p>
                    این اقدام نقش SELLER را در همان تراکنش فعال‌سازی ثبت می‌کند.
                  </p>
                  <button type="button" className="primary-button"
                    disabled={busyPath !== null || pendingIntent !== null}
                    onClick={activate}>
                    {busyPath?.endsWith("/activate")
                      ? "در حال فعال‌سازی…"
                      : activateFrozen
                        ? "تکرار امن همان فعال‌سازی"
                        : "فعال‌سازی فروشنده"}
                  </button>
                </section>
              )}

              {selectedDetail.activatedAtUtc && !selectedDetail.sellerSuspended && (
                <>
                  <div className="support-incident__result">
                    <strong>فروشنده فعال است</strong>
                    <p>{adminSellerTime(selectedDetail.activatedAtUtc)}</p>
                  </div>
                  <section className="admin-sellers__activation">
                    <strong>تعلیق دسترسی فروشنده</strong>
                    <p>
                      تعلیق، نقش SELLER و دسترسی عملیاتی را قطع می‌کند؛
                      سفارش‌ها، گزارش‌ها و سابقه مالی حذف نمی‌شوند.
                    </p>
                    <label className="field">
                      <span className="field__label">دلیل مستند تعلیق</span>
                      <textarea className="field__input support-incident__reason"
                        maxLength={500}
                        value={suspensionReason}
                        disabled={suspendFrozen || busyPath !== null || pendingIntent !== null}
                        onChange={event =>
                          setSuspensionReason(event.target.value)}
                        placeholder="دلیل عملیاتی یا انطباقی تعلیق را ثبت کنید." />
                    </label>
                    <button type="button"
                      className="support-incident__reject"
                      disabled={!suspensionReason.trim() || busyPath !== null || pendingIntent !== null}
                      onClick={suspend}>
                      {busyPath?.endsWith("/suspend")
                        ? "در حال تعلیق…"
                        : suspendFrozen
                          ? "تکرار امن همان تعلیق"
                          : "تعلیق فروشنده"}
                    </button>
                  </section>
                </>
              )}

              {selectedDetail.sellerSuspended && (
                <section className="admin-sellers__activation">
                  <div className="support-incident__result">
                    <strong>دسترسی فروشنده معلق است</strong>
                    <p>
                      {selectedDetail.suspensionReason}
                      {" · "}
                      {adminSellerTime(selectedDetail.suspendedAtUtc)}
                    </p>
                  </div>
                  <p>
                    بازگردانی، فقط نقش و دسترسی فروشنده را فعال می‌کند و
                    سابقه تعلیق را نگه می‌دارد.
                  </p>
                  <button type="button" className="primary-button"
                    disabled={busyPath !== null || pendingIntent !== null}
                    onClick={restore}>
                    {busyPath?.endsWith("/restore")
                      ? "در حال بازگردانی…"
                      : restoreFrozen
                        ? "تکرار امن همان بازگردانی"
                        : "بازگردانی دسترسی فروشنده"}
                  </button>
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
