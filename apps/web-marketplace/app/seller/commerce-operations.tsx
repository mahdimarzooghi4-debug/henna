"use client";

import { useCallback, useEffect, useState } from "react";
import {
  StaffCommerceError,
  staffGet,
  staffIntent,
  staffPost,
  staffRial,
  staffTime,
  type StaffIncident,
  type StaffIntent,
  type StaffOrder,
} from "../../lib/staff-commerce";
import {
  clearSellerCommerceIntent,
  persistSellerCommerceIntent,
  restoreSellerCommerceIntent,
} from "../../lib/web-pending-staff-commerce";

type Load<T> =
  | { kind: "loading" }
  | { kind: "ready"; items: T[] }
  | { kind: "error"; message: string };

const orderStateLabel: Record<StaffOrder["state"], string> = {
  PAID: "پرداخت‌شده",
  PREPARING: "در حال آماده‌سازی",
  READY_FOR_PICKUP: "آماده دریافت حضوری",
  COLLECTED: "تحویل‌شده",
  CANCELLED: "لغوشده",
};

const incidentStateLabel: Record<StaffIncident["state"], string> = {
  UNDER_REVIEW: "در بررسی پشتیبانی",
  REJECTED: "ردشده",
  AWAITING_RETURN: "در انتظار جمع‌آوری مرجوعی",
  RESOLVED: "حل‌شده",
  COLLECTED: "مرجوعی دریافت‌شده",
  CUSTOMER_UNAVAILABLE_VERIFIED: "عدم حضور خریدار تأیید شده",
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "دریافت اطلاعات عملیاتی تأیید نشد.";
}

export function SellerCommerceOperations() {
  const [activated, setActivated] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [returnsPage, setReturnsPage] = useState(1);
  const [orders, setOrders] = useState<Load<StaffOrder>>({ kind: "loading" });
  const [returns, setReturns] =
    useState<Load<StaffIncident>>({ kind: "loading" });
  const [references, setReferences] =
    useState<Record<string, string>>({});
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [storageFailure, setStorageFailure] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<StaffIntent | null>(null);

  const loadOrders = useCallback(async (page: number, signal?: AbortSignal) => {
    setOrders({ kind: "loading" });
    try {
      const items = await staffGet<StaffOrder[]>(
        "seller", "orders?page=" + page, signal);
      setOrders({ kind: "ready", items });
    } catch (error) {
      if (!signal?.aborted)
        setOrders({ kind: "error", message: errorMessage(error) });
    }
  }, []);

  const loadReturns = useCallback(async (page: number, signal?: AbortSignal) => {
    setReturns({ kind: "loading" });
    try {
      const items = await staffGet<StaffIncident[]>(
        "seller", "returns?page=" + page, signal);
      setReturns({ kind: "ready", items });
    } catch (error) {
      if (!signal?.aborted)
        setReturns({ kind: "error", message: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    try {
      const restored = restoreSellerCommerceIntent();
      if (!restored) return;
      setPendingIntent(restored);
      const returned =
        /^returns\/([0-9a-f-]+)\/(contact|visit)$/i.exec(restored.path);
      if (returned) {
        const body = JSON.parse(restored.body) as { evidenceReference: string };
        setReferences({ [returned[1]]: body.evidenceReference });
      }
      setNotice(
        "یک درخواست قبلی نتیجه قطعی ندارد. همان کلید و بدنه برای تکرار امن بازیابی شد.");
      setActivated(true);
    } catch {
      setStorageFailure(
        "وضعیت retry امن فروشنده در این تب قابل اعتماد نیست. عملیات جدید برای جلوگیری از ارسال تکراری متوقف شد.");
    }
  }, []);

  useEffect(() => {
    if (!activated) return;
    const controller = new AbortController();
    void loadOrders(ordersPage, controller.signal);
    return () => controller.abort();
  }, [activated, loadOrders, ordersPage]);

  useEffect(() => {
    if (!activated) return;
    const controller = new AbortController();
    void loadReturns(returnsPage, controller.signal);
    return () => controller.abort();
  }, [activated, loadReturns, returnsPage]);

  const sendIntent = useCallback(async (
    intent: StaffIntent,
    successMessage: string,
  ) => {
    setBusyPath(intent.path);
    setNotice(null);
    try {
      await staffPost("seller", intent);
      if (!clearSellerCommerceIntent(intent.key)) {
        setStorageFailure(
          "پاسخ سرور دریافت شد، اما پاک‌سازی retry محلی تأیید نشد. عملیات جدید متوقف است.");
        return;
      }
      setPendingIntent(null);
      setNotice(successMessage);
      await Promise.all([
        loadOrders(ordersPage),
        loadReturns(returnsPage),
      ]);
    } catch (error) {
      if (error instanceof StaffCommerceError && error.status === 503) {
        setPendingIntent(intent);
        setNotice(
          "نتیجه این درخواست هنوز قطعی نیست. همان کلید و بدنه در همین تب حفظ شده‌اند و پس از reload نیز فقط همان درخواست قابل تکرار است.");
      } else {
        if (!clearSellerCommerceIntent(intent.key)) {
          setStorageFailure(
            "نتیجه سرور قطعی است، اما پاک‌سازی retry محلی تأیید نشد. عملیات جدید متوقف است.");
          return;
        }
        setPendingIntent(null);
        setNotice(errorMessage(error));
        if (error instanceof StaffCommerceError && error.status === 409)
          await Promise.all([
            loadOrders(ordersPage),
            loadReturns(returnsPage),
          ]);
      }
    } finally {
      setBusyPath(null);
    }
  }, [loadOrders, loadReturns, ordersPage, returnsPage]);

  const mutate = useCallback(async (
    path: string,
    body: unknown,
    successMessage: string,
  ) => {
    if (pendingIntent) return;
    const intent = staffIntent(null, path, body);
    try {
      persistSellerCommerceIntent(intent);
    } catch {
      setStorageFailure(
        "ذخیره retry امن فروشنده تأیید نشد؛ هیچ تغییری به سرور ارسال نشد.");
      return;
    }
    setPendingIntent(intent);
    await sendIntent(intent, successMessage);
  }, [pendingIntent, sendIntent]);

  if (storageFailure) {
    return (
      <section className="seller-commerce" aria-label="عملیات سفارش و مرجوعی">
        <p className="form-status form-status--error" role="alert">
          {storageFailure}
        </p>
      </section>
    );
  }

  if (!activated) {
    return (
      <section className="seller-commerce" aria-label="عملیات سفارش و مرجوعی">
        <div className="seller-commerce__heading">
          <div>
            <p className="seller-panel__eyebrow">عملیات واقعی فروشگاه</p>
            <h2>سفارش‌ها و مرجوعی‌ها</h2>
            <p>
              اطلاعات عملیاتی فقط با اقدام صریح شما از سرور حنا خوانده می‌شود.
            </p>
          </div>
          <button type="button" className="seller-commerce__refresh"
            onClick={() => setActivated(true)}>
            بارگیری عملیات
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="seller-commerce" aria-label="عملیات سفارش و مرجوعی">
      <div className="seller-commerce__heading">
        <div>
          <p className="seller-panel__eyebrow">عملیات واقعی فروشگاه</p>
          <h2>سفارش‌ها و مرجوعی‌ها</h2>
          <p>
            وضعیت‌ها از سرور حنا خوانده می‌شوند. تغییر وضعیت سفارش با نسخه فعلی
            و عملیات مرجوعی با درخواست idempotent ثبت می‌شود.
          </p>
        </div>
        <button type="button" className="seller-commerce__refresh"
          onClick={() => void Promise.all([
            loadOrders(ordersPage),
            loadReturns(returnsPage),
          ])}
          disabled={busyPath !== null || pendingIntent !== null}>
          تازه‌سازی
        </button>
      </div>

      {notice && <p className="form-status" role="status">{notice}</p>}
      {pendingIntent && (
        <button type="button" className="primary-button seller-commerce__action"
          disabled={busyPath !== null}
          onClick={() => void sendIntent(
            pendingIntent,
            "درخواست قبلی با همان کلید و بدنه با موفقیت تأیید شد.",
          )}>
          {busyPath === pendingIntent.path
            ? "در حال تکرار امن…"
            : "تکرار امن درخواست قبلی"}
        </button>
      )}

      <section id="seller-orders" className="seller-commerce__section">
        <div className="seller-commerce__section-title">
          <h3>سفارش‌های فروشگاه</h3>
          <span>صفحه {new Intl.NumberFormat("fa-IR").format(ordersPage)}</span>
        </div>
        {orders.kind === "loading" &&
          <p className="form-status" role="status">در حال دریافت سفارش‌ها…</p>}
        {orders.kind === "error" &&
          <p className="form-status form-status--error" role="alert">
            {orders.message}
          </p>}
        {orders.kind === "ready" && orders.items.length === 0 &&
          <p className="seller-commerce__empty">سفارشی در این صفحه نیست.</p>}
        {orders.kind === "ready" && orders.items.map(order => {
          const next = order.state === "PAID" ? "PREPARING" :
            order.state === "PREPARING" ? "READY_FOR_PICKUP" : null;
          const path = `orders/${order.id}/state`;
          return (
            <article className="seller-commerce__card" key={order.id}>
              <div className="seller-commerce__card-head">
                <div>
                  <strong>سفارش <bdi dir="ltr">{order.id.slice(0, 8)}</bdi></strong>
                  <p>{staffTime(order.createdAtUtc)}</p>
                </div>
                <span className="seller-commerce__state">
                  {orderStateLabel[order.state]}
                </span>
              </div>
              <dl className="seller-commerce__facts">
                <div><dt>نسخه سفارش</dt><dd>{order.version}</dd></div>
                <div><dt>مبلغ</dt><dd>{staffRial(order.totalRial)}</dd></div>
                <div><dt>بازپرداخت</dt><dd>{order.refundState}</dd></div>
              </dl>
              <ul className="seller-commerce__items">
                {order.items.map((item, index) => (
                  <li key={item.productId + index}>
                    <span>{item.productName ?? "کالای ثبت‌شده"}</span>
                    <span>
                      {new Intl.NumberFormat("fa-IR").format(item.quantity)} ×{" "}
                      {staffRial(item.unitPriceRial)}
                    </span>
                  </li>
                ))}
              </ul>
              {next && (
                <button type="button" className="primary-button seller-commerce__action"
                  disabled={busyPath !== null || pendingIntent !== null}
                  onClick={() => void mutate(path, {
                    expectedVersion: order.version,
                    state: next,
                  }, next === "PREPARING"
                    ? "وضعیت سفارش به «در حال آماده‌سازی» تغییر کرد."
                    : "سفارش برای دریافت حضوری آماده شد.")}>
                  {busyPath === path
                    ? "در حال ثبت…"
                    : next === "PREPARING"
                      ? "شروع آماده‌سازی"
                      : "اعلام آماده دریافت"}
                </button>
              )}
            </article>
          );
        })}
        <div className="seller-commerce__pager">
          <button type="button" disabled={ordersPage === 1 || busyPath !== null}
            onClick={() => setOrdersPage(page => Math.max(1, page - 1))}>
            صفحه قبل
          </button>
          <button type="button"
            disabled={orders.kind !== "ready" ||
              orders.items.length < 20 || busyPath !== null}
            onClick={() => setOrdersPage(page => page + 1)}>
            صفحه بعد
          </button>
        </div>
      </section>

      <section id="seller-returns" className="seller-commerce__section">
        <div className="seller-commerce__section-title">
          <h3>گزارش‌ها و مرجوعی‌های فروشگاه</h3>
          <span>صفحه {new Intl.NumberFormat("fa-IR").format(returnsPage)}</span>
        </div>
        {returns.kind === "loading" &&
          <p className="form-status" role="status">در حال دریافت مرجوعی‌ها…</p>}
        {returns.kind === "error" &&
          <p className="form-status form-status--error" role="alert">
            {returns.message}
          </p>}
        {returns.kind === "ready" && returns.items.length === 0 &&
          <p className="seller-commerce__empty">گزارشی در این صفحه نیست.</p>}
        {returns.kind === "ready" && returns.items.map(incident => {
          const contactPath = `returns/${incident.id}/contact`;
          const visitPath = `returns/${incident.id}/visit`;
          const reference = references[incident.id] ?? "";
          const frozen = pendingIntent !== null;
          return (
            <article className="seller-commerce__card" key={incident.id}>
              <div className="seller-commerce__card-head">
                <div>
                  <strong>
                    {incident.type === "DAMAGED_ITEM"
                      ? "آسیب‌دیدگی کالا"
                      : "کسری کالا"}
                  </strong>
                  <p>سفارش <bdi dir="ltr">{incident.orderId.slice(0, 8)}</bdi></p>
                </div>
                <span className="seller-commerce__state">
                  {incidentStateLabel[incident.state]}
                </span>
              </div>
              <dl className="seller-commerce__facts">
                <div><dt>تعداد</dt><dd>{incident.quantity}</dd></div>
                <div><dt>ثبت گزارش</dt><dd>{staffTime(incident.reportedAtUtc)}</dd></div>
                <div><dt>مهلت جمع‌آوری</dt><dd>{staffTime(incident.returnDueAtUtc)}</dd></div>
                <div><dt>تماس اول</dt><dd>{staffTime(incident.firstContactAtUtc)}</dd></div>
                <div><dt>مراجعه</dt><dd>{staffTime(incident.doorVisitAtUtc)}</dd></div>
              </dl>
              {incident.state === "AWAITING_RETURN" &&
                incident.doorVisitAtUtc === null && (
                <div className="seller-commerce__return-actions">
                  <label className="field">
                    <span className="field__label">
                      مرجع ثبت تماس/مراجعه
                    </span>
                    <input className="field__input"
                      value={reference}
                      maxLength={240}
                      disabled={frozen || busyPath !== null}
                      onChange={event => setReferences(current => ({
                        ...current,
                        [incident.id]: event.target.value,
                      }))}
                      placeholder="مثلاً شماره ثبت داخلی یا یادداشت قابل پیگیری" />
                  </label>
                  {incident.firstContactAtUtc === null ? (
                    <button type="button" className="primary-button"
                      disabled={!reference.trim() || busyPath !== null}
                      onClick={() => void mutate(contactPath, {
                        evidenceReference: reference.trim(),
                      }, "تماس اول مرجوعی ثبت شد.")}>
                      {busyPath === contactPath
                        ? "در حال ثبت…"
                        : "ثبت تماس اول"}
                    </button>
                  ) : (
                    <button type="button" className="primary-button"
                      disabled={!reference.trim() || busyPath !== null}
                      onClick={() => void mutate(visitPath, {
                        evidenceReference: reference.trim(),
                      }, "مراجعه حضوری مرجوعی ثبت شد.")}>
                      {busyPath === visitPath
                        ? "در حال ثبت…"
                        : "ثبت مراجعه حضوری"}
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
        <div className="seller-commerce__pager">
          <button type="button" disabled={returnsPage === 1 || busyPath !== null}
            onClick={() => setReturnsPage(page => Math.max(1, page - 1))}>
            صفحه قبل
          </button>
          <button type="button"
            disabled={returns.kind !== "ready" ||
              returns.items.length < 20 || busyPath !== null}
            onClick={() => setReturnsPage(page => page + 1)}>
            صفحه بعد
          </button>
        </div>
      </section>
    </section>
  );
}
