import { NextRequest, NextResponse } from "next/server.js";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "./server-auth.ts";
import { parseCartOfferComparison, parsePurchaseDraft, type PurchaseDraft } from "./buyer-cart.ts";
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

const idempotencyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validDraftMutation(raw: unknown, method: "PUT" | "DELETE"): raw is Obj {
  if (!object(raw)) return false;
  if (method === "DELETE") return Object.keys(raw).sort().join("|") === "revision" &&
    Number.isSafeInteger(raw.revision) && (raw.revision as number) >= 0;
  if (Object.keys(raw).sort().join("|") !== "cartRevision|confirmCurrentPriceChanges|lines|revision|sellerPublicId" ||
      typeof raw.confirmCurrentPriceChanges !== "boolean" ||
      !validBuyerCartId(raw.sellerPublicId) || !Number.isSafeInteger(raw.revision) ||
      (raw.revision as number) < 0 || !Number.isSafeInteger(raw.cartRevision) ||
      (raw.cartRevision as number) < 0 || !Array.isArray(raw.lines) ||
      raw.lines.length < 1 || raw.lines.length > 100) return false;
  const products = new Set<string>(), offers = new Set<string>();
  for (const line of raw.lines) {
    if (!object(line) || Object.keys(line).sort().join("|") !== "expectedPriceRials|offerId|productId" ||
        !validBuyerCartId(line.productId) || !validBuyerCartId(line.offerId) ||
        !Number.isSafeInteger(line.expectedPriceRials) || (line.expectedPriceRials as number) <= 0 ||
        products.has((line.productId as string).toLowerCase()) || offers.has((line.offerId as string).toLowerCase())) return false;
    products.add((line.productId as string).toLowerCase()); offers.add((line.offerId as string).toLowerCase());
  }
  return true;
}

/** Same-origin BFF for editable buyer selection drafts; browser tokens never pass through. */
export async function handleBuyerPurchaseDraft(request: NextRequest) {
  const method = request.method;
  if (method !== "GET" && method !== "PUT" && method !== "DELETE")
    return cartError(405, "روش درخواست پشتیبانی نمی‌شود.");
  if ([...request.nextUrl.searchParams.keys()].length)
    return cartError(400, "پارامترهای درخواست معتبر نیست.");
  if (method !== "GET" && !isSameOrigin(request)) return cartError(403, "درخواست نامعتبر است.");
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return cartError(401, "برای استفاده از پیش‌نویس ابتدا وارد شوید.");
  let body: unknown;
  if (method !== "GET") {
    const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "application/json") return cartError(400, "نوع محتوای درخواست معتبر نیست.");
    const key = request.headers.get("Idempotency-Key") ?? "";
    if (!idempotencyUuid.test(key) || key === "00000000-0000-0000-0000-000000000000") return cartError(400, "کلید یکتای درخواست معتبر نیست.");
    try {
      const raw = await request.text();
      if (raw.length > 24_000) return cartError(400, "درخواست بیش از حد بزرگ است.");
      body = JSON.parse(raw) as unknown;
    } catch { return cartError(400, "بدنهٔ درخواست معتبر نیست."); }
    if (!validDraftMutation(body, method)) return cartError(400, "بدنهٔ درخواست معتبر نیست.");
  }
  const target = hanaAuthApiUrl("/api/v1/buyer/cart/purchase-draft");
  if (!target) return cartError(503, "پیش‌نویس خرید فعلاً در دسترس نیست.");
  try {
    const headers: Record<string, string> = { Authorization: "Bearer " + token, Accept: "application/json" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Idempotency-Key"] = request.headers.get("Idempotency-Key")!;
    }
    const upstream = await fetch(target, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    if (upstream.status === 401) return cartError(401, "نشست معتبر نیست؛ دوباره وارد شوید.");
    if (upstream.status === 400) return cartError(400, "اطلاعات پیش‌نویس معتبر نیست.");
    if (upstream.status === 409) {
      let code = "REVISION_CONFLICT";
      try {
        const conflict = await upstream.json() as unknown;
        if (object(conflict) && ["CART_CHANGED", "OFFER_UNAVAILABLE", "PRICE_CHANGED", "PRICE_CONFIRMATION_REQUIRED", "REVISION_CONFLICT", "IDEMPOTENCY_KEY_REUSED"].includes(String(conflict.code))) code = String(conflict.code);
      } catch { }
      return NextResponse.json({ code }, { status: 409, headers: noStore });
    }
    if (upstream.status !== 200 || !upstream.headers.get("content-type")?.includes("application/json") || Number(upstream.headers.get("content-length") ?? "0") > 128_000) return cartError(503, "پاسخ پیش‌نویس قابل تأیید نیست.");
    const text = await upstream.text();
    if (text.length > 128_000) return cartError(503, "پاسخ پیش‌نویس بیش از حد بزرگ است.");
    const draft: PurchaseDraft | null = parsePurchaseDraft(JSON.parse(text) as unknown);
    return draft ? NextResponse.json(draft, { headers: noStore }) : cartError(503, "پاسخ پیش‌نویس قابل تأیید نیست.");
  } catch { return cartError(503, "وضعیت پیش‌نویس نامشخص است؛ دوباره تلاش کنید."); }
}
