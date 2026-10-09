import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "./server-auth";
import { commerceId, commerceMessages, parseCommerce, parseOffers, parseServiceListings } from "./buyer-commerce";
const getPaths: Record<string, string> = { cart: "/carts/current", comparison: "/carts/current/comparison", addresses: "/me/addresses", credits: "/me/credits", wallet: "/me/wallet", withdrawals: "/me/withdrawals", orders: "/orders", notifications: "/me/notifications", tickets: "/me/tickets" };
const postPaths: Record<string, string> = { "cart-items": "/carts/current/items", addresses: "/me/addresses", quotes: "/quotes", orders: "/orders", withdrawals: "/me/withdrawals", tickets: "/support/tickets" };
async function boundedText(response: Request | Response, max: number) {
  if (!response.body) throw Error(); const reader = response.body.getReader(); const decoder = new TextDecoder("utf-8", { fatal: true }); let bytes = 0, out = "";
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > max) { await reader.cancel(); throw Error(); } out += decoder.decode(value, { stream: true }); } return out + decoder.decode(); } finally { reader.releaseLock(); }
}
export async function forwardBuyerCommerce(request: NextRequest, segments: string[], method: "GET" | "POST") {
  const fail = (status: number, code = "") => NextResponse.json({ code, message: commerceMessages[code] ?? (status === 401 ? "برای ادامه وارد شوید." : "دریافت یا ثبت اطلاعات تأیید نشد.") }, { status, headers: noStore });
  const path = segments.join("/"); let upstreamPath: string | undefined;
  const publicRead = method === "GET" &&
    (path === "offers" || path === "service-listings");
  if (publicRead) {
    const product = request.nextUrl.searchParams.get("productId"); if (!commerceId(product) || request.nextUrl.searchParams.size !== 1) return fail(400);
    upstreamPath = (path === "offers" ? "/offers" : "/service-listings") +
      "?productId=" + encodeURIComponent(product) + "&page=1";
  } else {
    const allowed = method === "GET" ? getPaths : postPaths;
    upstreamPath = Object.hasOwn(allowed, path) ? allowed[path] : undefined;
    if (segments[0] === "orders" && commerceId(segments[1]) && (method === "GET" && segments.length === 2 || method === "POST" && segments.length === 3 && ["cancel", "pickup-confirmation"].includes(segments[2])))
      upstreamPath = "/orders/" + segments.slice(1).join("/");
    if (method === "POST" && segments.length === 3 &&
        segments[0] === "notifications" && commerceId(segments[1]) &&
        segments[2] === "read")
      upstreamPath = "/me/notifications/" + segments[1] + "/read";
    if (method === "POST" && segments.length === 3 &&
        segments[0] === "withdrawals" && commerceId(segments[1]) &&
        segments[2] === "cancel")
      upstreamPath = "/me/withdrawals/" + segments[1] + "/cancel";
  }
  if (!upstreamPath) return fail(404);
  let requestedPage = 1;
  if (request.nextUrl.searchParams.size && !publicRead) {
    const value = request.nextUrl.searchParams.get("page");
    if (method !== "GET" ||
        !["orders","notifications","tickets","withdrawals"].includes(path) ||
        request.nextUrl.searchParams.size !== 1 || !value ||
        !/^[1-9][0-9]{0,4}$/.test(value) || Number(value) > 10000)
      return fail(400);
    requestedPage = Number(value); upstreamPath += "?page=" + requestedPage;
  }
  if (method === "POST" && !isSameOrigin(request)) return fail(403);
  const token = publicRead ? null : request.cookies.get(sessionCookieName)?.value;
  if (!publicRead && (!token || !accessTokenPattern.test(token))) return fail(401);
  let body: string | undefined, key: string | undefined;
  if (method === "POST") {
    key = request.headers.get("Idempotency-Key") ?? undefined;
    if (!commerceId(key) || !request.headers.get("content-type")?.startsWith("application/json")) return fail(400);
    try { body = await boundedText(request, 65536); const x: unknown = JSON.parse(body); if (!x || typeof x !== "object" || Array.isArray(x)) return fail(400); } catch { return fail(400); }
  }
  const target = hanaAuthApiUrl("/api/v1" + upstreamPath); if (!target) return fail(503);
  try {
    const r = await fetch(target, { method, body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000), headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { "Content-Type": "application/json", "Idempotency-Key": key } : {}) } });
    if (!r.ok) {
      const status = [400,401,403,404,409,429].includes(r.status) ? r.status : 503;
      let code = ""; if (r.headers.get("content-type")?.includes("application/json")) { try { const x: unknown = JSON.parse(await boundedText(r, 4096)); if (x && typeof x === "object" && "error" in x && typeof x.error === "string" && Object.hasOwn(commerceMessages, x.error)) code = x.error; } catch { /* Do not forward arbitrary error data. */ } }
      return fail(status, code);
    }
    if (r.status !== 200 || !r.headers.get("content-type")?.includes("application/json")) return fail(503);
    const x: unknown = JSON.parse(await boundedText(r, 512000));
    const result = publicRead
      ? path === "offers"
        ? parseOffers(x, request.nextUrl.searchParams.get("productId")!)
        : parseServiceListings(x, request.nextUrl.searchParams.get("productId")!)
      : parseCommerce(path, method, x, requestedPage);
    if (result === null) return fail(503);
    return NextResponse.json(result, { headers: noStore });
  } catch { return fail(503); }
}
