import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName,
} from "./server-auth";

type MutationAction = "update" | "publish";
type JsonObject = Record<string, unknown>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = (value: unknown): value is string =>
  typeof value === "string" && uuid.test(value) &&
  value !== "00000000-0000-0000-0000-000000000000";
const isRecord = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: JsonObject, keys: string[]) =>
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  !Number.isNaN(Date.parse(value));

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function parseMutation(value: unknown, offerId: string): JsonObject | null {
  if (!isRecord(value) ||
    !exactKeys(value, ["id", "catalogProductId", "status", "revision", "priceRials", "sellableQuantity", "createdAtUtc", "updatedAtUtc"]) ||
    value.id !== offerId || !validId(value.catalogProductId) ||
    (value.status !== "DRAFT" && value.status !== "PUBLISHED") ||
    typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 2 ||
    !(value.priceRials === null || (typeof value.priceRials === "number" && Number.isSafeInteger(value.priceRials) && value.priceRials > 0)) ||
    !(value.sellableQuantity === null || (typeof value.sellableQuantity === "number" && Number.isFinite(value.sellableQuantity) && value.sellableQuantity > 0)) ||
    ((value.priceRials === null) !== (value.sellableQuantity === null)) ||
    (value.status === "PUBLISHED" &&
      (typeof value.priceRials !== "number" || typeof value.sellableQuantity !== "number")) ||
    !validTimestamp(value.createdAtUtc) || !validTimestamp(value.updatedAtUtc))
    return null;
  return value;
}

export async function mutateSellerOffer(
  request: NextRequest, offerId: string,
  action: MutationAction,
) {
  if (!validId(offerId)) return error("شناسه پیشنهاد معتبر نیست.", 400);
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return error("برای تغییر پیشنهاد ابتدا وارد شوید.", 401);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!validId(key)) return error("کلید یکتای درخواست معتبر نیست.", 400);

  let body: JsonObject;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return error("درخواست معتبر نیست.", 400);
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return error("درخواست معتبر نیست.", 400);
    if (action === "update") {
      if (!exactKeys(parsed, ["expectedRevision", "priceRials", "sellableQuantity"]) ||
        typeof parsed.expectedRevision !== "number" || !Number.isSafeInteger(parsed.expectedRevision) || parsed.expectedRevision < 1 ||
        typeof parsed.priceRials !== "number" || !Number.isSafeInteger(parsed.priceRials) || parsed.priceRials < 1 ||
        typeof parsed.sellableQuantity !== "number" || !Number.isFinite(parsed.sellableQuantity) || parsed.sellableQuantity <= 0 || parsed.sellableQuantity > 999_999_999_999)
        return error("قیمت، موجودی یا نسخه معتبر نیست.", 400);
    } else if (!exactKeys(parsed, ["expectedRevision"]) ||
      typeof parsed.expectedRevision !== "number" || !Number.isSafeInteger(parsed.expectedRevision) || parsed.expectedRevision < 1) {
      return error("نسخه پیشنهاد معتبر نیست.", 400);
    }
    body = parsed;
  } catch {
    return error("درخواست معتبر نیست.", 400);
  }

  const suffix = action === "update" ? "" : "/publish";
  const target = hanaAuthApiUrl(`/api/v1/seller/offers/${offerId}${suffix}`);
  if (!target) return error("تغییر پیشنهاد تأیید نشد.", 503);
  try {
    const upstream = await fetch(target, {
      method: action === "update" ? "PUT" : "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(body),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("دسترسی فروشندگی برای این حساب فعال نیست.", 403);
    if (upstream.status === 404) return error("پیشنهاد پیدا نشد.", 404);
    if (upstream.status === 400) return error("اطلاعات پیشنهاد معتبر نیست.", 400);
    if (upstream.status === 409) return error("اطلاعات پیشنهاد تغییر کرده؛ دوباره بارگذاری کنید.", 409);
    if (upstream.status !== 200) return error("تغییر پیشنهاد تأیید نشد.", 503);
    if (!upstream.headers.get("content-type")?.includes("application/json") ||
      Number(upstream.headers.get("content-length") ?? "0") > 128_000)
      return error("پاسخ پیشنهاد قابل تأیید نیست.", 503);
    const raw = await upstream.text();
    if (raw.length > 128_000) return error("پاسخ پیشنهاد قابل تأیید نیست.", 503);
    const result = parseMutation(JSON.parse(raw) as unknown, offerId);
    if (!result) return error("پاسخ پیشنهاد قابل تأیید نیست.", 503);
    return NextResponse.json(result, { headers: noStore });
  } catch {
    return error("تغییر پیشنهاد تأیید نشد.", 503);
  }
}
