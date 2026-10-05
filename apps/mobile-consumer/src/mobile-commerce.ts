import { safeApiBaseUrl } from "./api-base.ts";
import type { TokenStore } from "./mobile-auth.ts";
import { BuyerCommerceError, commerceId, commerceMessages, parseCommerce, parseOffers, type BuyerCart, type BuyerOrder, type BuyerOffer, type BuyerIncident, type BuyerIncidentOrder, type BuyerNotification, type BuyerTicket, type BuyerWallet, type BuyerWithdrawal } from "../../../packages/buyer-commerce/contracts.ts";

export type MobileCommerceIntent = Readonly<{ path: string; body: string; key: string }>;
function utf8Size(value: string) { let bytes = 0; for (const c of value) { const n = c.codePointAt(0)!; bytes += n <= 0x7f ? 1 : n <= 0x7ff ? 2 : n <= 0xffff ? 3 : 4; } return bytes; }
const reads: Record<string, string> = { cart: "/carts/current", comparison: "/carts/current/comparison", addresses: "/me/addresses", credits: "/me/credits", wallet: "/me/wallet", withdrawals:"/me/withdrawals", orders: "/orders", incidents:"/me/incidents", notifications:"/me/notifications", tickets:"/me/tickets" };
const writes: Record<string, string> = { "cart-items": "/carts/current/items", addresses: "/me/addresses", quotes: "/quotes", orders: "/orders", evidence:"/me/evidence", tickets:"/support/tickets", withdrawals:"/me/withdrawals" };
function target(path: string, method: "GET" | "POST") {
  const allowed = method === "GET" ? reads : writes;
  if (Object.prototype.hasOwnProperty.call(allowed, path)) return allowed[path];
  const parts = path.split("/");
  if (parts[0] === "orders" && commerceId(parts[1]) && (method === "GET" && parts.length === 2 || method === "POST" && parts.length === 3 && ["cancel", "pickup-confirmation", "incidents"].includes(parts[2]))) return "/orders/" + parts.slice(1).join("/");
  if(method==="GET"&&parts[0]==="incident-order"&&parts.length===2&&commerceId(parts[1]))return "/orders/"+parts[1];
  if(method==="POST"&&parts[0]==="item-returns"&&parts.length===3&&commerceId(parts[1])&&parts[2]==="confirm-collection")return "/item-returns/"+parts[1]+"/confirm-collection";
  if(method==="POST"&&parts[0]==="evidence"&&parts.length===3&&commerceId(parts[1])&&parts[2]==="discard")return "/me/evidence/"+parts[1]+"/discard";
  if(method==="POST"&&parts[0]==="notifications"&&parts.length===3&&commerceId(parts[1])&&parts[2]==="read")return "/me/notifications/"+parts[1]+"/read";
  if(method==="POST"&&parts[0]==="withdrawals"&&parts.length===3&&commerceId(parts[1])&&parts[2]==="cancel")return "/me/withdrawals/"+parts[1]+"/cancel";
  throw new BuyerCommerceError(404);
}
/** Supply an OS-generated UUID once; retain this frozen object after an ambiguous response. */
export function mobileCommerceIntent(path: string, input: object, key: string): MobileCommerceIntent {
  target(path, "POST");
  if (!commerceId(key) || !input || Array.isArray(input)) throw new BuyerCommerceError(400);
  const body = JSON.stringify(input);
  if (utf8Size(body) > 65536) throw new BuyerCommerceError(400);
  return Object.freeze({ path, body, key });
}

/** Native buyer transport. Never returns the SecureStore bearer to UI or logs. */
export class MobileCommerceClient {
  private readonly base: string | null;
  private readonly store: TokenStore;
  private readonly fetchFn: typeof fetch;
  constructor(apiBase: string | undefined, store: TokenStore, fetchFn: typeof fetch = fetch, allowLocalHttp = false) {
    this.base = safeApiBaseUrl(apiBase, allowLocalHttp); this.store = store; this.fetchFn = fetchFn;
  }
  private async send(path: string, upstream: string, method: "GET" | "POST", intent?: MobileCommerceIntent, page = 1, productId?: string): Promise<unknown> {
    if (!this.base) throw new BuyerCommerceError(503);
    let bearer: string | null = null;
    if (!productId) {
      try { bearer = await this.store.read(); } catch { throw new BuyerCommerceError(503); }
      if (!bearer) throw new BuyerCommerceError(401);
      if (!/^hn1_[A-Za-z0-9_-]{43}$/.test(bearer)) {
        try { await this.store.remove(); } catch { throw new BuyerCommerceError(503); }
        throw new BuyerCommerceError(401);
      }
    }
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const r = await this.fetchFn(this.base + "/api/v1" + upstream, { method, redirect: "error", credentials: "omit", cache: "no-store", signal: controller.signal,
        headers: { Accept: "application/json", ...(bearer ? { Authorization: "Bearer " + bearer } : {}), ...(intent ? { "Content-Type": "application/json", "Idempotency-Key": intent.key } : {}) }, ...(intent ? { body: intent.body } : {}) });
      // Native fetch can follow a redirect despite redirect:error. Reject the result too.
      if (r.redirected || r.url && r.url !== this.base + "/api/v1" + upstream) throw new BuyerCommerceError(503);
      if (r.status === 401 && !productId) {
        try { if (await this.store.read() === bearer) await this.store.remove(); } catch { throw new BuyerCommerceError(503); }
        throw new BuyerCommerceError(401);
      }
      const length = r.headers.get("content-length"); if (length && (!/^\d+$/.test(length) || Number(length) > 512000)) throw new BuyerCommerceError(503);
      const text = await r.text(); if (utf8Size(text) > (r.ok ? 512000 : 4096)) throw new BuyerCommerceError(503);
      let x: unknown; try { x = JSON.parse(text); } catch { throw new BuyerCommerceError(503); }
      if (!r.ok) {
        const code = x && typeof x === "object" && "error" in x && typeof x.error === "string" && Object.prototype.hasOwnProperty.call(commerceMessages, x.error) ? x.error : "";
        throw new BuyerCommerceError([400,403,404,409,429].includes(r.status) ? r.status : 503, code);
      }
      if (r.status !== 200 || !r.headers.get("content-type")?.includes("application/json")) throw new BuyerCommerceError(503);
      const result = productId ? parseOffers(x, productId) : parseCommerce(path, method, x, page);
      if (result === null) throw new BuyerCommerceError(503); return result;
    } catch (e) { if (e instanceof BuyerCommerceError) throw e; throw new BuyerCommerceError(503); }
    finally { clearTimeout(timeout); }
  }
  read<T>(path: string): Promise<T> { return this.send(path, target(path, "GET"), "GET") as Promise<T>; }
  cart(): Promise<BuyerCart> { return this.read("cart"); }
  order(id: string): Promise<BuyerOrder> { return this.read("orders/" + id); }
  orders(page = 1): Promise<BuyerOrder[]> {
    if (!Number.isInteger(page) || page < 1 || page > 10000) throw new BuyerCommerceError(400);
    return this.send("orders", "/orders?page=" + page, "GET", undefined, page) as Promise<BuyerOrder[]>;
  }
  incidentOrder(id:string):Promise<BuyerIncidentOrder>{return this.read("incident-order/"+id);}
  incidents(page=1):Promise<BuyerIncident[]>{if(!Number.isInteger(page)||page<1||page>10000)throw new BuyerCommerceError(400);return this.send("incidents","/me/incidents?page="+page,"GET",undefined,page) as Promise<BuyerIncident[]>;}
  notifications(page=1):Promise<BuyerNotification[]>{if(!Number.isInteger(page)||page<1||page>10000)throw new BuyerCommerceError(400);return this.send("notifications","/me/notifications?page="+page,"GET",undefined,page) as Promise<BuyerNotification[]>;}
  tickets(page=1):Promise<BuyerTicket[]>{if(!Number.isInteger(page)||page<1||page>10000)throw new BuyerCommerceError(400);return this.send("tickets","/me/tickets?page="+page,"GET",undefined,page) as Promise<BuyerTicket[]>;}
  wallet():Promise<BuyerWallet>{return this.read("wallet");}
  withdrawals(page=1):Promise<BuyerWithdrawal[]>{if(!Number.isInteger(page)||page<1||page>10000)throw new BuyerCommerceError(400);return this.send("withdrawals","/me/withdrawals?page="+page,"GET",undefined,page) as Promise<BuyerWithdrawal[]>;}
  offers(productId: string): Promise<BuyerOffer[]> {
    if (!commerceId(productId)) throw new BuyerCommerceError(400);
    return this.send("offers", "/offers?productId=" + productId + "&page=1", "GET", undefined, 1, productId) as Promise<BuyerOffer[]>;
  }
  post<T>(intent: MobileCommerceIntent): Promise<T> {
    // Validate again, including callers that bypass the frozen-intent constructor.
    const upstream = target(intent.path, "POST");
    if (!commerceId(intent.key) || typeof intent.body !== "string" || utf8Size(intent.body) > 65536) throw new BuyerCommerceError(400);
    try { const x: unknown = JSON.parse(intent.body); if (!x || typeof x !== "object" || Array.isArray(x)) throw Error(); } catch { throw new BuyerCommerceError(400); }
    return this.send(intent.path, upstream, "POST", intent) as Promise<T>;
  }
}
