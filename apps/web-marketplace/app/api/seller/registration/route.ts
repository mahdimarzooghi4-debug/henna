import { NextRequest, NextResponse } from "next/server";
import { normalizeDigits } from "../../../../lib/normalize-digits";
import {
  accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName,
} from "../../../../lib/server-auth";

const unavailable = "ذخیره یا بازیابی اطلاعات فروشگاه تأیید نشد؛ دوباره تلاش کنید.";
const names = ["storeName", "ownerName", "phone", "city", "address", "postalCode"] as const;

function bearer(request: NextRequest): string | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function parseFields(value: unknown): Record<(typeof names)[number], string> | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (names.some((key) => typeof body[key] !== "string")) return null;
  const fields = Object.fromEntries(names.map((key) =>
    [key, (body[key] as string).trim()])) as Record<(typeof names)[number], string>;
  fields.phone = normalizeDigits(fields.phone);
  fields.postalCode = normalizeDigits(fields.postalCode);
  if (!fields.storeName || fields.storeName.length > 120 ||
    !fields.ownerName || fields.ownerName.length > 120 ||
    !fields.city || fields.city.length > 120 ||
    !fields.address || fields.address.length > 500 ||
    Object.values(fields).some((field) => /[\u0000-\u001f\u007f]/.test(field)) ||
    !/^09\d{9}$/.test(fields.phone) ||
    !/^\d{10}$/.test(fields.postalCode))
    return null;
  return fields;
}

export async function GET(request: NextRequest) {
  const token = bearer(request);
  if (!token) return error("برای مشاهده اطلاعات فروشگاه ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl("/api/v1/seller/registration");
  if (!target) return error(unavailable, 503);

  try {
    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (response.status === 404) return error("پیش‌نویسی پیدا نشد.", 404);
    if (!response.ok) return error(unavailable, 503);
    const payload: unknown = await response.json();
    const fields = parseFields(payload);
    if (!fields || !payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "DRAFT")
      return error(unavailable, 503);
    return NextResponse.json({ ...fields, status: "DRAFT" }, { headers: noStore });
  } catch {
    return error(unavailable, 503);
  }
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);
  const token = bearer(request);
  if (!token) return error("برای ثبت اطلاعات فروشگاه ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl("/api/v1/seller/registration");
  if (!target) return error(unavailable, 503);

  let fields: ReturnType<typeof parseFields>;
  try {
    const raw = await request.text();
    fields = raw.length <= 4096 ? parseFields(JSON.parse(raw)) : null;
  } catch {
    fields = null;
  }
  if (!fields) return error("اطلاعات اولیه فروشگاه معتبر نیست.", 400);

  try {
    const upstream = await fetch(target, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fields),
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 400)
      return error("اطلاعات یا شماره مسئول فروشگاه معتبر نیست.", 400);
    if (upstream.status === 409)
      return error("این پیش‌نویس دیگر قابل ویرایش نیست.", 409);
    if (!upstream.ok) return error(unavailable, 503);
    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "DRAFT")
      return error(unavailable, 503);
    return NextResponse.json({ status: "DRAFT" }, { headers: noStore });
  } catch {
    return error(unavailable, 503);
  }
}
