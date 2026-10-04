"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BuyerCommerceError, buyerGet, buyerPost, commerceIntent, rial, type BuyerAddress, type BuyerCart, type BuyerComparison, type BuyerCredit, type BuyerOrder, type BuyerQuote, type CommerceIntent } from "../lib/buyer-commerce";
import { parseBuyerProduct, type BuyerProduct } from "../lib/buyer-catalog";
import { BuyerCommerceStatus } from "./buyer-commerce-status";
type Reference = { id: string; name: string };
type CheckoutData = { cart: BuyerCart; comparisons: BuyerComparison[]; addresses: BuyerAddress[]; credits: BuyerCredit[]; balanceRial: number };
export function BuyerCheckout() {
  const [data, setData] = useState<CheckoutData | null>(null), [error, setError] = useState<Error | null>(null);
  const [products, setProducts] = useState<Record<string, BuyerProduct>>({}), [seller, setSeller] = useState(""), [addressId, setAddressId] = useState(""), [purchaseType, setPurchaseType] = useState<"PERSONAL" | "LEGAL">("PERSONAL");
  const [quote, setQuote] = useState<BuyerQuote | null>(null), [creditId, setCreditId] = useState(""), [disposition, setDisposition] = useState(""), [confirmed, setConfirmed] = useState(false), [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""); const intent = useRef<CommerceIntent | null>(null), lock = useRef(false);
  const [provinces, setProvinces] = useState<Reference[]>([]), [cities, setCities] = useState<Reference[]>([]), [province, setProvince] = useState(""), [city, setCity] = useState(""), [addressText, setAddressText] = useState(""), [latitude, setLatitude] = useState(""), [longitude, setLongitude] = useState(""), [locationMessage, setLocationMessage] = useState("");
  const addressIdentity = useRef<string | null>(null);
  const load = useCallback(async () => {
    setData(null); setError(null); setQuote(null);
    try {
      const [cart, comparisons, addresses, credits, wallet] = await Promise.all([buyerGet<BuyerCart>("cart"), buyerGet<BuyerComparison[]>("comparison"), buyerGet<BuyerAddress[]>("addresses"), buyerGet<BuyerCredit[]>("credits"), buyerGet<{ balanceRial: number }>("wallet")]);
      setData({ cart, comparisons, addresses, credits, balanceRial: wallet.balanceRial }); setAddressId(addresses[0]?.id ?? "");
    } catch (e) { setError(e instanceof Error ? e : new BuyerCommerceError(503)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!data) return; const abort = new AbortController();
    void Promise.all(data.cart.items.map(async i => { try { const r = await fetch("/api/catalog/products/" + i.productId, { cache: "no-store", credentials: "omit", signal: abort.signal }); const p = r.ok ? parseBuyerProduct(await r.json(), i.productId) : null; return p; } catch { return null; } })).then(items => { if (!abort.signal.aborted) setProducts(Object.fromEntries(items.filter((p): p is BuyerProduct => p !== null).map(p => [p.id, p]))); });
    return () => abort.abort();
  }, [data]);
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/geography/provinces", { cache: "no-store", credentials: "omit", signal: abort.signal }).then(async r => { if (!r.ok) throw Error(); const x = await r.json(); if (!Array.isArray(x.items)) throw Error(); if (!abort.signal.aborted) setProvinces(x.items); }).catch(() => { if (!abort.signal.aborted) setLocationMessage("فهرست استان‌ها دریافت نشد؛ می‌توانید از نشانی ثبت‌شده استفاده کنید یا صفحه را دوباره دریافت کنید."); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    setCities([]); setCity(""); if (!province) return; const abort = new AbortController();
    void fetch("/api/geography/cities?provinceId=" + province, { cache: "no-store", credentials: "omit", signal: abort.signal }).then(async r => { if (!r.ok) throw Error(); const x = await r.json(); if (!Array.isArray(x.items)) throw Error(); if (!abort.signal.aborted) setCities(x.items); }).catch(() => { if (!abort.signal.aborted) setLocationMessage("فهرست شهرها دریافت نشد؛ استان را دوباره انتخاب کنید."); });
    return () => abort.abort();
  }, [province]);
  function resetQuote() { setQuote(null); setConfirmed(false); setDisposition(""); setMessage(""); }
  async function run(path: string, body: unknown, onSuccess: (x: unknown) => void) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage("");
    intent.current = commerceIntent(intent.current, path, body);
    try { const result = await buyerPost(intent.current); intent.current = null; onSuccess(result); }
    catch (e) {
      if (e instanceof BuyerCommerceError && e.status !== 503) intent.current = null;
      setMessage(e instanceof Error ? e.message : "ثبت درخواست تأیید نشد؛ همان درخواست را دوباره بررسی کنید.");
      if (e instanceof BuyerCommerceError && e.status === 401) setError(e);
    } finally { lock.current = false; setBusy(false); }
  }
  function locate() {
    if (!navigator.geolocation) { setLocationMessage("دریافت موقعیت در این مرورگر در دسترس نیست؛ مختصات را دستی وارد کنید."); return; }
    setLocationMessage("در حال دریافت موقعیت…"); navigator.geolocation.getCurrentPosition(p => { setLatitude(String(p.coords.latitude)); setLongitude(String(p.coords.longitude)); setLocationMessage("موقعیت دریافت شد؛ آن را همراه نشانی بررسی کنید."); }, () => setLocationMessage("موقعیت دریافت نشد؛ اجازه موقعیت را بررسی کنید یا مختصات را دستی وارد کنید."), { timeout: 10000, maximumAge: 0 });
  }
  function saveAddress() {
    addressIdentity.current ??= crypto.randomUUID();
    void run("addresses", { addressId: addressIdentity.current, cityId: city, text: addressText.trim(), latitude: Number(latitude), longitude: Number(longitude) }, x => {
      const a = x as BuyerAddress; setData(d => d ? { ...d, addresses: [a, ...d.addresses.filter(v => v.id !== a.id)] } : d); setAddressId(a.id); addressIdentity.current = null; resetQuote(); setMessage("نشانی ذخیره شد.");
    });
  }
  function receiveQuote(x: unknown) { const q = x as BuyerQuote; setQuote(q); setDisposition(q.unavailable.length ? "" : "KEEP"); setConfirmed(false); setNow(Date.now()); }
  function placeOrder() {
    if (!quote) return;
    void run("orders", { quoteId: quote.id, creditGrantId: creditId || null, unavailableDisposition: disposition, confirmUnavailable: confirmed }, x => window.location.assign("/orders/" + (x as BuyerOrder).id));
  }
  async function retryPending() {
    const pending = intent.current; if (!pending || lock.current) return;
    // Retain the exact body/key after an ambiguous response, even if the quote timer has expired.
    await run(pending.path, JSON.parse(pending.body), x => {
      if (pending.path === "orders") window.location.assign("/orders/" + (x as BuyerOrder).id);
      else if (pending.path === "quotes") receiveQuote(x);
      else { const a = x as BuyerAddress; setData(d => d ? { ...d, addresses: [a, ...d.addresses.filter(v => v.id !== a.id)] } : d); setAddressId(a.id); addressIdentity.current = null; resetQuote(); setMessage("نشانی ذخیره شد."); }
    });
  }
  const name = (id: string) => products[id]?.name ?? "نام کالا در دسترس نیست";
  const expirySeconds = quote ? Math.max(0, Math.ceil((Date.parse(quote.expiresAtUtc) - now) / 1000)) : 0;
  const eligibleCredits = data?.credits.filter(c => c.availableRial > 0 && Date.parse(c.expiresAtUtc) > now && quote && quote.items.every(i => products[i.productId] && c.categoryIds.includes(products[i.productId].categoryId))) ?? [];
  const selectedCredit = eligibleCredits.find(c => c.id === creditId);
  const creditAmount = quote && purchaseType === "PERSONAL" && selectedCredit ? Math.min(selectedCredit.availableRial, quote.itemsTotalRial) : 0;
  const cashAmount = quote ? quote.itemsTotalRial - creditAmount : 0;
  const locked = busy || intent.current !== null;
  const addressValid = city && addressText.trim() && latitude.trim() && longitude.trim() && Number.isFinite(Number(latitude)) && Number(latitude) >= -90 && Number(latitude) <= 90 && Number.isFinite(Number(longitude)) && Number(longitude) >= -180 && Number(longitude) <= 180;
  return <main className="commerce-main" dir="rtl" data-node-id="723:2"><p className="commerce-eyebrow">خرید از حنا</p><h1>مقایسهٔ پیشنهادهای فروشندگان</h1><p className="commerce-muted">برای خرید، یک فروشگاه و نشانی را انتخاب کنید.</p><p className="commerce-notice">هر سفارش از یک فروشگاه است. فعلاً فقط دریافت حضوری فعال است؛ مقایسه و پیش‌فاکتور، موجودی را رزرو نمی‌کنند.</p>
    {error ? <BuyerCommerceStatus error={error} returnTo="/checkout" retry={() => void load()}/> : !data ? <p role="status">در حال دریافت سبد و پیشنهادها…</p> : <>
      <div className="commerce-comparison-layout"><section className="commerce-card"><h2>اقلام سبد مرجع</h2>{data.cart.items.length === 0 ? <p>سبد شما خالی است.</p> : data.cart.items.map(i => <p key={i.productId}>{name(i.productId)} · تعداد: {new Intl.NumberFormat("fa-IR").format(i.quantity)}</p>)}</section><section className="commerce-card"><h2>قواعد خرید</h2><p>اقلام ناموجود فقط با تصمیم شما از سبد حذف می‌شوند.</p><p>اعتبار حمایتی برای خرید شخصی و دسته‌های مجاز قابل استفاده است.</p></section></div>
      {data.cart.items.length > 0 && data.comparisons.length === 0 && <section className="commerce-card"><h2>پیشنهاد قابل تأمین پیدا نشد</h2><p>در حال حاضر فروشگاهی با موجودی کافی برای اقلام سبد پیدا نشد؛ می‌توانید تعداد یا کالاها را تغییر دهید.</p></section>}
      {data.comparisons.map(c => <section className="commerce-card" key={c.sellerId}><h2>{c.storeName}</h2>{c.available.map(i => <article className="commerce-item" key={i.productId}><h3>{name(i.productId)}</h3><p>تعداد: {new Intl.NumberFormat("fa-IR").format(i.quantity)} · قیمت هر عدد: {rial(i.unitPriceRial)}</p></article>)}{c.unavailable.length > 0 && <p className="commerce-muted">ناموجود: {c.unavailable.map(i => name(i.productId)).join("، ")}</p>}<p>جمع اقلام موجود: <strong>{rial(c.itemsTotalRial)}</strong></p><button className="commerce-button" disabled={locked} aria-pressed={seller === c.sellerId} onClick={() => { setSeller(c.sellerId); resetQuote(); document.getElementById("checkout-options")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{seller === c.sellerId ? "فروشگاه انتخاب شده" : "انتخاب این فروشگاه"}</button></section>)}
      {data.comparisons.length > 0 && <section className="commerce-card" id="checkout-options"><h2>نشانی و نوع خرید</h2><label>نشانی ثبت‌شده<select value={addressId} disabled={locked} onChange={e => { setAddressId(e.target.value); resetQuote(); }}><option value="">نشانی را انتخاب کنید</option>{data.addresses.map(a => <option value={a.id} key={a.id}>{a.text}</option>)}</select></label>
        <details className="commerce-address"><summary>ثبت نشانی جدید</summary><div className="commerce-form-grid"><label>استان<select value={province} disabled={locked} onChange={e => setProvince(e.target.value)}><option value="">انتخاب استان</option>{provinces.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>شهر<select value={city} disabled={locked || !province} onChange={e => setCity(e.target.value)}><option value="">انتخاب شهر</option>{cities.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label></div><label>نشانی کامل<textarea maxLength={1000} value={addressText} disabled={locked} onChange={e => setAddressText(e.target.value)}/></label><button className="commerce-button commerce-button--secondary" disabled={locked} onClick={locate}>دریافت موقعیت فعلی</button><div className="commerce-form-grid"><label>عرض جغرافیایی<input dir="ltr" type="number" step="any" min={-90} max={90} value={latitude} disabled={locked} onChange={e => setLatitude(e.target.value)}/></label><label>طول جغرافیایی<input dir="ltr" type="number" step="any" min={-180} max={180} value={longitude} disabled={locked} onChange={e => setLongitude(e.target.value)}/></label></div>{locationMessage && <p role="status">{locationMessage}</p>}<button className="commerce-button" disabled={locked || !addressValid} onClick={saveAddress}>ذخیره نشانی</button></details>
        <label>نوع خرید<select value={purchaseType} disabled={locked} onChange={e => { setPurchaseType(e.target.value as "PERSONAL" | "LEGAL"); setCreditId(""); resetQuote(); }}><option value="PERSONAL">شخصی</option><option value="LEGAL">سازمانی / حقوقی</option></select></label><p>روش دریافت: حضوری از فروشگاه</p><button className="commerce-button" disabled={locked || !seller || !addressId} onClick={() => void run("quotes", { sellerId: seller, addressId, purchaseType, fulfillmentMode: "PICKUP" }, receiveQuote)}>دریافت پیش‌فاکتور</button>
      </section>}
      {quote && <section className="commerce-card commerce-quote"><h2>بازبینی و ثبت سفارش</h2>{quote.items.map(i => <p key={i.productId}>{name(i.productId)} · {new Intl.NumberFormat("fa-IR").format(i.quantity)} عدد · {rial(i.quantity * i.unitPriceRial)}</p>)}<p>جمع سفارش: <strong>{rial(quote.itemsTotalRial)}</strong></p><p role="status">{expirySeconds > 0 ? `اعتبار پیش‌فاکتور: ${new Intl.NumberFormat("fa-IR").format(expirySeconds)} ثانیه` : "پیش‌فاکتور منقضی شده؛ پیش‌فاکتور تازه بگیرید."}</p>
        {purchaseType === "PERSONAL" && <label>اعتبار حمایتی<select disabled={locked} value={creditId} onChange={e => setCreditId(e.target.value)}><option value="">بدون استفاده از اعتبار حمایتی</option>{eligibleCredits.map(c => <option value={c.id} key={c.id}>{rial(c.availableRial)} · تا {new Date(c.expiresAtUtc).toLocaleDateString("fa-IR")}</option>)}</select></label>}
        <p>سهم اعتبار: {rial(creditAmount)}</p><p>سهم نقدی: {rial(cashAmount)}</p><p>موجودی کیف پول نقدی: {rial(data.balanceRial)}</p>{cashAmount > data.balanceRial && <p role="alert">موجودی کافی نیست؛ پرداخت از درگاه هنوز فعال نشده است.</p>}
        {quote.unavailable.length > 0 && <fieldset disabled={locked}><legend>اقلام ناموجود</legend><p>{quote.unavailable.map(i => name(i.productId)).join("، ")}</p><label><input type="radio" name="unavailable" checked={disposition === "KEEP"} onChange={() => setDisposition("KEEP")}/>در سبد بمانند</label><label><input type="radio" name="unavailable" checked={disposition === "REMOVE"} onChange={() => setDisposition("REMOVE")}/>بعد از خرید از سبد حذف شوند</label><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>خرید فقط اقلام موجود را تأیید می‌کنم</label></fieldset>}
        <button className="commerce-button" disabled={locked || quote.used || expirySeconds === 0 || cashAmount > data.balanceRial || !disposition || quote.unavailable.length > 0 && !confirmed || !!creditId && !selectedCredit} onClick={placeOrder}>ثبت سفارش و کسر مبلغ</button>
      </section>}
      {message && <p className="commerce-notice" role="alert">{message}</p>}{intent.current && <section className="commerce-card"><p>نتیجه درخواست قبلی هنوز تأیید نشده است. برای جلوگیری از ثبت دوباره، همان درخواست را بررسی کنید.</p><button className="commerce-button" disabled={busy} onClick={() => void retryPending()}>بررسی نتیجه درخواست قبلی</button><Link href="/orders" className="commerce-button commerce-button--secondary">سفارش‌های من</Link></section>}
    </>}
    <Link href="/cart" className="commerce-button commerce-button--secondary">بازگشت به سبد مرجع</Link>
  </main>;
}
