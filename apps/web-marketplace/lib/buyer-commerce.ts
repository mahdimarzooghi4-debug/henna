/** The browser uses normalized buyer DTOs, never raw aggregate/account fields. */
export const commerceId = (x: unknown): x is string => typeof x === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
type Row = Record<string, unknown>;
const row = (x: unknown): Row => { if (!x || typeof x !== "object" || Array.isArray(x)) throw Error(); return x as Row; };
const id = (x: unknown): string => { if (!commerceId(x)) throw Error(); return x; };
const number = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => { if (typeof x !== "number" || !Number.isSafeInteger(x) || x < min || x > max) throw Error(); return x; };
const text = (x: unknown, max = 1000): string => { if (typeof x !== "string" || !x.trim() || x.length > max) throw Error(); return x; };
const time = (x: unknown): string => { const t = text(x, 50); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/.test(t) || !Number.isFinite(Date.parse(t))) throw Error(); return t; };
const list = <T>(x: unknown, parse: (v: unknown) => T, max = 500): T[] => { if (!Array.isArray(x) || x.length > max) throw Error(); return x.map(parse); };
const attempt = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
export type CartItem = { productId: string; quantity: number };
export type BuyerCart = { id: string | null; version: number; items: CartItem[] };
export type BuyerOffer = { id: string; sellerId: string; productId: string; priceRial: number; stock: number; version: number; storeName: string };
export type QuoteItem = { offerId: string; productId: string; quantity: number; unitPriceRial: number; offerVersion: number };
export type BuyerComparison = { sellerId: string; storeName: string; available: QuoteItem[]; unavailable: CartItem[]; itemsTotalRial: number };
export type BuyerAddress = { id: string; cityId: string; text: string; latitude: number; longitude: number };
export type BuyerCredit = { id: string; availableRial: number; expiresAtUtc: string; categoryIds: string[] };
export type BuyerQuote = { id: string; sellerId: string; purchaseType: "PERSONAL" | "LEGAL"; fulfillmentMode: "PICKUP"; items: QuoteItem[]; unavailable: CartItem[]; itemsTotalRial: number; expiresAtUtc: string; used: boolean };
export type BuyerOrder = { id: string; sellerId: string; state: "PAID" | "PREPARING" | "READY_FOR_PICKUP" | "COLLECTED" | "CANCELLED"; refundState: string; version: number; totalRial: number; cashPaidRial: number; creditPaidRial: number; createdAtUtc: string; items: { productId: string; productName: string | null; quantity: number; unitPriceRial: number }[] };
const item = (x: unknown): CartItem => { const r = row(x); return { productId: id(r.ProductId), quantity: number(r.Quantity, 1, 999) }; };
const quoteItem = (x: unknown): QuoteItem => { const r = row(x); return { offerId: id(r.OfferId), productId: id(r.ProductId), quantity: number(r.Quantity, 1, 999), unitPriceRial: number(r.UnitPriceRial, 1), offerVersion: number(r.OfferVersion, 1) }; };
const cart = (x: unknown): BuyerCart => { const r = row(x); return { id: id(r.Id), version: number(r.Version), items: list(r.Items, item, 100) }; };
const address = (x: unknown): BuyerAddress => {
  const r = row(x); if (typeof r.Latitude !== "number" || r.Latitude < -90 || r.Latitude > 90 || !Number.isFinite(r.Latitude) || typeof r.Longitude !== "number" || r.Longitude < -180 || r.Longitude > 180 || !Number.isFinite(r.Longitude)) throw Error();
  return { id: id(r.Id), cityId: id(r.CityId), text: text(r.Text), latitude: r.Latitude, longitude: r.Longitude };
};
const credit = (x: unknown): BuyerCredit => { const r = row(x); return { id: id(r.Id), availableRial: number(r.AvailableRial), expiresAtUtc: time(r.ExpiresAtUtc), categoryIds: list(r.CategoryIds, id, 100) }; };
const quote = (x: unknown): BuyerQuote => {
  const r = row(x); if ((r.PurchaseType !== "PERSONAL" && r.PurchaseType !== "LEGAL") || r.FulfillmentMode !== "PICKUP" || typeof r.Used !== "boolean") throw Error();
  const items = list(r.Items, quoteItem, 100); if (!items.length) throw Error();
  const total = number(r.ItemsTotalRial, 1); if (items.reduce((n, i) => n + i.unitPriceRial * i.quantity, 0) !== total) throw Error();
  return { id: id(r.Id), sellerId: id(r.SellerId), purchaseType: r.PurchaseType, fulfillmentMode: "PICKUP", items, unavailable: list(r.Unavailable, item, 100), itemsTotalRial: total, expiresAtUtc: time(r.ExpiresAtUtc), used: r.Used };
};
const order = (x: unknown): BuyerOrder => {
  const r = row(x); const states = ["PAID", "PREPARING", "READY_FOR_PICKUP", "COLLECTED", "CANCELLED"];
  if (typeof r.State !== "string" || !states.includes(r.State)) throw Error();
  const items = list(r.Items, v => { const p = row(v); return { productId: id(p.ProductId), productName: p.ProductName === null || p.ProductName === undefined ? null : text(p.ProductName, 200), quantity: number(p.Quantity, 1, 999), unitPriceRial: number(p.UnitPriceRial, 1) }; }, 100);
  const totalRial = number(r.TotalRial, 1), cashPaidRial = number(r.CashPaidRial), creditPaidRial = number(r.CreditPaidRial);
  if (!items.length || totalRial !== cashPaidRial + creditPaidRial || totalRial !== items.reduce((n, i) => n + i.unitPriceRial * i.quantity, 0)) throw Error();
  return { id: id(r.Id), sellerId: id(r.SellerId), state: r.State as BuyerOrder["state"], refundState: text(r.RefundState, 30), version: number(r.Version, 1), totalRial, cashPaidRial, creditPaidRial, createdAtUtc: time(r.CreatedAtUtc), items };
};
const page = <T>(x: unknown, parse: (x: unknown) => T): T[] => { const r = row(x); if (r.page !== 1 || r.pageSize !== 20) throw Error(); return list(r.items, parse, 20); };
export function parseOffers(x: unknown, productId: string): BuyerOffer[] | null {
  return attempt(() => page(x, v => { const r = row(v); if (r.published !== true || r.productId !== productId) throw Error(); return { id: id(r.id), sellerId: id(r.sellerId), productId: id(r.productId), priceRial: number(r.priceRial, 1), stock: number(r.stock, 0, 1000000), version: number(r.version, 1), storeName: text(r.storeName, 200) }; }));
}
export function parseCommerce(path: string, method: "GET" | "POST", x: unknown): unknown | null {
  return attempt(() => {
    if (path === "cart") {
      const carts = page(x, cart); if (carts.length > 1) throw Error(); return carts[0] ?? { id: null, version: 0, items: [] };
    }
    if (path === "cart-items") return cart(x);
    if (path === "comparison") return list(x, v => {
      const r = row(v), available = list(r.available, quoteItem, 100), total = number(r.itemsTotalRial, 1);
      if (!available.length || available.reduce((n, i) => n + i.quantity * i.unitPriceRial, 0) !== total) throw Error();
      return { sellerId: id(r.sellerId), storeName: text(r.storeName, 200), available, unavailable: list(r.unavailable, item, 100), itemsTotalRial: total };
    });
    if (path === "addresses") return method === "GET" ? page(x, address) : address(x);
    if (path === "credits") return page(x, credit);
    if (path === "wallet") { const wallets = page(x, v => number(row(v).BalanceRial)); if (wallets.length > 1) throw Error(); return { balanceRial: wallets[0] ?? 0 }; }
    if (path === "quotes") return quote(x);
    if (path === "orders") return method === "GET" ? page(x, order) : order(x);
    if (/^orders\//.test(path)) return order(x);
    throw Error();
  });
}
export const commerceMessages: Record<string, string> = {
  CART_VERSION_CHANGED: "سبد در صفحه دیگری تغییر کرده است؛ سبد را دوباره دریافت کنید.",
  PRODUCT_NOT_PUBLISHED: "این کالا دیگر برای خرید منتشر نشده است.",
  QUOTE_CHANGED: "قیمت یا موجودی تغییر کرده است؛ پیش‌فاکتور تازه بگیرید.",
  QUOTE_EXPIRED_OR_USED: "این پیش‌فاکتور منقضی شده یا قبلاً استفاده شده است.",
  PAYMENT_REQUIRED_PROVIDER_UNCONFIGURED: "موجودی قابل استفاده کافی نیست. پرداخت از درگاه هنوز فعال نشده است.",
  CREDIT_NOT_ELIGIBLE: "این اعتبار برای نوع خرید، دسته کالاها یا تاریخ فعلی قابل استفاده نیست.",
  PICKUP_COVERAGE_UNAVAILABLE: "دریافت حضوری این فروشگاه برای شهر نشانی شما فعال نیست.",
  PARTIAL_BASKET_CONFIRMATION_REQUIRED: "خرید اقلام موجود را با بررسی اقلام ناموجود تأیید کنید.",
  CANCEL_CUTOFF_PASSED: "پس از دریافت سفارش، لغو مستقیم امکان‌پذیر نیست.",
  ORDER_VERSION_CHANGED: "وضعیت سفارش تغییر کرده است؛ دوباره دریافت کنید.",
  COMMAND_RATE_LIMITED: "تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.",
};
export class BuyerCommerceError extends Error { status: number; code: string; constructor(status: number, code = "") { super(commerceMessages[code] ?? (status === 401 ? "برای ادامه وارد حساب خود شوید." : status === 403 ? "اجازه این عملیات را ندارید." : status === 404 ? "اطلاعات موردنظر پیدا نشد." : status === 400 ? "اطلاعات واردشده معتبر نیست." : "پاسخ سرور تأیید نشد؛ دوباره تلاش کنید.")); this.status = status; this.code = code; } }
export async function buyerGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  try {
    const r = await fetch("/api/buyer/commerce/" + path, { cache: "no-store", credentials: path.startsWith("offers?") ? "omit" : "same-origin", redirect: "error", signal, headers: { Accept: "application/json" } });
    if (!r.ok) { const x = await r.json().catch(() => ({})); throw new BuyerCommerceError(r.status, x.code); }
    if (!r.headers.get("content-type")?.includes("application/json")) throw new BuyerCommerceError(503);
    return await r.json() as T;
  } catch (e) { if (e instanceof BuyerCommerceError) throw e; throw new BuyerCommerceError(503); }
}
export type CommerceIntent = { path: string; body: string; key: string };
export function commerceIntent(previous: CommerceIntent | null, path: string, input: unknown): CommerceIntent {
  const body = JSON.stringify(input); return previous?.path === path && previous.body === body ? previous : { path, body, key: crypto.randomUUID() };
}
export async function buyerPost<T>(intent: CommerceIntent): Promise<T> {
  try {
    const r = await fetch("/api/buyer/commerce/" + intent.path, { method: "POST", body: intent.body, cache: "no-store", credentials: "same-origin", redirect: "error", headers: { "Content-Type": "application/json", "Idempotency-Key": intent.key } });
    const x: unknown = await r.json().catch(() => null);
    if (!r.ok) throw new BuyerCommerceError(r.status, x && typeof x === "object" && "code" in x ? String(x.code) : "");
    if (!x || !r.headers.get("content-type")?.includes("application/json")) throw new BuyerCommerceError(503);
    return x as T;
  } catch (e) { if (e instanceof BuyerCommerceError) throw e; throw new BuyerCommerceError(503); }
}
export const rial = (n: number) => new Intl.NumberFormat("fa-IR").format(n) + " ریال";
