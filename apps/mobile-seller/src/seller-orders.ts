import { safeApiBaseUrl } from "../../mobile-consumer/src/api-base.ts";
import type { TokenStore } from "../../mobile-consumer/src/mobile-auth.ts";
import {
  parseStaffCommerce, type StaffOrder,
} from "../../web-marketplace/lib/staff-commerce.ts";

const tokenPattern = /^hn1_[A-Za-z0-9_-]{43}$/;
export type SellerOrdersResult =
  | { kind: "ready"; items: StaffOrder[] }
  | { kind: "denied" | "unauthorized" | "unavailable" };

/** Read-only seller-scoped orders; the API, not mobile state, enforces ownership. */
export class SellerOrdersClient {
  private readonly base: string | null;
  private readonly store: TokenStore;
  private readonly fetchFn: typeof fetch;
  constructor(
    apiBase: string | undefined,
    store: TokenStore,
    fetchFn: typeof fetch = fetch,
    allowLocalHttp = false,
  ) {
    this.base = safeApiBaseUrl(apiBase, allowLocalHttp);
    this.store = store;
    this.fetchFn = fetchFn;
  }
  async load(page: number): Promise<SellerOrdersResult> {
    if (!this.base || !Number.isSafeInteger(page) || page < 1 || page > 10000)
      return { kind: "unavailable" };
    let token: string | null;
    try { token = await this.store.read(); }
    catch { return { kind: "unavailable" }; }
    if (!token || !tokenPattern.test(token)) return { kind: "unauthorized" };
    const target = this.base + "/api/v1/seller/orders?page=" + page;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await this.fetchFn(target, {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (response.redirected || (response.url && response.url !== target))
        return { kind: "unavailable" };
      if (response.status === 401) return { kind: "unauthorized" };
      if (response.status === 403) return { kind: "denied" };
      if (response.status !== 200) return { kind: "unavailable" };
      const text = await response.text();
      if (text.length > 524288) return { kind: "unavailable" };
      const data = parseStaffCommerce(
        "seller", "orders", "GET", JSON.parse(text) as unknown, page,
      );
      return Array.isArray(data)
        ? { kind: "ready", items: data as StaffOrder[] }
        : { kind: "unavailable" };
    } catch { return { kind: "unavailable" }; }
    finally { clearTimeout(timeout); }
  }
}
