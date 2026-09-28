"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseBuyerProduct, validBuyerProductId, type BuyerProduct } from "../lib/buyer-catalog";
import { parseReferenceCart, type ReferenceCart } from "../lib/buyer-cart";

type CartState = { status: "loading" | "signed-out" | "error" } | { status: "ready"; cart: ReferenceCart };
async function readCart(): Promise<ReferenceCart> {
  const response = await fetch("/api/buyer/cart", { cache: "no-store", credentials: "same-origin", redirect: "error", headers: { Accept: "application/json", "Cache-Control": "no-store" } });
  if (response.status === 401) throw Object.assign(new Error("signed-out"), { status: 401 });
  if (response.status !== 200) throw Error("unavailable");
  const cart = parseReferenceCart(await response.json() as unknown);
  if (!cart) throw Error("invalid");
  return cart;
}
function errorText(error: unknown) {
  return error && typeof error === "object" && "status" in error && error.status === 401
    ? "برای نگهداری سبد مرجع وارد حساب شوید." : "وضعیت سبد تأیید نشد؛ دوباره تلاش کنید.";
}

export function AddReferenceCartItem({ product, onAdded }: { product: BuyerProduct; onAdded?: () => void }) {
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (product.kind !== "GOOD" || !product.unitName || product.quantityScale == null) return null;
  const scale = product.quantityScale;
  const step = scale === 0 ? "1" : "0." + "0".repeat(scale - 1) + "1";
  const nudge = (direction: -1 | 1) => {
    const current = Number(quantity) || 0;
    setQuantity(String(Math.max(0, Math.round(current * 10 ** scale) + direction) / 10 ** scale));
  };
  async function save() {
    const parsed = Number(quantity);
    const factor = 10 ** scale;
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000_000_000 || Math.abs(parsed * factor - Math.round(parsed * factor)) > 1e-7) {
      setMessage("مقدار باید مثبت و مطابق دقت واحد کاتالوگ باشد."); return;
    }
    setBusy(true); setMessage("");
    try {
      const cart = await readCart();
      const response = await fetch("/api/buyer/cart/items/" + encodeURIComponent(product.id), {
        method: "PUT", cache: "no-store", credentials: "same-origin", redirect: "error",
        headers: { Accept: "application/json", "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ revision: cart.revision, quantity: parsed }),
      });
      if (response.status === 409) { setMessage("سبد تغییر کرده است؛ دوباره تلاش کنید."); return; }
      if (response.status === 401) { setMessage("برای نگهداری سبد مرجع وارد حساب شوید."); return; }
      if (response.status !== 200 || !parseReferenceCart(await response.json() as unknown)) throw Error();
      setMessage("مقدار در سبد مرجع ذخیره شد."); onAdded?.();
    } catch { setMessage("ثبت مقدار در سبد تأیید نشد؛ دوباره تلاش کنید."); }
    finally { setBusy(false); }
  }
  return <section className="buyer-cart-add" aria-label="افزودن به سبد مرجع">
    <h2>نگهداری در سبد مرجع</h2>
    <p>این فقط فهرست کالا و مقدار درخواستی شماست؛ قیمت، موجودی، رزرو یا سفارش ایجاد نمی‌شود.</p>
    <label htmlFor="reference-quantity">مقدار به {product.unitName}</label>
    <div className="buyer-cart-add__controls">
      <button type="button" aria-label="کاهش مقدار" disabled={busy} onClick={() => nudge(-1)}>−</button>
      <input id="reference-quantity" type="number" min="0" step={step} value={quantity}
        onChange={event => setQuantity(event.target.value)} inputMode="decimal" />
      <button type="button" aria-label="افزایش مقدار" disabled={busy} onClick={() => nudge(1)}>+</button>
      <button type="button" disabled={busy} onClick={() => void save()}>{busy ? "در حال ذخیره…" : "ذخیره در سبد مرجع"}</button>
    </div>
    {message && <p role="status">{message}</p>}
    <Link href="/buyer/cart">مشاهدهٔ سبد مرجع</Link>
  </section>;
}

type ProductView = { status: "loading" | "missing" | "unknown" } | { status: "ok"; product: BuyerProduct };
export function BuyerReferenceCartPage() {
  const [state, setState] = useState<CartState>({ status: "loading" });
  const [products, setProducts] = useState<Record<string, ProductView>>({});
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const reload = useCallback(() => {
    void (async () => {
      setState({ status: "loading" });
      try { setState({ status: "ready", cart: await readCart() }); }
      catch (error) { setState(error && typeof error === "object" && "status" in error && error.status === 401 ? { status: "signed-out" } : { status: "error" }); }
    })();
  }, [retry]);
  useEffect(() => { reload(); }, [reload]);
  const cart = state.status === "ready" ? state.cart : null;
  useEffect(() => {
    if (!cart) return;
    let active = true;
    for (const item of cart.items) {
      if (products[item.productId]) continue;
      void fetch("/api/catalog/products/" + encodeURIComponent(item.productId), { cache: "no-store", credentials: "omit", redirect: "error", headers: { Accept: "application/json", "Cache-Control": "no-store" } })
        .then(async response => {
          if (response.status === 404) return { status: "missing" } as const;
          if (response.status !== 200) return { status: "unknown" } as const;
          const product = parseBuyerProduct(await response.json() as unknown, item.productId);
          return product ? { status: "ok", product } as const : { status: "unknown" } as const;
        }).catch(() => ({ status: "unknown" } as const))
        .then(value => { if (active) setProducts(previous => ({ ...previous, [item.productId]: value })); });
    }
    return () => { active = false; };
  }, [cart, products]);

  async function remove(productId: string) {
    if (!cart) return;
    setBusyId(productId); setMessage("");
    try {
      const response = await fetch("/api/buyer/cart/items/" + encodeURIComponent(productId) + "?revision=" + cart.revision, {
        method: "DELETE", cache: "no-store", credentials: "same-origin", redirect: "error",
        headers: { Accept: "application/json", "Cache-Control": "no-store" },
      });
      if (response.status === 409) { setMessage("سبد تغییر کرده است؛ دوباره دریافتش کنید."); setRetry(n => n + 1); return; }
      if (response.status !== 200) throw Error();
      const next = parseReferenceCart(await response.json() as unknown); if (!next) throw Error();
      setState({ status: "ready", cart: next });
    } catch { setMessage("حذف کالا از سبد تأیید نشد."); }
    finally { setBusyId(""); }
  }
  async function saveQuantity(item: ReferenceCart["items"][number]) {
    if (!cart) return;
    const quantity = Number(quantityDrafts[item.productId] ?? item.quantity);
    const factor = 10 ** item.quantityScale;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000_000 || Math.abs(quantity * factor - Math.round(quantity * factor)) > 1e-7) {
      setMessage("مقدار باید مثبت و مطابق دقت واحد کاتالوگ باشد."); return;
    }
    setBusyId(item.productId); setMessage("");
    try {
      const response = await fetch("/api/buyer/cart/items/" + encodeURIComponent(item.productId), {
        method: "PUT", cache: "no-store", credentials: "same-origin", redirect: "error",
        headers: { Accept: "application/json", "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ revision: cart.revision, quantity }),
      });
      if (response.status === 409) { setMessage("سبد تغییر کرده است؛ دوباره دریافتش کنید."); setRetry(n => n + 1); return; }
      if (response.status !== 200) throw Error();
      const next = parseReferenceCart(await response.json() as unknown); if (!next) throw Error();
      setState({ status: "ready", cart: next });
      setQuantityDrafts(previous => ({ ...previous, [item.productId]: String(quantity) }));
      setMessage("مقدار سبد به‌روز شد.");
    } catch { setMessage("تغییر مقدار سبد تأیید نشد."); }
    finally { setBusyId(""); }
  }

  return <main dir="rtl" className="buyer-cart-page">
    <p className="buyer-cart-eyebrow">سبد مرجع خریدار</p><h1>سبد مرجع</h1>
    <p className="buyer-cart-intro">کالاها و مقدارهای درخواستی را برای مقایسهٔ بعدی نگه دارید.</p>
    <div className="buyer-cart-note">این سبد فقط فهرست کالا و مقدار است؛ قیمت قطعی، پوشش و موجودی پس از دریافت پیشنهاد معتبر و بازبینی خریدار مشخص می‌شود. هنوز سفارش یا رزروی ساخته نمی‌شود.</div>
    {state.status === "loading" ? <p role="status">در حال دریافت سبد…</p> :
      state.status === "signed-out" ? <div className="buyer-cart-panel"><h2>ورود به حساب لازم است</h2><p>سبد مرجع به حساب شما متصل است.</p><Link href="/auth">ورود / ثبت‌نام</Link></div> :
      state.status === "error" ? <div className="buyer-cart-panel" role="alert"><p>وضعیت سبد نامشخص است؛ اطلاعات قبلی را خالی فرض نمی‌کنیم.</p><button onClick={() => setRetry(n => n + 1)}>تلاش دوباره</button></div> :
      cart?.items.length === 0 ? <div className="buyer-cart-panel"><h2>سبد مرجع خالی است</h2><p>از کالاهای منتشرشده، مقدار موردنیازتان را نگه دارید.</p><Link href="/">رفتن به فهرست کالاها</Link></div> :
      <section className="buyer-cart-panel" aria-labelledby="buyer-cart-items-title">
        <h2 id="buyer-cart-items-title">اقلام سبد مرجع</h2>
        <ul className="buyer-cart-list">{cart?.items.map(item => {
          const product = products[item.productId];
          const title = product?.status === "ok" ? product.product.name : product?.status === "missing" ? "این کالا دیگر در کاتالوگ منتشرشده نیست" : "نام کالا از کاتالوگ هنوز تأیید نشده";
          return <li className="buyer-cart-item" key={item.productId}>
            <div><h3>{title}</h3><p>{item.quantity} {item.unitName} · مقدار درخواستی</p>
              <div className="buyer-cart-quantity">
                <label htmlFor={"quantity-" + item.productId}>مقدار به {item.unitName}</label>
                <input id={"quantity-" + item.productId} type="number" min="0"
                  step={item.quantityScale === 0 ? "1" : "0." + "0".repeat(item.quantityScale - 1) + "1"}
                  value={quantityDrafts[item.productId] ?? String(item.quantity)}
                  onChange={event => setQuantityDrafts(previous => ({ ...previous, [item.productId]: event.target.value }))} />
                <button type="button" disabled={busyId === item.productId} onClick={() => void saveQuantity(item)}>ذخیره مقدار</button>
              </div>
              {product?.status === "unknown" && <p>وضعیت کاتالوگ نامشخص است؛ کالا را فقط در صورت تمایل حذف کنید.</p>}
              {product?.status === "missing" && <p>کالا حذف خودکار نمی‌شود.</p>}
            </div>
            <button type="button" disabled={busyId === item.productId} onClick={() => void remove(item.productId)}>{busyId === item.productId ? "در حال حذف…" : "حذف از سبد"}</button>
          </li>;
        })}</ul>
      </section>}
    {message && <p role="status">{message}</p>}
    <p className="buyer-cart-later">هر سفارش آینده فقط به یک فروشنده وابسته خواهد بود؛ اقلام تأمین‌نشده با انتخاب شما نگه داشته یا حذف می‌شوند.</p>
    <Link className="buyer-cart-back" href="/">بازگشت به فهرست کالاها</Link>
  </main>;
}
