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
export type BuyerServiceListing = { id: string; sellerId: string; productId: string; priceRial: number; availabilityNote: string; version: number; storeName: string };
export type QuoteItem = { offerId: string; productId: string; quantity: number; unitPriceRial: number; offerVersion: number };
export type BuyerComparison = { sellerId: string; storeName: string; available: QuoteItem[]; unavailable: CartItem[]; itemsTotalRial: number };
export type BuyerAddress = { id: string; cityId: string; text: string; latitude: number; longitude: number };
export type BuyerCredit = { id: string; availableRial: number; expiresAtUtc: string; categoryIds: string[] };
export type BuyerQuote = { id: string; sellerId: string; purchaseType: "PERSONAL" | "LEGAL"; fulfillmentMode: "PICKUP"; items: QuoteItem[]; unavailable: CartItem[]; itemsTotalRial: number; expiresAtUtc: string; used: boolean };
export type BuyerOrder = { id: string; sellerId: string; state: "PAID" | "PREPARING" | "READY_FOR_PICKUP" | "COLLECTED" | "CANCELLED"; refundState: string; version: number; totalRial: number; cashPaidRial: number; creditPaidRial: number; createdAtUtc: string; items: { productId: string; productName: string | null; quantity: number; unitPriceRial: number }[] };
export type BuyerIncidentOrder = BuyerOrder & {receivedAtUtc:string|null;incidentItems:{id:string;productId:string;productName:string|null;quantity:number;refundedQuantity:number}[]};
export type BuyerIncident = {id:string;orderId:string;orderItemId:string;type:"DAMAGED_ITEM"|"MISSING_ITEM";quantity:number;state:"UNDER_REVIEW"|"REJECTED"|"AWAITING_RETURN"|"RESOLVED"|"COLLECTED"|"CUSTOMER_UNAVAILABLE_VERIFIED";reportedAtUtc:string;returnDueAtUtc:string|null;collectedAtUtc:string|null;refundRial:number};
export type BuyerEvidence = {evidenceId:string;sha256:string;contentType:string;size:number};
export type BuyerNotification = {
  id:string; code:string; resourceId:string; createdAtUtc:string; read:boolean;
};
export type BuyerTicket = {
  id:string; subject:string; message:string; state:"OPEN"|"ANSWERED";
  createdAtUtc:string; reply:string|null;
};
export type BuyerWallet = { balanceRial:number };
export type BuyerWithdrawal = {
  id:string;
  amountRial:number;
  state:"OWNERSHIP_VERIFICATION_PENDING"|"CANCELLED";
  requestedAtUtc:string;
  dueAtUtc:string;
  slaEscalated:boolean;
};
const incident = (x:unknown):BuyerIncident=>{const r=row(x);if(!["DAMAGED_ITEM","MISSING_ITEM"].includes(r.Type as string)||!["UNDER_REVIEW","REJECTED","AWAITING_RETURN","RESOLVED","COLLECTED","CUSTOMER_UNAVAILABLE_VERIFIED"].includes(r.State as string))throw Error();return {id:id(r.Id),orderId:id(r.OrderId),orderItemId:id(r.OrderItemId),type:r.Type as BuyerIncident["type"],quantity:number(r.Quantity,1,999),state:r.State as BuyerIncident["state"],reportedAtUtc:time(r.ReportedAtUtc),returnDueAtUtc:r.ReturnDueAtUtc===null?null:time(r.ReturnDueAtUtc),collectedAtUtc:r.CollectedAtUtc===null?null:time(r.CollectedAtUtc),refundRial:number(r.RefundRial)};};
const notification=(x:unknown):BuyerNotification=>{const r=row(x);if(typeof r.Read!=="boolean")throw Error();return{id:id(r.Id),code:text(r.Code,80),resourceId:id(r.ResourceId),createdAtUtc:time(r.CreatedAtUtc),read:r.Read};};
const ticket=(x:unknown):BuyerTicket=>{const r=row(x);if(!["OPEN","ANSWERED"].includes(String(r.State)))throw Error();return{id:id(r.Id),subject:text(r.Subject,120),message:text(r.Message,2000),state:r.State as BuyerTicket["state"],createdAtUtc:time(r.CreatedAtUtc),reply:r.Reply===null?null:text(r.Reply,2000)};};
const withdrawal=(x:unknown):BuyerWithdrawal=>{const r=row(x);if(!["OWNERSHIP_VERIFICATION_PENDING","CANCELLED"].includes(String(r.State))||typeof r.SlaEscalated!=="boolean")throw Error();return{id:id(r.Id),amountRial:number(r.AmountRial,1),state:r.State as BuyerWithdrawal["state"],requestedAtUtc:time(r.RequestedAtUtc),dueAtUtc:time(r.DueAtUtc),slaEscalated:r.SlaEscalated};};
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
const page = <T>(x: unknown, parse: (x: unknown) => T, expectedPage = 1): T[] => { const r = row(x); if (!Number.isInteger(expectedPage) || expectedPage < 1 || expectedPage > 10000 || r.page !== expectedPage || r.pageSize !== 20) throw Error(); return list(r.items, parse, 20); };
export function parseOffers(x: unknown, productId: string): BuyerOffer[] | null {
  return attempt(() => page(x, v => { const r = row(v); if (r.published !== true || r.productId !== productId) throw Error(); return { id: id(r.id), sellerId: id(r.sellerId), productId: id(r.productId), priceRial: number(r.priceRial, 1), stock: number(r.stock, 0, 1000000), version: number(r.version, 1), storeName: text(r.storeName, 200) }; }));
}
export function parseServiceListings(x: unknown, productId: string): BuyerServiceListing[] | null {
  return attempt(() => page(x, v => { const r = row(v); if (r.published !== true || r.productId !== productId) throw Error(); return { id: id(r.id), sellerId: id(r.sellerId), productId: id(r.productId), priceRial: number(r.priceRial, 1), availabilityNote: text(r.availabilityNote, 500), version: number(r.version, 1), storeName: text(r.storeName, 200) }; }));
}
export function parseCommerce(path: string, method: "GET" | "POST", x: unknown, expectedPage = 1): unknown | null {
  return attempt(() => {
    if (/^incident-order\//.test(path)) {const r=row(x),parsed=order(x);return {...parsed,receivedAtUtc:r.ReceivedAtUtc===null?null:time(r.ReceivedAtUtc),incidentItems:list(r.Items,v=>{const p=row(v);return{id:id(p.Id),productId:id(p.ProductId),productName:p.ProductName===null||p.ProductName===undefined?null:text(p.ProductName,200),quantity:number(p.Quantity,1,999),refundedQuantity:number(p.RefundedQuantity,0,number(p.Quantity,1,999))};},100)};}
    if (path === "incidents") return page(x,incident,expectedPage);
    if (path === "notifications")
      return page(x,notification,expectedPage);
    if (path === "tickets")
      return method === "GET" ? page(x,ticket,expectedPage) : ticket(x);
    if (/^notifications\/[^/]+\/read$/.test(path)) return notification(x);
    if (/^orders\/[^/]+\/incidents$/.test(path)||/^item-returns\/[^/]+\/confirm-collection$/.test(path)) return incident(x);
    if (path === "evidence") {const r=row(x);if(typeof r.sha256!=="string"||!/^[0-9a-f]{64}$/i.test(r.sha256)||!["image/png","image/jpeg","image/webp"].includes(r.contentType as string))throw Error();return{evidenceId:id(r.evidenceId),sha256:r.sha256,contentType:r.contentType,size:number(r.size,12,40000)};}
    if (/^evidence\/[^/]+\/discard$/.test(path)) {const r=row(x);if(r.deleted!==true)throw Error();return{evidenceId:id(r.evidenceId),deleted:true};}
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
    if (path === "withdrawals")
      return method === "GET" ? page(x,withdrawal,expectedPage) : withdrawal(x);
    if (/^withdrawals\/[^/]+\/cancel$/.test(path)) return withdrawal(x);
    if (path === "quotes") return quote(x);
    if (path === "orders") return method === "GET" ? page(x, order, expectedPage) : order(x);
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
  INCIDENT_WINDOW_EXPIRED: "مهلت یک‌ساعته گزارش مشکل پس از دریافت سفارش تمام شده است.",
  EVIDENCE_IN_USE: "این مدرک به یک گزارش ثبت‌شده متصل است و حذف نمی‌شود.",
  INCIDENT_QUANTITY_EXCEEDED: "تعداد گزارش از مقدار قابل بررسی بیشتر است؛ وضعیت تازه را دریافت کنید.",
  RETURN_STATE_INVALID: "این مرجوعی اکنون قابل تأیید نیست؛ وضعیت تازه را دریافت کنید.",
  ORDER_TRANSITION_INVALID: "این تغییر در وضعیت فعلی سفارش ممکن نیست.",
  WALLET_FUNDS_INSUFFICIENT: "موجودی کیف پول برای این برداشت کافی نیست.",
  WITHDRAWAL_STATE_INVALID: "این درخواست برداشت دیگر قابل لغو نیست.",
  COMMAND_RATE_LIMITED: "تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.",
};
export class BuyerCommerceError extends Error { status: number; code: string; constructor(status: number, code = "") { super((Object.prototype.hasOwnProperty.call(commerceMessages, code) ? commerceMessages[code] : undefined) ?? (status === 401 ? "برای ادامه وارد حساب خود شوید." : status === 403 ? "اجازه این عملیات را ندارید." : status === 404 ? "اطلاعات موردنظر پیدا نشد." : status === 400 ? "اطلاعات واردشده معتبر نیست." : "پاسخ سرور تأیید نشد؛ دوباره تلاش کنید.")); this.status = status; this.code = code; } }
