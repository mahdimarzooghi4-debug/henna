"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BuyerCommerceError, buyerGet, buyerPost, commerceId, commerceIntent, rial, type BuyerOrder, type CommerceIntent } from "../lib/buyer-commerce";
import { BuyerCommerceStatus } from "./buyer-commerce-status";
const stateText: Record<BuyerOrder["state"], string> = { PAID: "ثبت شده و پرداخت شده", PREPARING: "در حال آماده‌سازی", READY_FOR_PICKUP: "آماده دریافت حضوری", COLLECTED: "دریافت شده", CANCELLED: "لغو شده" };
export function BuyerOrders({ id }: { id?: string }) {
  const [orders, setOrders] = useState<BuyerOrder[] | null>(null), [error, setError] = useState<Error | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [received, setReceived] = useState(false); const intent = useRef<CommerceIntent | null>(null), lock = useRef(false);
  const load = useCallback(async () => { setOrders(null); setError(null); setReceived(false); if (id && !commerceId(id)) { setError(new BuyerCommerceError(404)); return; } try { setOrders(id ? [await buyerGet<BuyerOrder>("orders/" + id)] : await buyerGet<BuyerOrder[]>("orders")); } catch (e) { setError(e instanceof Error ? e : new BuyerCommerceError(503)); } }, [id]);
  useEffect(() => { void load(); }, [load]);
  async function change(action?: "cancel" | "pickup-confirmation") {
    if (lock.current || !id || !orders?.[0]) return; lock.current = true; setBusy(true); setMessage("");
    if (!intent.current) intent.current = commerceIntent(null, `orders/${id}/${action}`, { expectedVersion: orders[0].version });
    try { const result = await buyerPost<BuyerOrder>(intent.current); intent.current = null; setOrders([result]); setReceived(false); setMessage("وضعیت سفارش به‌روز شد."); }
    catch (e) { if (e instanceof BuyerCommerceError && e.status !== 503) { intent.current = null; if (e.status === 401) setError(e); if (e.code === "ORDER_VERSION_CHANGED") await load(); } setMessage(e instanceof Error ? e.message : "ثبت نتیجه تأیید نشد؛ همان درخواست را دوباره بررسی کنید."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="commerce-main" dir="rtl"><p className="commerce-eyebrow">خرید از حنا</p><h1>{id ? "سفارش شما" : "سفارش‌های من"}</h1>
    {error ? <BuyerCommerceStatus error={error} returnTo={id ? "/orders/" + id : "/orders"} retry={() => void load()}/> : !orders ? <p role="status">در حال دریافت سفارش…</p> : <>
      {orders.length === 0 && <section className="commerce-card"><p>سفارشی ثبت نشده است.</p></section>}
      {orders.map(o => <article className="commerce-card" key={o.id}><h2>{stateText[o.state]}</h2><p>تاریخ ثبت: {new Date(o.createdAtUtc).toLocaleString("fa-IR")}</p>{o.items.map(i => <p key={i.productId}>{i.productName ?? "قلم سفارش"} · تعداد: {new Intl.NumberFormat("fa-IR").format(i.quantity)} · {rial(i.unitPriceRial * i.quantity)}</p>)}<p>جمع: <strong>{rial(o.totalRial)}</strong></p><p>پرداخت نقدی: {rial(o.cashPaidRial)} · اعتبار حمایتی: {rial(o.creditPaidRial)}</p>{o.refundState !== "NONE" && <p>{o.refundState === "REFUNDED" ? "مبلغ سفارش به منشأ پرداخت برگشت داده شده است." : "بخشی از مبلغ سفارش به منشأ پرداخت برگشت داده شده است."}</p>}
        {!id ? <Link href={"/orders/" + o.id} className="commerce-button">جزئیات سفارش</Link> : <div className="commerce-actions">
          {!["COLLECTED", "CANCELLED"].includes(o.state) && <button className="commerce-button commerce-button--secondary" disabled={busy || !!intent.current} onClick={() => void change("cancel")}>لغو سفارش و بازگشت مبلغ</button>}
          {o.state === "READY_FOR_PICKUP" && <div><label><input type="checkbox" disabled={busy || !!intent.current} checked={received} onChange={e => setReceived(e.target.checked)}/>سفارش را از فروشگاه تحویل گرفته‌ام</label><button className="commerce-button" disabled={busy || !!intent.current || !received} onClick={() => void change("pickup-confirmation")}>تأیید دریافت حضوری</button></div>}
        </div>}
      </article>)}
      {message && <p role="status" className="commerce-notice">{message}</p>}{intent.current && <button className="commerce-button" disabled={busy} onClick={() => void change()}>بررسی نتیجه درخواست قبلی</button>}
      {!intent.current && <button className="commerce-button commerce-button--secondary" disabled={busy} onClick={() => void load()}>دریافت وضعیت تازه</button>}
    </>}
    <div className="commerce-actions"><Link className="commerce-button commerce-button--secondary" href="/cart">سبد خرید</Link>{id && <Link className="commerce-button commerce-button--secondary" href="/orders">سفارش‌های من</Link>}</div>
  </main>;
}
