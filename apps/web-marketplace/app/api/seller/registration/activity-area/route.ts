import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName,
} from "../../../../../lib/server-auth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function bearer(request: NextRequest): string | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max ||
    /[\u0000-\u001f\u007f]/.test(text))
    return null;
  return text;
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 && value < 2147483647;
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request))
    return error("درخواست نامعتبر است.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);

  const token = bearer(request);
  if (!token)
    return error("برای ادامه ثبت‌نام ابتدا وارد شوید.", 401);

  let provinceId: string | null = null;
  let cityId: string | null = null;
  let address: string | null = null;
  let activityHours: string | null = null;
  let serviceArea: string | null = null;
  let sellerDelivery: boolean | null = null;
  let pickup: boolean | null = null;
  let revision: number | null = null;

  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 8192 ? JSON.parse(raw) : null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("محدوده فعالیت معتبر نیست.", 400);

    const value = body as Record<string, unknown>;
    const allowed = new Set([
      "provinceId", "cityId", "address", "activityHours",
      "sellerDelivery", "pickup", "serviceArea", "revision",
    ]);
    if (Object.keys(value).some((key) => !allowed.has(key)))
      return error("محدوده فعالیت معتبر نیست.", 400);

    if (typeof value.provinceId === "string" &&
      uuidPattern.test(value.provinceId))
      provinceId = value.provinceId;
    if (typeof value.cityId === "string" &&
      uuidPattern.test(value.cityId))
      cityId = value.cityId;
    address = cleanText(value.address, 500);
    activityHours = cleanText(value.activityHours, 180);
    serviceArea = cleanText(value.serviceArea, 240);
    if (typeof value.sellerDelivery === "boolean")
      sellerDelivery = value.sellerDelivery;
    if (typeof value.pickup === "boolean")
      pickup = value.pickup;
    if (validRevision(value.revision))
      revision = value.revision;
  } catch {
    return error("محدوده فعالیت معتبر نیست.", 400);
  }

  if (!provinceId || !cityId || !address || !activityHours ||
    !serviceArea || sellerDelivery === null || pickup === null ||
    (!sellerDelivery && !pickup) || revision === null)
    return error("محدوده فعالیت کامل یا معتبر نیست.", 400);

  const target = hanaAuthApiUrl(
    "/api/v1/seller/registration/activity-area");
  if (!target)
    return error("ذخیره محدوده فعالیت تأیید نشد.", 503);

  try {
    const upstream = await fetch(target, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provinceId,
        cityId,
        address,
        activityHours,
        sellerDelivery,
        pickup,
        serviceArea,
        revision,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 400)
      return error("استان، شهر یا اطلاعات محدوده فعالیت معتبر نیست.", 400);
    if (upstream.status === 409)
      return error("نسخه یا مرحله ثبت‌نام تغییر کرده است؛ وضعیت را دوباره بررسی کنید.", 409);
    if (!upstream.ok)
      return error("ذخیره محدوده فعالیت تأیید نشد.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "DRAFT" ||
      !("revision" in payload) || payload.revision !== revision + 1 ||
      !("completedStep" in payload) || payload.completedStep !== 5 ||
      !("province" in payload) || !payload.province ||
      typeof payload.province !== "object" ||
      !("id" in payload.province) || payload.province.id !== provinceId ||
      !("name" in payload.province) ||
      typeof payload.province.name !== "string" ||
      !("city" in payload) || !payload.city ||
      typeof payload.city !== "object" ||
      !("id" in payload.city) || payload.city.id !== cityId ||
      !("name" in payload.city) ||
      typeof payload.city.name !== "string")
      return error("ذخیره محدوده فعالیت تأیید نشد.", 503);

    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return error("ذخیره محدوده فعالیت تأیید نشد.", 503);
  }
}
