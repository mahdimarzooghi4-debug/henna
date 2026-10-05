"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BuyerCommerceError,
  buyerGet,
  buyerPost,
  commerceIntent,
  type BuyerNotification,
  type BuyerTicket,
  type CommerceIntent,
} from "../lib/buyer-commerce";
import {
  clearWebCommerceIntent,
  persistWebCommerceIntent,
  restoreWebCommerceIntent,
} from "../lib/web-pending-commerce";

type Load<T> =
  | { kind: "loading" }
  | { kind: "ready"; items: T[] }
  | { kind: "error"; message: string };

const notificationLabels: Record<string, string> = {
  SELLER_ORDER_STATE: "وضعیت سفارش شما تغییر کرد.",
  REPLY_TICKET: "پشتیبانی به تیکت شما پاسخ داد.",
  DECIDE_INCIDENT: "نتیجه بررسی گزارش مشکل شما ثبت شد.",
  VERIFY_UNAVAILABILITY: "نتیجه بررسی مراجعه مرجوعی ثبت شد.",
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "دریافت اطلاعات حساب تأیید نشد.";
}

export function BuyerAccountCenter() {
  const [notificationPage, setNotificationPage] = useState(1);
  const [ticketPage, setTicketPage] = useState(1);
  const [notifications, setNotifications] =
    useState<Load<BuyerNotification>>({ kind: "loading" });
  const [tickets, setTickets] =
    useState<Load<BuyerTicket>>({ kind: "loading" });
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<CommerceIntent | null>(null);
  const mounted = useRef(true);

  const loadNotifications = useCallback(async (
    page: number,
    signal?: AbortSignal,
  ) => {
    setNotifications({ kind: "loading" });
    try {
      const items = await buyerGet<BuyerNotification[]>(
        "notifications?page=" + page, signal);
      if (!signal?.aborted)
        setNotifications({ kind: "ready", items });
    } catch (error) {
      if (!signal?.aborted)
        setNotifications({ kind: "error", message: errorMessage(error) });
    }
  }, []);

  const loadTickets = useCallback(async (
    page: number,
    signal?: AbortSignal,
  ) => {
    setTickets({ kind: "loading" });
    try {
      const items = await buyerGet<BuyerTicket[]>(
        "tickets?page=" + page, signal);
      if (!signal?.aborted)
        setTickets({ kind: "ready", items });
    } catch (error) {
      if (!signal?.aborted)
        setTickets({ kind: "error", message: errorMessage(error) });
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      loadNotifications(notificationPage),
      loadTickets(ticketPage),
    ]);
  }, [loadNotifications, loadTickets, notificationPage, ticketPage]);

  useEffect(() => {
    mounted.current = true;
    try {
      const restored = restoreWebCommerceIntent("support");
      if (restored) {
        setPending(restored);
        if (restored.path === "tickets") {
          const input = JSON.parse(restored.body) as {
            subject?: unknown; message?: unknown;
          };
          if (typeof input.subject === "string") setSubject(input.subject);
          if (typeof input.message === "string") setMessage(input.message);
        }
        setNotice(
          "یک درخواست پشتیبانی با نتیجه نامشخص از همین تب بازیابی شد؛ فقط همان درخواست قابل تکرار است.");
      }
    } catch {
      setNotice(
        "وضعیت درخواست قبلی قابل تأیید نیست؛ برای جلوگیری از ثبت تکراری، عملیات نوشتنی قفل شده است.");
      setBusy(true);
    }
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadNotifications(notificationPage, controller.signal);
    return () => controller.abort();
  }, [loadNotifications, notificationPage]);

  useEffect(() => {
    const controller = new AbortController();
    void loadTickets(ticketPage, controller.signal);
    return () => controller.abort();
  }, [loadTickets, ticketPage]);

  const mutate = useCallback(async (
    intent: CommerceIntent,
    success: string,
  ) => {
    setBusy(true);
    setNotice("");
    try {
      persistWebCommerceIntent("support", intent);
      setPending(intent);
      await buyerPost(intent);
      clearWebCommerceIntent(intent.key);
      if (!mounted.current) return;
      setPending(null);
      setNotice(success);
      if (intent.path === "tickets") {
        setSubject("");
        setMessage("");
      }
      await refresh();
    } catch (error) {
      if (!mounted.current) return;
      const normalized = error instanceof BuyerCommerceError
        ? error : new BuyerCommerceError(503);
      if (normalized.status === 503) {
        setPending(intent);
        setNotice(
          "نتیجه درخواست قطعی نیست؛ همان اقدام را دوباره بزنید تا کلید و بدنه بدون تغییر تکرار شوند.");
      } else {
        clearWebCommerceIntent(intent.key);
        setPending(null);
        setNotice(normalized.message);
        if (normalized.status === 409) await refresh();
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [refresh]);

  const openTicket = () => {
    if (pending || busy) return;
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (!cleanSubject || cleanSubject.length > 120 ||
        !cleanMessage || cleanMessage.length > 2000) {
      setNotice("عنوان و متن تیکت را در محدوده مجاز کامل کنید.");
      return;
    }
    void mutate(
      commerceIntent(null, "tickets", {
        subject: cleanSubject,
        message: cleanMessage,
      }),
      "تیکت برای پشتیبانی حنا ثبت شد.",
    );
  };

  const markRead = (item: BuyerNotification) => {
    if (pending || busy || item.read) return;
    void mutate(
      commerceIntent(null, "notifications/" + item.id + "/read", {}),
      "اعلان به‌عنوان خوانده‌شده ثبت شد.",
    );
  };

  const retry = () => {
    if (!pending || busy) return;
    void mutate(
      pending,
      pending.path === "tickets"
        ? "تیکت برای پشتیبانی حنا ثبت شد."
        : "اعلان به‌عنوان خوانده‌شده ثبت شد.",
    );
  };

  const denied = [notifications, tickets].some(state =>
    state.kind === "error" &&
    /وارد|نشست|اجازه/.test(state.message));

  return (
    <main className="buyer-account">
      <header className="buyer-account__header">
        <div>
          <p className="seller-panel__eyebrow">حساب خریدار</p>
          <h1>اعلان‌ها و پشتیبانی</h1>
          <p>
            اعلان‌ها و تیکت‌ها فقط از دادهٔ حساب واردشده خوانده می‌شوند.
            پاسخ پشتیبانی داخل همین صفحه نمایش داده می‌شود.
          </p>
        </div>
        <div className="buyer-account__header-actions">
          <Link href="/" className="auth-card__secondary">فروشگاه</Link>
          <Link href="/orders" className="auth-card__secondary">سفارش‌های من</Link>
        </div>
      </header>

      {notice && (
        <p className="form-status buyer-account__notice" role="status">
          {notice}
        </p>
      )}
      {denied && (
        <p className="form-status form-status--error" role="alert">
          برای دیدن اطلاعات خصوصی حساب، ابتدا وارد حنا شوید.{" "}
          <Link href="/auth">ورود به حنا</Link>
        </p>
      )}

      {pending && (
        <section className="buyer-account__pending" aria-label="درخواست نامشخص">
          <strong>یک درخواست حل‌نشده دارید.</strong>
          <p>
            تا تعیین نتیجه، درخواست دیگری ارسال نمی‌شود تا عملیات تکراری
            ایجاد نشود.
          </p>
          <button type="button" className="primary-button"
            disabled={busy} onClick={retry}>
            {busy ? "در حال بررسی…" : "تکرار امن همان درخواست"}
          </button>
        </section>
      )}

      <section className="buyer-account__grid">
        <article className="buyer-account__panel">
          <div className="seller-commerce__section-title">
            <h2>اعلان‌های من</h2>
            <span>صفحه {new Intl.NumberFormat("fa-IR").format(notificationPage)}</span>
          </div>
          {notifications.kind === "loading" &&
            <p className="form-status">در حال دریافت اعلان‌ها…</p>}
          {notifications.kind === "error" &&
            <p className="form-status form-status--error" role="alert">
              {notifications.message}
            </p>}
          {notifications.kind === "ready" && !notifications.items.length &&
            <p className="seller-commerce__empty">اعلانی ندارید.</p>}
          {notifications.kind === "ready" &&
            notifications.items.map(item => (
              <div className={item.read
                ? "buyer-account__notification"
                : "buyer-account__notification buyer-account__notification--unread"}
                key={item.id}>
                <div>
                  <strong>
                    {notificationLabels[item.code] ??
                      "رویداد تازه‌ای در حساب شما ثبت شد."}
                  </strong>
                  <small>
                    {new Intl.DateTimeFormat("fa-IR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.createdAtUtc))}
                  </small>
                </div>
                {!item.read && (
                  <button type="button" className="seller-commerce__refresh"
                    disabled={busy || pending !== null}
                    onClick={() => markRead(item)}>
                    خوانده شد
                  </button>
                )}
              </div>
            ))}
          <div className="seller-commerce__pager">
            <button type="button"
              disabled={notificationPage === 1 || busy || pending !== null}
              onClick={() => setNotificationPage(page => page - 1)}>
              صفحه قبل
            </button>
            <button type="button"
              disabled={notifications.kind !== "ready" ||
                notifications.items.length < 20 || busy || pending !== null}
              onClick={() => setNotificationPage(page => page + 1)}>
              صفحه بعد
            </button>
          </div>
        </article>

        <article className="buyer-account__panel">
          <h2>تماس با پشتیبانی</h2>
          <label className="field">
            <span className="field__label">عنوان</span>
            <input className="field__input" maxLength={120}
              disabled={busy || pending !== null}
              value={subject}
              onChange={event => setSubject(event.target.value)}
              placeholder="موضوع درخواست" />
          </label>
          <label className="field">
            <span className="field__label">شرح درخواست</span>
            <textarea className="field__input buyer-account__textarea"
              maxLength={2000}
              disabled={busy || pending !== null}
              value={message}
              onChange={event => setMessage(event.target.value)}
              placeholder="مسئله را برای پشتیبانی توضیح دهید." />
          </label>
          <button type="button" className="primary-button"
            disabled={busy || pending !== null ||
              !subject.trim() || !message.trim()}
            onClick={openTicket}>
            ثبت تیکت
          </button>

          <div className="buyer-account__tickets">
            <div className="seller-commerce__section-title">
              <h3>تیکت‌های من</h3>
              <span>صفحه {new Intl.NumberFormat("fa-IR").format(ticketPage)}</span>
            </div>
            {tickets.kind === "loading" &&
              <p className="form-status">در حال دریافت تیکت‌ها…</p>}
            {tickets.kind === "error" &&
              <p className="form-status form-status--error" role="alert">
                {tickets.message}
              </p>}
            {tickets.kind === "ready" && !tickets.items.length &&
              <p className="seller-commerce__empty">تیکتی ثبت نشده است.</p>}
            {tickets.kind === "ready" && tickets.items.map(item => (
              <article className="buyer-account__ticket" key={item.id}>
                <div className="buyer-account__ticket-head">
                  <strong>{item.subject}</strong>
                  <span>{item.state === "ANSWERED" ? "پاسخ داده شده" : "باز"}</span>
                </div>
                <p>{item.message}</p>
                {item.reply && (
                  <div className="buyer-account__reply">
                    <b>پاسخ پشتیبانی</b>
                    <p>{item.reply}</p>
                  </div>
                )}
              </article>
            ))}
            <div className="seller-commerce__pager">
              <button type="button"
                disabled={ticketPage === 1 || busy || pending !== null}
                onClick={() => setTicketPage(page => page - 1)}>
                صفحه قبل
              </button>
              <button type="button"
                disabled={tickets.kind !== "ready" ||
                  tickets.items.length < 20 || busy || pending !== null}
                onClick={() => setTicketPage(page => page + 1)}>
                صفحه بعد
              </button>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
