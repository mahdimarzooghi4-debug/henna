"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BuyerCommerceError, buyerGet, buyerPost, commerceIntent, rial, type BuyerCart, type BuyerOffer, type CommerceIntent } from "../lib/buyer-commerce";
export function BuyerProductPurchase({ productId }: { productId: string }) {
  const [offers, setOffers] = useState<BuyerOffer[] | null>(null), [error, setError] = useState<Error | null>(null), [retry, setRetry] = useState(0);
  const [quantity, setQuantity] = useState(1), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const pending = useRef<CommerceIntent | null>(null), lock = useRef(false);
  useEffect(() => {
    const abort = new AbortController(); setOffers(null); setError(null); pending.current = null; setMessage("");
    buyerGet<BuyerOffer[]>("offers?productId=" + productId, abort.signal).then(setOffers).catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e : new BuyerCommerceError(503)); });
    return () => abort.abort();
  }, [productId, retry]);
  async function add() {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage("");
    try {
      if (!pending.current) {
        const cart = await buyerGet<BuyerCart>("cart");
        const next = (cart.items.find(i => i.productId === productId)?.quantity ?? 0) + quantity;
        if (next > 999) { setMessage("تعداد هر کالا در سبد نمی‌تواند بیشتر از ۹۹۹ باشد."); return; }
        pending.current = commerceIntent(null, "cart-items", { productId, quantity: next, expectedVersion: cart.version });
      }
      await buyerPost<BuyerCart>(pending.current); pending.current = null; setMessage("کالا به سبد اضافه شد.");
    } catch (e) {
      if (e instanceof BuyerCommerceError && e.status !== 503) pending.current = null;
      setError(e instanceof Error ? e : new BuyerCommerceError(503));
    } finally { lock.current = false; setBusy(false); }
  }
  return <section className="commerce-card commerce-offers" aria-label="پیشنهادهای فروشندگان">
    <h2>پیشنهادهای فروشندگان</h2>
    {offers === null && !error && <p role="status">در حال دریافت پیشنهادها…</p>}
    {offers?.length === 0 && <p>در حال حاضر پیشنهادی برای این کالا منتشر نشده است.</p>}
    {offers?.map(o => <article className="commerce-item" key={o.id}><h3>{o.storeName}</h3><p>قیمت هر عدد: {rial(o.priceRial)}</p><p>موجودی اعلام‌شده: {new Intl.NumberFormat("fa-IR").format(o.stock)} عدد</p></article>)}
    <p className="commerce-muted">افزودن به سبد، موجودی را رزرو نمی‌کند. پیش از ثبت سفارش، قیمت و موجودی دوباره بررسی می‌شود.</p>
    {error && <div role="alert"><p>{error.message}</p>{error instanceof BuyerCommerceError && error.status === 401 ? <Link href="/auth?returnTo=%2Fcart" className="commerce-button">ورود و ادامه خرید</Link> : offers === null ? <button className="commerce-button" onClick={() => setRetry(n => n + 1)}>دریافت دوباره پیشنهادها</button> : null}</div>}
    {offers !== null && <div className="commerce-actions"><label>تعداد <input type="number" min={1} max={999} value={quantity} disabled={busy || pending.current !== null} onChange={e => setQuantity(Number(e.target.value))}/></label><button className="commerce-button" disabled={busy || !Number.isInteger(quantity) || quantity < 1 || quantity > 999} onClick={() => { setError(null); void add(); }}>{busy ? "در حال ثبت…" : pending.current ? "بررسی ثبت قبلی" : "افزودن به سبد"}</button></div>}
    {message && <p role="status">{message}</p>}
    <Link className="commerce-button commerce-button--secondary" href="/cart">مشاهده سبد خرید</Link>
  </section>;
}
