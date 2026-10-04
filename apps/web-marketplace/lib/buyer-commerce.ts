import { BuyerCommerceError } from "../../../packages/buyer-commerce/contracts.ts";
export * from "../../../packages/buyer-commerce/contracts.ts";
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
