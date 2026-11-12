"use client";

import { useCallback, useEffect, useState } from "react";
import {
  StaffCommerceError,
  staffGet,
  staffIntent,
  staffPost,
  staffTime,
  type StaffIntent,
  type StaffTicket,
} from "../../lib/staff-commerce";
import {
  restoreSupportDecisionIntent,
  subscribeSupportDecisionIntent,
} from "../../lib/web-pending-support-decision";
import {
  clearSupportOperationIntent,
  persistSupportOperationIntent,
  restoreSupportOperationIntent,
  subscribeSupportOperationIntent,
  supportOperationIntentDetails,
} from "../../lib/web-pending-support-operations";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; items: StaffTicket[] }
  | { kind: "error"; message: string };

function failure(error: unknown) {
  return error instanceof Error ? error.message : "پاسخ سرور تأیید نشد.";
}

export function SupportTickets() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [storageFailure, setStorageFailure] = useState<string | null>(null);
  const [pendingOperationIntent, setPendingOperationIntent] =
    useState<StaffIntent | null>(null);
  const [decisionLocked, setDecisionLocked] = useState(false);

  const load = useCallback(async (requestedPage: number, signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const items = await staffGet<StaffTicket[]>(
        "support", "tickets?page=" + requestedPage, signal);
      setState({ kind: "ready", items });
    } catch (error) {
      if (!signal?.aborted)
        setState({ kind: "error", message: failure(error) });
    }
  }, []);

  useEffect(() => {
    try {
      const restored = restoreSupportOperationIntent();
      setDecisionLocked(restoreSupportDecisionIntent() !== null);
      if (!restored) return;
      const details = supportOperationIntentDetails(restored);
      if (!details) throw Error();
      setPendingOperationIntent(restored);
      if (details.kind === "ticket-reply") {
        setReplies({ [details.ticketId]: details.reply });
        setNotice(
          "یک پاسخ پشتیبانی نتیجه قطعی ندارد. همان پاسخ، کلید و بدنه برای تکرار امن بازیابی شد.");
      } else {
        setNotice(
          "یک عملیات پشتیبانی دیگر نتیجه قطعی ندارد؛ تا تعیین تکلیف آن پاسخ جدید ارسال نمی‌شود.");
      }
    } catch {
      setStorageFailure(
        "وضعیت retry امن پاسخ پشتیبانی قابل اعتماد نیست. ارسال پاسخ جدید متوقف شد.");
    }
  }, []);

  useEffect(() => subscribeSupportOperationIntent(() => {
    try {
      setPendingOperationIntent(restoreSupportOperationIntent());
    } catch {
      setStorageFailure(
        "وضعیت retry امن پاسخ پشتیبانی قابل اعتماد نیست. ارسال پاسخ جدید متوقف شد.");
    }
  }), []);

  useEffect(() => subscribeSupportDecisionIntent(() => {
    try {
      setDecisionLocked(restoreSupportDecisionIntent() !== null);
    } catch {
      setStorageFailure(
        "وضعیت retry امن تصمیم پشتیبانی قابل اعتماد نیست. ارسال پاسخ جدید متوقف شد.");
    }
  }), []);

  useEffect(() => {
    const controller = new AbortController();
    void load(page, controller.signal);
    return () => controller.abort();
  }, [load, page]);

  async function reply(ticket: StaffTicket) {
    const path = `tickets/${ticket.id}/reply`;
    const text = replies[ticket.id]?.trim() ?? "";
    if (!text) {
      setNotice("متن پاسخ الزامی است.");
      return;
    }
    if (decisionLocked) {
      setNotice(
        "ابتدا تصمیم پشتیبانی قبلی تعیین تکلیف شود؛ ارسال پاسخ جدید مجاز نیست.");
      return;
    }

    const restored = pendingOperationIntent
      ? supportOperationIntentDetails(pendingOperationIntent)
      : null;
    if (pendingOperationIntent &&
        (!restored || restored.kind !== "ticket-reply" ||
          restored.ticketId !== ticket.id || restored.reply !== text)) {
      setNotice(
        "ابتدا عملیات پشتیبانی قبلی با همان ورودی تعیین تکلیف شود.");
      return;
    }

    const intent = staffIntent(pendingOperationIntent, path, {
      reply: text,
    });
    try {
      persistSupportOperationIntent(intent);
    } catch {
      setStorageFailure(
        "ذخیره retry امن پاسخ پشتیبانی تأیید نشد؛ هیچ پاسخی به سرور ارسال نشد.");
      return;
    }
    setPendingOperationIntent(intent);
    setBusyPath(path);
    setNotice(null);
    try {
      await staffPost<StaffTicket>("support", intent);
      if (!clearSupportOperationIntent(intent.key)) {
        setStorageFailure(
          "پاسخ سرور دریافت شد، اما پاک‌سازی retry پاسخ تأیید نشد. ارسال پاسخ جدید متوقف است.");
        return;
      }
      setPendingOperationIntent(null);
      setReplies(current => ({ ...current, [ticket.id]: "" }));
      setNotice("پاسخ پشتیبانی در سرور ثبت شد.");
      await load(page);
    } catch (error) {
      if (error instanceof StaffCommerceError && error.status === 503) {
        setPendingOperationIntent(intent);
        setNotice(
          "نتیجه پاسخ هنوز قطعی نیست. همان پاسخ، کلید و بدنه در این تب حفظ شده‌اند و پس از reload نیز قابل تکرار امن هستند.");
      } else {
        if (!clearSupportOperationIntent(intent.key)) {
          setStorageFailure(
            "نتیجه سرور قطعی است، اما پاک‌سازی retry پاسخ تأیید نشد. ارسال پاسخ جدید متوقف است.");
          return;
        }
        setPendingOperationIntent(null);
        setNotice(failure(error));
        if (error instanceof StaffCommerceError && error.status === 409)
          await load(page);
      }
    } finally {
      setBusyPath(null);
    }
  }

  if (storageFailure) {
    return (
      <section className="support-panel__content"
        aria-labelledby="support-tickets-title">
        <p className="form-status form-status--error" role="alert">
          {storageFailure}
        </p>
      </section>
    );
  }

  const pendingDetails = pendingOperationIntent
    ? supportOperationIntentDetails(pendingOperationIntent)
    : null;
  const globalFrozen = decisionLocked || pendingOperationIntent !== null;

  return (
    <section className="support-panel__content" aria-labelledby="support-tickets-title">
      <div className="seller-commerce__section-title">
        <div>
          <h2 id="support-tickets-title">تیکت‌های پشتیبانی</h2>
          <p>پاسخ فقط در صندوق داخلی حنا ثبت می‌شود؛ پیامک ارسال‌شده فرض نمی‌شود.</p>
        </div>
        <span>صفحه {new Intl.NumberFormat("fa-IR").format(page)}</span>
      </div>
      {notice && <p className="form-status" role="status">{notice}</p>}
      {state.kind === "loading" &&
        <p className="form-status">در حال دریافت تیکت‌ها…</p>}
      {state.kind === "error" &&
        <p className="form-status form-status--error">{state.message}</p>}
      {state.kind === "ready" && state.items.length === 0 &&
        <p className="seller-commerce__empty">تیکتی در این صفحه نیست.</p>}
      {state.kind === "ready" && state.items.map(ticket => {
        const path = `tickets/${ticket.id}/reply`;
        const pendingHere = pendingDetails?.kind === "ticket-reply" &&
          pendingDetails.ticketId === ticket.id;
        return (
          <article className="support-ticket" key={ticket.id}>
            <div className="seller-commerce__card-head">
              <div>
                <strong>{ticket.subject}</strong>
                <p>{staffTime(ticket.createdAtUtc)}</p>
              </div>
              <span className="seller-commerce__state">
                {ticket.state === "ANSWERED" ? "پاسخ داده شده" : "باز"}
              </span>
            </div>
            <p className="support-ticket__message">{ticket.message}</p>
            {ticket.reply && (
              <div className="support-incident__result">
                <strong>پاسخ ثبت‌شده</strong>
                <p>{ticket.reply}</p>
              </div>
            )}
            {ticket.state === "OPEN" && (
              <div className="support-ticket__reply">
                <label className="field">
                  <span className="field__label">پاسخ پشتیبانی</span>
                  <textarea className="field__input support-incident__reason"
                    maxLength={2000}
                    value={replies[ticket.id] ?? ""}
                    disabled={globalFrozen || busyPath !== null}
                    onChange={event => setReplies(current => ({
                      ...current,
                      [ticket.id]: event.target.value,
                    }))} />
                </label>
                <button type="button" className="primary-button"
                  disabled={!replies[ticket.id]?.trim() || busyPath !== null ||
                    decisionLocked ||
                    (pendingOperationIntent !== null && !pendingHere)}
                  onClick={() => void reply(ticket)}>
                  {busyPath === path
                    ? "در حال ثبت…"
                    : pendingHere
                      ? "تکرار امن همان پاسخ"
                      : "ثبت پاسخ"}
                </button>
              </div>
            )}
          </article>
        );
      })}
      <div className="seller-commerce__pager">
        <button type="button"
          disabled={page === 1 || busyPath !== null || globalFrozen}
          onClick={() => setPage(value => Math.max(1, value - 1))}>
          صفحه قبل
        </button>
        <button type="button"
          disabled={state.kind !== "ready" ||
            state.items.length < 20 || busyPath !== null || globalFrozen}
          onClick={() => setPage(value => value + 1)}>
          صفحه بعد
        </button>
      </div>
    </section>
  );
}
