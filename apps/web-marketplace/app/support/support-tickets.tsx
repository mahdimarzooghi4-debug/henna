"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  StaffCommerceError,
  staffGet,
  staffIntent,
  staffPost,
  staffTime,
  type StaffIntent,
  type StaffTicket,
} from "../../lib/staff-commerce";

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
  const [uncertainPath, setUncertainPath] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const intents = useRef<Record<string, StaffIntent | null>>({});

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
    const intent = staffIntent(intents.current[path] ?? null, path, {
      reply: text,
    });
    intents.current[path] = intent;
    setBusyPath(path);
    setNotice(null);
    try {
      await staffPost<StaffTicket>("support", intent);
      intents.current[path] = null;
      setUncertainPath(current => current === path ? null : current);
      setReplies(current => ({ ...current, [ticket.id]: "" }));
      setNotice("پاسخ پشتیبانی در سرور ثبت شد.");
      await load(page);
    } catch (error) {
      if (error instanceof StaffCommerceError && error.status === 503) {
        setUncertainPath(path);
        setNotice(
          "نتیجه پاسخ هنوز قطعی نیست؛ همان پاسخ با همان کلید برای تکرار امن حفظ شده است.");
      } else {
        intents.current[path] = null;
        setUncertainPath(current => current === path ? null : current);
        setNotice(failure(error));
        if (error instanceof StaffCommerceError && error.status === 409)
          await load(page);
      }
    } finally {
      setBusyPath(null);
    }
  }

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
        const frozen = uncertainPath === path;
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
                    disabled={frozen || busyPath !== null}
                    onChange={event => setReplies(current => ({
                      ...current,
                      [ticket.id]: event.target.value,
                    }))} />
                </label>
                <button type="button" className="primary-button"
                  disabled={!replies[ticket.id]?.trim() || busyPath !== null}
                  onClick={() => void reply(ticket)}>
                  {busyPath === path
                    ? "در حال ثبت…"
                    : frozen
                      ? "تکرار امن همان پاسخ"
                      : "ثبت پاسخ"}
                </button>
              </div>
            )}
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
  );
}
