"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  StaffCommerceError,
  staffGet,
  staffIntent,
  staffPost,
  staffRial,
  staffTime,
  supportEvidenceUrl,
  type StaffIncident,
  type StaffIntent,
} from "../../lib/staff-commerce";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; items: StaffIncident[] }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };

type DecisionResult = {
  state: StaffIncident["state"];
  refundRial: number;
  reason: string;
};

const stateLabel: Record<StaffIncident["state"], string> = {
  UNDER_REVIEW: "در انتظار تصمیم",
  REJECTED: "ردشده",
  AWAITING_RETURN: "تأیید و در انتظار مرجوعی",
  RESOLVED: "حل‌شده",
  COLLECTED: "مرجوعی تحویل شده",
  CUSTOMER_UNAVAILABLE_VERIFIED: "عدم حضور خریدار تأیید شده",
};

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "پاسخ سرور تأیید نشد.";
}

export function SupportCommerceView() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<Record<string, boolean>>({});
  const [uncertainDecision, setUncertainDecision] =
    useState<Record<string, "APPROVE" | "REJECT" | undefined>>({});
  const [results, setResults] = useState<Record<string, DecisionResult>>({});
  const intents = useRef<Record<string, StaffIntent | null>>({});

  const load = useCallback(async (
    requestedPage: number,
    signal?: AbortSignal,
  ) => {
    setState({ kind: "loading" });
    try {
      const items = await staffGet<StaffIncident[]>(
        "support", "incidents?page=" + requestedPage, signal);
      setState({ kind: "ready", items });
    } catch (error) {
      if (signal?.aborted) return;
      if (error instanceof StaffCommerceError &&
          (error.status === 401 || error.status === 403)) {
        setState({ kind: "denied", message: error.message });
      } else {
        setState({ kind: "error", message: message(error) });
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(page, controller.signal);
    return () => controller.abort();
  }, [load, page]);

  const decide = useCallback(async (
    incident: StaffIncident,
    decision: "APPROVE" | "REJECT",
  ) => {
    const path = `incidents/${incident.id}/decision`;
    const reason = reasons[incident.id]?.trim() ?? "";
    if (!reason) {
      setNotice("ثبت دلیل برای تصمیم پشتیبانی الزامی است.");
      return;
    }
    const intent = staffIntent(intents.current[path] ?? null, path, {
      decision,
      reason,
    });
    intents.current[path] = intent;
    setBusyPath(path);
    setNotice(null);
    try {
      const response = await staffPost<{
        incident: StaffIncident;
        reason: string;
      }>("support", intent);
      intents.current[path] = null;
      setUncertain(current => ({ ...current, [path]: false }));
      setUncertainDecision(current => ({ ...current, [incident.id]: undefined }));
      setResults(current => ({
        ...current,
        [incident.id]: {
          state: response.incident.state,
          refundRial: response.incident.refundRial,
          reason: response.reason,
        },
      }));
      setNotice(decision === "APPROVE"
        ? "تصمیم تأیید شد و نتیجه واقعی سرور ثبت شد."
        : "تصمیم رد شد و نتیجه واقعی سرور ثبت شد.");
      await load(page);
    } catch (error) {
      if (error instanceof StaffCommerceError && error.status === 503) {
        setUncertain(current => ({ ...current, [path]: true }));
        setUncertainDecision(current => ({
          ...current,
          [incident.id]: decision,
        }));
        setNotice(
          "نتیجه تصمیم هنوز قطعی نیست. برای retry امن همان تصمیم را با همان دلیل دوباره بزنید؛ کلید و بدنه حفظ شده‌اند.");
      } else {
        intents.current[path] = null;
        setUncertain(current => ({ ...current, [path]: false }));
        setUncertainDecision(current => ({ ...current, [incident.id]: undefined }));
        setNotice(message(error));
        if (error instanceof StaffCommerceError && error.status === 409)
          await load(page);
      }
    } finally {
      setBusyPath(null);
    }
  }, [load, page, reasons]);

  if (state.kind === "denied") {
    return (
      <main className="support-panel support-panel--gate">
        <img className="support-panel__logo" src="/hana-logo.png" alt="حنا" />
        <section className="support-panel__denied">
          <h1>پنل پشتیبانی</h1>
          <p role="alert">{state.message}</p>
          <a className="auth-card__secondary" href="/">بازگشت به حنا</a>
        </section>
      </main>
    );
  }

  return (
    <main className="support-panel">
      <header className="support-panel__header">
        <div>
          <img className="support-panel__logo" src="/hana-logo.png" alt="حنا" />
          <p className="seller-panel__eyebrow">پشتیبانی عملیاتی حنا</p>
          <h1>بررسی گزارش آسیب و کسری</h1>
          <p>
            گزارش‌ها و تصاویر خصوصی فقط با مجوز SUPPORT خوانده می‌شوند.
            تصمیم نهایی و بازپرداخت توسط backend تراکنشی حنا اعمال می‌شود.
          </p>
        </div>
        <button type="button" className="seller-commerce__refresh"
          disabled={busyPath !== null}
          onClick={() => void load(page)}>
          تازه‌سازی
        </button>
      </header>

      {notice && <p className="form-status support-panel__notice" role="status">
        {notice}
      </p>}

      <section className="support-panel__content">
        <div className="seller-commerce__section-title">
          <h2>گزارش‌های قابل بررسی</h2>
          <span>صفحه {new Intl.NumberFormat("fa-IR").format(page)}</span>
        </div>

        {state.kind === "loading" &&
          <p className="form-status" role="status">در حال دریافت گزارش‌ها…</p>}
        {state.kind === "error" &&
          <p className="form-status form-status--error" role="alert">
            {state.message}
          </p>}
        {state.kind === "ready" && state.items.length === 0 &&
          <p className="seller-commerce__empty">گزارشی در این صفحه نیست.</p>}

        {state.kind === "ready" && state.items.map(incident => {
          const path = `incidents/${incident.id}/decision`;
          const frozen = Boolean(uncertain[path]);
          const frozenDecision = uncertainDecision[incident.id];
          const result = results[incident.id];
          return (
            <article className="support-incident" key={incident.id}>
              <div className="support-incident__summary">
                <div>
                  <p className="seller-panel__eyebrow">
                    {incident.type === "DAMAGED_ITEM"
                      ? "گزارش آسیب‌دیدگی"
                      : "گزارش کسری"}
                  </p>
                  <h3>
                    سفارش <bdi dir="ltr">{incident.orderId.slice(0, 8)}</bdi>
                  </h3>
                  <p>ثبت‌شده در {staffTime(incident.reportedAtUtc)}</p>
                </div>
                <span className="seller-commerce__state">
                  {stateLabel[incident.state]}
                </span>
              </div>

              <div className="support-incident__body">
                <figure className="support-incident__evidence">
                  <img
                    src={supportEvidenceUrl(incident.evidenceId)}
                    alt="تصویر خصوصی پیوست گزارش خریدار"
                  />
                  <figcaption>
                    تصویر خصوصی فقط از مسیر احراز هویت‌شده پشتیبانی بارگذاری می‌شود.
                  </figcaption>
                </figure>

                <div className="support-incident__review">
                  <dl className="seller-commerce__facts">
                    <div><dt>تعداد گزارش‌شده</dt><dd>{incident.quantity}</dd></div>
                    <div><dt>بازپرداخت ثبت‌شده</dt><dd>{staffRial(incident.refundRial)}</dd></div>
                    <div><dt>مهلت مرجوعی</dt><dd>{staffTime(incident.returnDueAtUtc)}</dd></div>
                  </dl>

                  {result && (
                    <div className="support-incident__result" role="status">
                      <strong>آخرین پاسخ واقعی سرور</strong>
                      <p>وضعیت: {stateLabel[result.state]}</p>
                      <p>مبلغ بازپرداخت: {staffRial(result.refundRial)}</p>
                      <p>دلیل ثبت‌شده: {result.reason}</p>
                    </div>
                  )}

                  {incident.state === "UNDER_REVIEW" && (
                    <>
                      <label className="field">
                        <span className="field__label">دلیل تصمیم</span>
                        <textarea className="field__input support-incident__reason"
                          maxLength={1000}
                          value={reasons[incident.id] ?? ""}
                          disabled={frozen || busyPath !== null}
                          onChange={event => setReasons(current => ({
                            ...current,
                            [incident.id]: event.target.value,
                          }))}
                          placeholder="دلیل مستند تأیید یا رد را وارد کنید." />
                      </label>
                      <div className="support-incident__actions">
                        <button type="button" className="primary-button"
                          disabled={!reasons[incident.id]?.trim() ||
                            busyPath !== null ||
                            (frozen && frozenDecision !== "APPROVE")}
                          onClick={() => void decide(incident, "APPROVE")}>
                          {busyPath === path
                            ? "در حال ثبت…"
                            : frozen && frozenDecision === "APPROVE"
                              ? "تکرار امن همان تأیید"
                              : "تأیید گزارش"}
                        </button>
                        <button type="button"
                          className="support-incident__reject"
                          disabled={!reasons[incident.id]?.trim() ||
                            busyPath !== null ||
                            (frozen && frozenDecision !== "REJECT")}
                          onClick={() => void decide(incident, "REJECT")}>
                          {frozen && frozenDecision === "REJECT"
                            ? "تکرار امن همان رد"
                            : "رد گزارش"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        <div className="seller-commerce__pager">
          <button type="button" disabled={page === 1 || busyPath !== null}
            onClick={() => setPage(value => Math.max(1, value - 1))}>
            صفحه قبل
          </button>
          <button type="button"
            disabled={state.kind !== "ready" ||
              state.items.length < 20 || busyPath !== null}
            onClick={() => setPage(value => value + 1)}>
            صفحه بعد
          </button>
        </div>
      </section>
    </main>
  );
}
