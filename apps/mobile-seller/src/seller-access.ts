import { safeApiBaseUrl } from "../../mobile-consumer/src/api-base.ts";
import type { TokenStore } from "../../mobile-consumer/src/mobile-auth.ts";

const tokenPattern = /^hn1_[A-Za-z0-9_-]{43}$/;
const trackingPattern = /^HNA-[0-9A-F]{16}$/;
export type SellerCapabilities = {
  dashboard: true;
  orders: boolean;
  listings: boolean;
  serviceListings: boolean;
  inventory: boolean;
  pricing: boolean;
  settlements: boolean;
  reports: boolean;
};
export type SellerIdentity = {
  trackingCode: string;
  storeName: string;
  businessName: string;
  offeringType: "GOOD" | "SERVICE" | "BOTH";
  activatedAtUtc: string;
  capabilities: SellerCapabilities;
};
export type SellerAccessResult =
  | { kind: "ready"; seller: SellerIdentity }
  | { kind: "guest" | "denied" | "unavailable" };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function name(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}

/** Reject incomplete/forged capability data rather than enabling a mobile view by default. */
export function parseSellerIdentity(value: unknown): SellerIdentity | null {
  const data = object(value);
  const capabilities = object(data?.capabilities);
  if (!data || !capabilities ||
      data.sellerAccess !== true || data.sellerPanelEnabled !== true ||
      typeof data.trackingCode !== "string" ||
      !trackingPattern.test(data.trackingCode) ||
      !name(data.storeName) || !name(data.businessName) ||
      !["GOOD", "SERVICE", "BOTH"].includes(String(data.offeringType)) ||
      typeof data.activatedAtUtc !== "string" ||
      !Number.isFinite(Date.parse(data.activatedAtUtc)) ||
      capabilities.dashboard !== true ||
      ["orders", "listings", "serviceListings", "inventory", "pricing", "settlements", "reports"]
        .some(key => typeof capabilities[key] !== "boolean")) return null;
  const commerce = capabilities.orders;
  const good = data.offeringType === "GOOD" || data.offeringType === "BOTH";
  const service = data.offeringType === "SERVICE" || data.offeringType === "BOTH";
  if (capabilities.listings !== commerce ||
      capabilities.pricing !== commerce ||
      capabilities.settlements !== commerce ||
      capabilities.reports !== commerce ||
      capabilities.inventory !== (commerce && good) ||
      capabilities.serviceListings !== (commerce && service)) return null;
  return {
    trackingCode: data.trackingCode,
    storeName: data.storeName.trim(),
    businessName: data.businessName.trim(),
    offeringType: data.offeringType as SellerIdentity["offeringType"],
    activatedAtUtc: data.activatedAtUtc,
    capabilities: capabilities as SellerCapabilities,
  };
}

export class SellerAccessClient {
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

  async load(): Promise<SellerAccessResult> {
    if (!this.base) return { kind: "unavailable" };
    let token: string | null;
    try { token = await this.store.read(); }
    catch { return { kind: "unavailable" }; }
    if (!token) return { kind: "guest" };
    if (!tokenPattern.test(token)) return { kind: "unavailable" };

    const target = this.base + "/api/v1/seller/access";
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
      if (response.status === 401) {
        // A previous request must never erase a newer token written during OTP.
        try {
          if (await this.store.read() !== token) return { kind: "unavailable" };
          await this.store.remove();
          return { kind: "guest" };
        } catch { return { kind: "unavailable" }; }
      }
      if (response.status === 403) return { kind: "denied" };
      if (response.status !== 200) return { kind: "unavailable" };
      const body = await response.text();
      if (body.length > 32768) return { kind: "unavailable" };
      const seller = parseSellerIdentity(JSON.parse(body) as unknown);
      return seller ? { kind: "ready", seller } : { kind: "unavailable" };
    } catch { return { kind: "unavailable" }; }
    finally { clearTimeout(timeout); }
  }
}
