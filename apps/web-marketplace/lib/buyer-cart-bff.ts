import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "./server-auth";
import { parseCartOfferComparison } from "./buyer-cart";
export type BuyerCartItem = { productId: string; quantity: number; unitName: string; quantityScale: number };
export type BuyerCart = { revision: number; items: BuyerCartItem[] };
type Obj = Record<string, unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (x: unknown): x is Obj => x !== null && typeof x === "object" && !Array.isArray(x);
export const validBuyerCartId = (x: unknown): x is string => typeof x === "string" && uuid.test(x) && x !== "00000000-0000-0000-0000-000000000000";
export function cartError(status: number, message: string) { return NextResponse.json({ message }, { status, headers: noStore }); }
function parseCart(raw: unknown): BuyerCart | null {
  if (!object(raw) || !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 0 || !Array.isArray(raw.items) || raw.items.length > 100) return null;
  const items: BuyerCartItem[] = [], seen = new Set<string>();
  for (const item of raw.items) {
    if (!object(item) || Object.keys(item).sort().join("|") !== "productId|quantity|quantityScale|unitName" || !validBuyerCartId(item.productId) || typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1_000_000_000_000 || typeof item.unitName !== "string" || item.unitName.trim().length === 0 || item.unitName.length > 40 || !Number.isInteger(item.quantityScale) || (item.quantityScale as number) < 0 || (item.quantityScale as number) > 6 || seen.has(item.productId.toLowerCase())) return null;
    const factor = 10 ** (item.quantityScale as number);
    if (Math.abs(item.quantity * factor - Math.round(item.quantity * factor)) > 1e-7) return null;
    seen.add(item.productId.toLowerCase());
    items.push({ productId: item.productId, quantity: item.quantity, unitName: item.unitName, quantityScale: item.quantityScale as number });
  }
  return { revision: raw.revision as number, items };
}
export async function forwardBuyerCart(request: NextRequest, method: "GET" | "PUT" | "DELETE", productId?: string, body?: { revision: number; quantity?: number }) {
  if (method !== "GET" && !isSameOrigin(request)) return cartError(403, "درخواست نامعتبر است.");
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return cartError(401, "برای استفاده از سبد مرجع ابتدا وارد شوید.");
  const target = hanaAuthApiUrl("/api/v1/buyer/cart" + (productId ? "/items/" + productId : ""));
  if (!target) return cartError(503, "سبد مرجع فعلاً در دسترس نیست.");
  if (method === "DELETE") target.searchParams.set("revision", String(body!.revision));
  try {
    const upstream = await fetch(target, { method, headers: { Authorization: "Bearer " + token, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (upstream.status === 401) return cartError(401, "نشست معتبر نیست؛ دوباره وارد شوید.");
    if (upstream.status === 404) return cartError(404, "این کالای منتشرشده دیگر برای سبد قابل انتخاب نیست.");
    if (upstream.status === 409) return cartError(409, "سبد تغییر کرده است؛ دوباره دریافت کنید.");
    if (upstream.status === 400) return cartError(400, "مقدار یا نسخهٔ سبد معتبر نیست.");
    if (upstream.status !== 200 || !upstream.headers.get("content-type")?.includes("application/json") || Number(upstream.headers.get("content-length") ?? "0") > 128_000) return cartError(503, "تغییر سبد تأیید نشد.");
    const text = await upstream.text();
    if (text.length > 128_000) return cartError(503, "پاسخ سبد بیش از حد بزرگ است.");
    const cart = parseCart(JSON.parse(text) as unknown);
    return cart ? NextResponse.json(cart, { headers: noStore }) : cartError(503, "پاسخ سبد قابل تأیید نیست.");
  } catch { return cartError(503, "تغییر سبد تأیید نشد."); }
}

export async function forwardBuyerCartOffers(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return cartError(401, "برای مقایسهٔ پیشنهادها ابتدا وارد شوید.");
  const target = hanaAuthApiUrl("/api/v1/buyer/cart/offers");
  if (!target) return cartError(503, "مقایسهٔ پیشنهادها فعلاً در دسترس نیست.");
  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (upstream.status === 401) return cartError(401, "نشست معتبر نیست؛ دوباره وارد شوید.");
    if (upstream.status !== 200 || !upstream.headers.get("content-type")?.includes("application/json") || Number(upstream.headers.get("content-length") ?? "0") > 512_000) return cartError(503, "وضعیت پیشنهادها نامشخص است؛ دوباره تلاش کنید.");
    const text = await upstream.text();
    if (text.length > 512_000) return cartError(503, "پاسخ مقایسه بیش از حد بزرگ است.");
    const comparison = parseCartOfferComparison(JSON.parse(text) as unknown);
    return comparison ? NextResponse.json(comparison, { headers: noStore }) : cartError(503, "پاسخ مقایسه قابل تأیید نیست.");
  } catch { return cartError(503, "وضعیت پیشنهادها نامشخص است؛ دوباره تلاش کنید."); }
}
