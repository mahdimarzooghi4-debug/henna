"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BuyerCommerceError, buyerGet, buyerPost, commerceIntent, type BuyerCart, type CommerceIntent } from "../lib/buyer-commerce";
import { BuyerCommerceStatus } from "./buyer-commerce-status";
import { parseBuyerProduct } from "../lib/buyer-catalog";
export function BuyerCartView() {
  const [cart, setCart] = useState<BuyerCart | null>(null), [error, setError] = useState<Error | null>(null), [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""); const intent = useRef<CommerceIntent | null>(null), lock = useRef(false);
  const refresh = useCallback(async () => { setCart(null); setError(null); try { setCart(await buyerGet<BuyerCart>("cart")); } catch(e) { setError(e instanceof Error ? e : new BuyerCommerceError(503)); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!cart) return; const abort = new AbortController(); const ids = cart.items.map(i => i.productId);
    void Promise.all(ids.map(async id => { try { const r = await fetch("/api/catalog/products/" + id, { cache: "no-store", credentials: "omit", signal: abort.signal }); const p = r.ok ? parseBuyerProduct(await r.json(), id) : null; return [id, p?.name ?? "نام کالا در دسترس نیست"] as const; } catch { return [id, "نام کالا در دسترس نیست"] as const; } })).then(entries => { if (!abort.signal.aborted) setNames(Object.fromEntries(entries)); });
    return () => abort.abort();
  }, [cart]);
  async function change(productId?: string, quantity?: number) {
    if (lock.current || !cart) return; lock.current = true; setBusy(true); setMessage("");
    if (!intent.current && productId !== undefined) intent.current = commerceIntent(null, "cart-items", { productId, quantity, expectedVersion: cart.version });
    try { if (!intent.current) return; const next = await buyerPost<BuyerCart>(intent.current); intent.current = null; setCart(next); setMessage("سبد به‌روز شد."); }
    catch (e) { if (e instanceof BuyerCommerceError && e.status !== 503) { intent.current = null; if (e.status === 401) setError(e); if (e.code === "CART_VERSION_CHANGED") await refresh(); } setMessage(e instanceof Error ? e.message : "ثبت تغییر تأیید نشد؛ درخواست قبلی را دوباره بررسی کنید."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="commerce-main" dir="rtl" data-node-id="715:8">
    <p className="commerce-eyebrow">خرید از حنا</p><h1>سبد مرجع خرید</h1><p className="commerce-muted">کالاهای موردنیاز را برای مقایسهٔ پیشنهاد فروشندگان نگه دارید.</p>
    <p className="commerce-notice">سبد فقط کالا و تعداد درخواستی را نگه می‌دارد. قیمت و موجودی هنگام ثبت سفارش دوباره بررسی می‌شوند.</p>
    {error ? <BuyerCommerceStatus error={error} returnTo="/cart" retry={() => void refresh()}/> : !cart ? <p role="status">در حال دریافت سبد…</p> : <div className="commerce-cart-layout">
      <section className="commerce-card commerce-cart-items"><h2>اقلام سبد مرجع</h2>
        {cart.items.length === 0 && <p>سبد شما خالی است؛ از فهرست کالاها انتخاب کنید.</p>}
        {cart.items.map(i => <article className="commerce-item" key={i.productId}><h3><Link href={"/products/" + i.productId}>{names[i.productId] ?? "در حال دریافت نام کالا…"}</Link></h3><p>تعداد درخواستی: {new Intl.NumberFormat("fa-IR").format(i.quantity)} عدد</p><div className="commerce-quantity"><button aria-label="افزایش تعداد" disabled={busy || !!intent.current || i.quantity >= 999} onClick={() => void change(i.productId, i.quantity + 1)}>+</button><output>{new Intl.NumberFormat("fa-IR").format(i.quantity)}</output><button aria-label="کاهش تعداد" disabled={busy || !!intent.current} onClick={() => void change(i.productId, i.quantity - 1)}>−</button><button className="commerce-remove" disabled={busy || !!intent.current} onClick={() => void change(i.productId, 0)}>حذف از سبد</button></div></article>)}
        {message && <p role="status">{message}</p>}{intent.current && <button className="commerce-button" disabled={busy} onClick={() => void change()}>بررسی ثبت تغییر قبلی</button>}
        <Link href="/" className="commerce-button commerce-button--secondary">افزودن کالای دیگر</Link>
      </section><aside><section className="commerce-card"><h2>مبنای این سبد</h2><ul><li>کالا و تعداد از انتخاب شما</li><li>هر سفارش از یک فروشگاه</li><li>تصمیم درباره اقلام ناموجود با شماست</li><li>مقایسه قیمت پیش از خرید</li></ul></section>{cart.items.length > 0 && <Link href="/checkout" className="commerce-button">مقایسه فروشگاه‌ها و ادامه خرید</Link>}</aside>
    </div>}
  </main>;
}
