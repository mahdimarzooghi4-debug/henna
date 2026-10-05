"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  parseBuyerPage,
  parseBuyerProduct,
  type BuyerProduct,
} from "../../lib/buyer-catalog";
import {
  StaffCommerceError,
  staffGet,
  staffIntent,
  staffPost,
  staffRial,
  staffTime,
  type StaffIntent,
  type StaffNotification,
  type StaffOffer,
  type StaffReport,
  type StaffSettlement,
  type StaffTicket,
} from "../../lib/staff-commerce";

type Load<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; items: T[] }
  | { kind: "error"; message: string };

type OfferDraft = { price: string; stock: string };

function failure(error: unknown) {
  return error instanceof Error
    ? error.message
    : "پاسخ سرور تأیید نشد.";
}

function notificationLabel(code: string) {
  const labels: Record<string, string> = {
    SELLER_ORDER_STATE: "تغییر وضعیت سفارش",
    CANCEL_ORDER: "لغو سفارش",
    CONFIRM_PICKUP: "تأیید دریافت سفارش",
    DECIDE_INCIDENT: "تصمیم پشتیبانی درباره گزارش",
    REPLY_TICKET: "پاسخ پشتیبانی",
    WITHDRAWAL_SLA_BREACHED: "پیگیری برداشت",
  };
  return labels[code] ?? code.replaceAll("_", " ");
}

async function publicProduct(
  productId: string,
  signal?: AbortSignal,
): Promise<BuyerProduct | null> {
  try {
    const response = await fetch("/api/catalog/products/" + productId, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal,
      headers: { Accept: "application/json" },
    });
    if (response.status !== 200 ||
        !response.headers.get("content-type")?.includes("application/json"))
      return null;
    return parseBuyerProduct(await response.json(), productId);
  } catch {
    return null;
  }
}

export function SellerBusinessOperations({
  offerManagementEnabled,
  settlementsEnabled,
  reportsEnabled,
}: {
  offerManagementEnabled: boolean;
  settlementsEnabled: boolean;
  reportsEnabled: boolean;
}) {
  const [activated, setActivated] = useState(false);
  const [offersPage, setOffersPage] = useState(1);
  const [settlementsPage, setSettlementsPage] = useState(1);
  const [notificationsPage, setNotificationsPage] = useState(1);
  const [ticketsPage, setTicketsPage] = useState(1);
  const [report, setReport] = useState<
    { kind: "idle" } | { kind: "loading" } |
    { kind: "ready"; value: StaffReport } |
    { kind: "error"; message: string }
  >({ kind: "idle" });
  const [offers, setOffers] = useState<Load<StaffOffer>>({ kind: "idle" });
  const [settlements, setSettlements] =
    useState<Load<StaffSettlement>>({ kind: "idle" });
  const [notifications, setNotifications] =
    useState<Load<StaffNotification>>({ kind: "idle" });
  const [tickets, setTickets] = useState<Load<StaffTicket>>({ kind: "idle" });
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, OfferDraft>>({});
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState<BuyerProduct[]>([]);
  const [catalogStatus, setCatalogStatus] =
    useState<"idle" | "loading" | "error">("idle");
  const [selectedProduct, setSelectedProduct] = useState<BuyerProduct | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [uncertainPath, setUncertainPath] = useState<string | null>(null);
  const intents = useRef<Record<string, StaffIntent | null>>({});
  const pendingOffer = useRef<{
    offerId: string;
    productId: string;
    priceRial: number;
    stock: number;
    expectedVersion: number;
  } | null>(null);

  const loadReport = useCallback(async (signal?: AbortSignal) => {
    if (!reportsEnabled) return;
    setReport({ kind: "loading" });
    try {
      const value = await staffGet<StaffReport>("seller", "report", signal);
      setReport({ kind: "ready", value });
    } catch (error) {
      if (!signal?.aborted)
        setReport({ kind: "error", message: failure(error) });
    }
  }, [reportsEnabled]);

  const loadOffers = useCallback(async (page: number, signal?: AbortSignal) => {
    if (!offerManagementEnabled) return;
    setOffers({ kind: "loading" });
    try {
      const items = await staffGet<StaffOffer[]>(
        "seller", "offers?page=" + page, signal);
      setOffers({ kind: "ready", items });
      setDrafts(current => {
        const next = { ...current };
        for (const item of items) {
          if (!next[item.id]) next[item.id] = {
            price: String(item.priceRial),
            stock: String(item.stock),
          };
        }
        return next;
      });
      const missing = [...new Set(items.map(item => item.productId))]
        .filter(productId => !(productId in productNames));
      if (missing.length) {
        const resolved = await Promise.all(missing.map(async productId => ({
          productId,
          product: await publicProduct(productId, signal),
        })));
        if (!signal?.aborted)
          setProductNames(current => {
            const next = { ...current };
            for (const entry of resolved)
              next[entry.productId] = entry.product?.name ??
                "کالای خارج‌شده از کاتالوگ منتشرشده";
            return next;
          });
      }
    } catch (error) {
      if (!signal?.aborted)
        setOffers({ kind: "error", message: failure(error) });
    }
  }, [offerManagementEnabled, productNames]);

  const loadSettlements = useCallback(async (
    page: number,
    signal?: AbortSignal,
  ) => {
    if (!settlementsEnabled) return;
    setSettlements({ kind: "loading" });
    try {
      const items = await staffGet<StaffSettlement[]>(
        "seller", "settlements?page=" + page, signal);
      setSettlements({ kind: "ready", items });
    } catch (error) {
      if (!signal?.aborted)
        setSettlements({ kind: "error", message: failure(error) });
    }
  }, [settlementsEnabled]);

  const loadNotifications = useCallback(async (
    page: number,
    signal?: AbortSignal,
  ) => {
    setNotifications({ kind: "loading" });
    try {
      const items = await staffGet<StaffNotification[]>(
        "seller", "notifications?page=" + page, signal);
      setNotifications({ kind: "ready", items });
    } catch (error) {
      if (!signal?.aborted)
        setNotifications({ kind: "error", message: failure(error) });
    }
  }, []);

  const loadTickets = useCallback(async (page: number, signal?: AbortSignal) => {
    setTickets({ kind: "loading" });
    try {
      const items = await staffGet<StaffTicket[]>(
        "seller", "tickets?page=" + page, signal);
      setTickets({ kind: "ready", items });
    } catch (error) {
      if (!signal?.aborted)
        setTickets({ kind: "error", message: failure(error) });
    }
  }, []);

  useEffect(() => {
    if (!activated) return;
    const controller = new AbortController();
    void Promise.all([
      loadReport(controller.signal),
      loadOffers(offersPage, controller.signal),
      loadSettlements(settlementsPage, controller.signal),
      loadNotifications(notificationsPage, controller.signal),
      loadTickets(ticketsPage, controller.signal),
    ]);
    return () => controller.abort();
  }, [
    activated, loadOffers, loadNotifications, loadReport, loadSettlements,
    loadTickets, notificationsPage, offersPage, settlementsPage, ticketsPage,
  ]);

  const mutate = useCallback(async <T,>(
    path: string,
    input: unknown,
    onSuccess: (value: T) => Promise<void> | void,
    successMessage: string,
  ) => {
    const intent = staffIntent(intents.current[path] ?? null, path, input);
    intents.current[path] = intent;
    setBusyPath(path);
    setNotice(null);
    try {
      const value = await staffPost<T>("seller", intent);
      intents.current[path] = null;
      setUncertainPath(current => current === path ? null : current);
      await onSuccess(value);
      setNotice(successMessage);
    } catch (error) {
      if (error instanceof StaffCommerceError && error.status === 503) {
        setUncertainPath(path);
        setNotice(
          "نتیجه درخواست هنوز قطعی نیست؛ برای تکرار امن همان عملیات را بدون تغییر ورودی دوباره اجرا کنید.");
      } else {
        intents.current[path] = null;
        setUncertainPath(current => current === path ? null : current);
        setNotice(failure(error));
      }
    } finally {
      setBusyPath(null);
    }
  }, []);

  async function searchCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = catalogSearch.trim();
    if (!term || term.length > 80) {
      setCatalogStatus("error");
      return;
    }
    setCatalogStatus("loading");
    try {
      const response = await fetch(
        "/api/catalog/products?page=1&pageSize=20&search=" +
          encodeURIComponent(term),
        {
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          headers: { Accept: "application/json" },
        },
      );
      const parsed = response.ok
        ? parseBuyerPage(await response.json(), 1)
        : null;
      if (!parsed) throw Error();
      setCatalogResults(parsed.items.filter(item => item.kind === "GOOD"));
      setCatalogStatus("idle");
    } catch {
      setCatalogResults([]);
      setCatalogStatus("error");
    }
  }

  async function saveExisting(offer: StaffOffer) {
    const draft = drafts[offer.id];
    const priceRial = Number(draft?.price);
    const stock = Number(draft?.stock);
    if (!Number.isSafeInteger(priceRial) || priceRial < 1 ||
        !Number.isSafeInteger(stock) || stock < 0 || stock > 1000000) {
      setNotice("قیمت یا موجودی معتبر نیست.");
      return;
    }
    const payload = {
      offerId: offer.id,
      productId: offer.productId,
      priceRial,
      stock,
      expectedVersion: offer.version,
    };
    pendingOffer.current = payload;
    await mutate<StaffOffer>("offers", payload, async () => {
      pendingOffer.current = null;
      await loadOffers(offersPage);
    }, "قیمت و موجودی پیشنهاد از سرور به‌روزرسانی شد.");
  }

  async function createOffer() {
    if (!selectedProduct || selectedProduct.kind !== "GOOD") return;
    const priceRial = Number(newPrice);
    const stock = Number(newStock);
    if (!Number.isSafeInteger(priceRial) || priceRial < 1 ||
        !Number.isSafeInteger(stock) || stock < 0 || stock > 1000000) {
      setNotice("قیمت یا موجودی پیشنهاد معتبر نیست.");
      return;
    }
    const payload = pendingOffer.current ?? {
      offerId: crypto.randomUUID(),
      productId: selectedProduct.id,
      priceRial,
      stock,
      expectedVersion: 0,
    };
    pendingOffer.current = payload;
    await mutate<StaffOffer>("offers", payload, async () => {
      pendingOffer.current = null;
      setSelectedProduct(null);
      setNewPrice("");
      setNewStock("");
      await loadOffers(offersPage);
    }, "پیشنهاد کالا با قیمت و موجودی واقعی ثبت شد.");
  }

  async function markRead(item: StaffNotification) {
    const path = `notifications/${item.id}/read`;
    await mutate<StaffNotification>(path, {}, async () => {
      await loadNotifications(notificationsPage);
    }, "اعلان خوانده شد.");
  }

  async function openTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = ticketSubject.trim();
    const message = ticketMessage.trim();
    if (!subject || !message) {
      setNotice("موضوع و متن تیکت الزامی است.");
      return;
    }
    await mutate<StaffTicket>("tickets", { subject, message }, async () => {
      setTicketSubject("");
      setTicketMessage("");
      await loadTickets(ticketsPage);
    }, "تیکت پشتیبانی ثبت شد.");
  }

  if (!activated) {
    return (
      <section className="seller-commerce" aria-label="کسب‌وکار و مالی فروشنده">
        <div className="seller-commerce__heading">
          <div>
            <p className="seller-panel__eyebrow">قیمت، موجودی و پیگیری</p>
            <h2>عملیات تکمیلی فروشگاه</h2>
            <p>
              پیشنهاد کالا، تسویه آماده‌شده، اعلان و تیکت فقط با اقدام صریح شما
              از سرور حنا خوانده می‌شوند.
            </p>
          </div>
          <button type="button" className="seller-commerce__refresh"
            onClick={() => setActivated(true)}>
            بارگیری عملیات تکمیلی
          </button>
        </div>
      </section>
    );
  }

  const offerFrozen = uncertainPath === "offers";
  const ticketFrozen = uncertainPath === "tickets";

  return (
    <section className="seller-business-ops" aria-label="عملیات تکمیلی فروشگاه">
      {notice && <p className="form-status" role="status">{notice}</p>}

      {reportsEnabled && (
        <section id="seller-reports" className="seller-commerce__section">
          <div className="seller-commerce__section-title">
            <div>
              <h3>گزارش عملیاتی فروشگاه</h3>
              <p>
                این گزارش از read-model سرور ساخته می‌شود و پرداخت بانکی را
                انجام‌شده فرض نمی‌کند.
              </p>
            </div>
          </div>
          {report.kind === "loading" &&
            <p className="form-status">در حال دریافت گزارش…</p>}
          {report.kind === "error" &&
            <p className="form-status form-status--error">{report.message}</p>}
          {report.kind === "ready" && (
            <>
              <div className="seller-report-grid">
                <article><span>کل سفارش</span><strong>{report.value.orders}</strong></article>
                <article><span>پرداخت‌شده</span><strong>{report.value.paid}</strong></article>
                <article><span>آماده‌سازی</span><strong>{report.value.preparing}</strong></article>
                <article><span>آماده دریافت</span><strong>{report.value.readyForPickup}</strong></article>
                <article><span>تحویل‌شده</span><strong>{report.value.collected}</strong></article>
                <article><span>لغوشده</span><strong>{report.value.cancelled}</strong></article>
                <article><span>فروش ناخالص فعال</span><strong>{staffRial(report.value.grossRial)}</strong></article>
                <article><span>پرونده باز</span><strong>{report.value.openIncidents}</strong></article>
                <article><span>بازپرداخت پرونده‌ها</span><strong>{staffRial(report.value.incidentRefundRial)}</strong></article>
                <article><span>تسویه آماده</span><strong>{report.value.preparedSettlements}</strong></article>
                <article><span>خالص آماده تسویه</span><strong>{staffRial(report.value.settlementNetRial)}</strong></article>
                <article><span>نیازمند بررسی مالی</span><strong>{report.value.financeReviewRequired}</strong></article>
              </div>
              <dl className="seller-commerce__facts seller-report-breakdown">
                <div><dt>ناخالص تسویه‌ها</dt><dd>{staffRial(report.value.settlementGrossRial)}</dd></div>
                <div><dt>بازپرداخت تسویه‌ها</dt><dd>{staffRial(report.value.settlementRefundRial)}</dd></div>
                <div><dt>جریمه‌ها</dt><dd>{staffRial(report.value.settlementPenaltyRial)}</dd></div>
                <div><dt>کارمزدها</dt><dd>{staffRial(report.value.settlementFeeRial)}</dd></div>
              </dl>
            </>
          )}
        </section>
      )}

      {offerManagementEnabled && (
        <section id="seller-offers" className="seller-commerce__section">
          <div className="seller-commerce__section-title">
            <div>
              <h3>قیمت و موجودی کالاها</h3>
              <p>
                فقط کالاهای GOOD منتشرشده در کاتالوگ قابل ثبت هستند.
              </p>
            </div>
            <span>صفحه {new Intl.NumberFormat("fa-IR").format(offersPage)}</span>
          </div>

          <form className="seller-offer-search" onSubmit={searchCatalog}>
            <label className="field">
              <span className="field__label">جست‌وجوی کالای منتشرشده</span>
              <input className="field__input" maxLength={80}
                value={catalogSearch}
                disabled={offerFrozen || busyPath !== null}
                onChange={event => setCatalogSearch(event.target.value)}
                placeholder="نام کالا" />
            </label>
            <button type="submit" className="seller-commerce__refresh"
              disabled={offerFrozen || busyPath !== null ||
                !catalogSearch.trim()}>
              جست‌وجو
            </button>
          </form>

          {catalogStatus === "loading" &&
            <p className="form-status">در حال جست‌وجوی کاتالوگ…</p>}
          {catalogStatus === "error" &&
            <p className="form-status form-status--error">
              نتیجه کاتالوگ تأیید نشد.
            </p>}
          {catalogResults.length > 0 && (
            <div className="seller-offer-results">
              {catalogResults.map(product => (
                <button key={product.id} type="button"
                  className={selectedProduct?.id === product.id
                    ? "seller-offer-result seller-offer-result--selected"
                    : "seller-offer-result"}
                  disabled={offerFrozen || busyPath !== null}
                  onClick={() => setSelectedProduct(product)}>
                  <strong>{product.name}</strong>
                  <small>کالا</small>
                </button>
              ))}
            </div>
          )}

          {selectedProduct && (
            <div className="seller-offer-new">
              <strong>{selectedProduct.name}</strong>
              <label className="field">
                <span className="field__label">قیمت، ریال</span>
                <input className="field__input" inputMode="numeric"
                  value={newPrice}
                  disabled={offerFrozen || busyPath !== null}
                  onChange={event => setNewPrice(event.target.value)}
                  placeholder="مثلاً 250000" />
              </label>
              <label className="field">
                <span className="field__label">موجودی</span>
                <input className="field__input" inputMode="numeric"
                  value={newStock}
                  disabled={offerFrozen || busyPath !== null}
                  onChange={event => setNewStock(event.target.value)}
                  placeholder="مثلاً 12" />
              </label>
              <button type="button" className="primary-button"
                disabled={busyPath !== null}
                onClick={() => void createOffer()}>
                {busyPath === "offers"
                  ? "در حال ثبت…"
                  : offerFrozen
                    ? "تکرار امن همان ثبت"
                    : "ثبت پیشنهاد"}
              </button>
            </div>
          )}

          {offers.kind === "loading" &&
            <p className="form-status">در حال دریافت پیشنهادها…</p>}
          {offers.kind === "error" &&
            <p className="form-status form-status--error">{offers.message}</p>}
          {offers.kind === "ready" && offers.items.length === 0 &&
            <p className="seller-commerce__empty">
              هنوز پیشنهاد کالایی برای این فروشگاه ثبت نشده است.
            </p>}
          {offers.kind === "ready" && offers.items.map(offer => {
            const draft = drafts[offer.id] ?? {
              price: String(offer.priceRial), stock: String(offer.stock),
            };
            return (
              <article className="seller-offer-card" key={offer.id}>
                <div>
                  <strong>{productNames[offer.productId] ?? "در حال دریافت نام کالا…"}</strong>
                  <p>
                    نسخه {new Intl.NumberFormat("fa-IR").format(offer.version)}
                    {" · "}
                    {offer.published ? "منتشر" : "غیرفعال"}
                  </p>
                </div>
                <label className="field">
                  <span className="field__label">قیمت، ریال</span>
                  <input className="field__input" inputMode="numeric"
                    value={draft.price}
                    disabled={offerFrozen || busyPath !== null}
                    onChange={event => setDrafts(current => ({
                      ...current,
                      [offer.id]: { ...draft, price: event.target.value },
                    }))} />
                </label>
                <label className="field">
                  <span className="field__label">موجودی</span>
                  <input className="field__input" inputMode="numeric"
                    value={draft.stock}
                    disabled={offerFrozen || busyPath !== null}
                    onChange={event => setDrafts(current => ({
                      ...current,
                      [offer.id]: { ...draft, stock: event.target.value },
                    }))} />
                </label>
                <button type="button" className="seller-commerce__refresh"
                  disabled={busyPath !== null}
                  onClick={() => void saveExisting(offer)}>
                  {busyPath === "offers" ? "در حال ثبت…" : "ذخیره"}
                </button>
              </article>
            );
          })}
          <div className="seller-commerce__pager">
            <button type="button"
              disabled={offersPage === 1 || busyPath !== null || offerFrozen}
              onClick={() => setOffersPage(page => Math.max(1, page - 1))}>
              صفحه قبل
            </button>
            <button type="button"
              disabled={offers.kind !== "ready" || offers.items.length < 20 ||
                busyPath !== null || offerFrozen}
              onClick={() => setOffersPage(page => page + 1)}>
              صفحه بعد
            </button>
          </div>
        </section>
      )}

      {settlementsEnabled && (
        <section id="seller-settlements" className="seller-commerce__section">
          <div className="seller-commerce__section-title">
            <div>
              <h3>تسویه‌های آماده‌شده</h3>
              <p>
                این وضعیت داخلی حناست؛ «آماده انتقال» به معنی واریز بانکی نیست.
              </p>
            </div>
            <span>صفحه {new Intl.NumberFormat("fa-IR").format(settlementsPage)}</span>
          </div>
          {settlements.kind === "loading" &&
            <p className="form-status">در حال دریافت تسویه‌ها…</p>}
          {settlements.kind === "error" &&
            <p className="form-status form-status--error">
              {settlements.message}
            </p>}
          {settlements.kind === "ready" && settlements.items.length === 0 &&
            <p className="seller-commerce__empty">
              هنوز تسویه آماده‌شده‌ای برای این فروشگاه وجود ندارد.
            </p>}
          {settlements.kind === "ready" && settlements.items.map(item => (
            <article className="seller-settlement-card" key={item.id}>
              <div className="seller-commerce__card-head">
                <div>
                  <strong>
                    فاکتور <bdi dir="ltr">{item.orderId.slice(0, 8)}</bdi>
                  </strong>
                  <p>{staffTime(item.createdAtUtc)}</p>
                </div>
                <span className="seller-commerce__state">
                  {item.state === "READY_FOR_BANK_TRANSFER"
                    ? "آماده انتقال بانکی"
                    : "نیازمند بررسی مالی"}
                </span>
              </div>
              <dl className="seller-commerce__facts">
                <div><dt>فروش ناخالص</dt><dd>{staffRial(item.grossRial)}</dd></div>
                <div><dt>بازپرداخت</dt><dd>{staffRial(item.refundRial)}</dd></div>
                <div><dt>جریمه</dt><dd>{staffRial(item.penaltyRial)}</dd></div>
                <div><dt>کارمزد</dt><dd>{staffRial(item.fixedFeeRial)}</dd></div>
                <div><dt>خالص</dt><dd>{staffRial(item.netRial)}</dd></div>
                <div><dt>نسخه تعرفه</dt><dd>{item.feeVersion}</dd></div>
              </dl>
            </article>
          ))}
          <div className="seller-commerce__pager">
            <button type="button"
              disabled={settlementsPage === 1 || busyPath !== null}
              onClick={() => setSettlementsPage(page => Math.max(1, page - 1))}>
              صفحه قبل
            </button>
            <button type="button"
              disabled={settlements.kind !== "ready" ||
                settlements.items.length < 20 || busyPath !== null}
              onClick={() => setSettlementsPage(page => page + 1)}>
              صفحه بعد
            </button>
          </div>
        </section>
      )}

      <section id="seller-notifications" className="seller-commerce__section">
        <div className="seller-commerce__section-title">
          <h3>اعلان‌های داخلی</h3>
          <span>بدون ادعای ارسال پیامک</span>
        </div>
        {notifications.kind === "loading" &&
          <p className="form-status">در حال دریافت اعلان‌ها…</p>}
        {notifications.kind === "error" &&
          <p className="form-status form-status--error">
            {notifications.message}
          </p>}
        {notifications.kind === "ready" && notifications.items.length === 0 &&
          <p className="seller-commerce__empty">اعلان داخلی جدیدی نیست.</p>}
        {notifications.kind === "ready" && notifications.items.map(item => (
          <article className="seller-notification-card" key={item.id}>
            <div>
              <strong>{notificationLabel(item.code)}</strong>
              <p>{staffTime(item.createdAtUtc)}</p>
            </div>
            {item.read ? (
              <span className="seller-commerce__state">خوانده‌شده</span>
            ) : (
              <button type="button" className="seller-commerce__refresh"
                disabled={busyPath !== null}
                onClick={() => void markRead(item)}>
                {busyPath === `notifications/${item.id}/read`
                  ? "در حال ثبت…"
                  : uncertainPath === `notifications/${item.id}/read`
                    ? "تکرار امن"
                    : "علامت خوانده"}
              </button>
            )}
          </article>
        ))}
      </section>

      <section id="seller-support" className="seller-commerce__section">
        <div className="seller-commerce__section-title">
          <div>
            <h3>پشتیبانی</h3>
            <p>تیکت داخلی حنا؛ پیامک یا تماس بیرونی ثبت‌شده تلقی نمی‌شود.</p>
          </div>
        </div>
        <form className="seller-ticket-form" onSubmit={openTicket}>
          <label className="field">
            <span className="field__label">موضوع</span>
            <input className="field__input" maxLength={120}
              value={ticketSubject}
              disabled={ticketFrozen || busyPath !== null}
              onChange={event => setTicketSubject(event.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">متن درخواست</span>
            <textarea className="field__input support-incident__reason"
              maxLength={2000}
              value={ticketMessage}
              disabled={ticketFrozen || busyPath !== null}
              onChange={event => setTicketMessage(event.target.value)} />
          </label>
          <button type="submit" className="primary-button"
            disabled={busyPath !== null || !ticketSubject.trim() ||
              !ticketMessage.trim()}>
            {busyPath === "tickets"
              ? "در حال ثبت…"
              : ticketFrozen
                ? "تکرار امن همان تیکت"
                : "ثبت تیکت"}
          </button>
        </form>

        {tickets.kind === "loading" &&
          <p className="form-status">در حال دریافت تیکت‌ها…</p>}
        {tickets.kind === "error" &&
          <p className="form-status form-status--error">{tickets.message}</p>}
        {tickets.kind === "ready" && tickets.items.map(item => (
          <article className="seller-ticket-card" key={item.id}>
            <div className="seller-commerce__card-head">
              <div>
                <strong>{item.subject}</strong>
                <p>{staffTime(item.createdAtUtc)}</p>
              </div>
              <span className="seller-commerce__state">
                {item.state === "ANSWERED" ? "پاسخ داده شده" : "باز"}
              </span>
            </div>
            <p>{item.message}</p>
            {item.reply && (
              <div className="seller-ticket-card__reply">
                <strong>پاسخ پشتیبانی</strong>
                <p>{item.reply}</p>
              </div>
            )}
          </article>
        ))}
      </section>
    </section>
  );
}
