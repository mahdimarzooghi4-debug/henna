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

function validRevision(value: unknown, allowZero: boolean): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= (allowZero ? 0 : 1) &&
    value < 2147483647;
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
      !("status" in payload) ||
      (payload.status !== "DRAFT" && payload.status !== "SUBMITTED") ||
      !("revision" in payload) || !validRevision(payload.revision, false))
      return error(unavailable, 503);
    const applicantType = "applicantType" in payload
      ? payload.applicantType : null;
    const completedStep = "completedStep" in payload
      ? payload.completedStep : null;
    if ((applicantType !== null &&
        applicantType !== "NATURAL" && applicantType !== "LEGAL") ||
      typeof completedStep !== "number" ||
      !Number.isSafeInteger(completedStep) ||
      completedStep < 1 || completedStep > 6 ||
      (completedStep < 2 && applicantType !== null) ||
      (completedStep >= 2 && applicantType === null))
      return error(unavailable, 503);

    const submittedAtUtc = "submittedAtUtc" in payload
      ? payload.submittedAtUtc : null;
    if (payload.status === "SUBMITTED" &&
      (typeof submittedAtUtc !== "string" ||
        Number.isNaN(Date.parse(submittedAtUtc))))
      return error(unavailable, 503);
    return NextResponse.json(
      payload.status === "SUBMITTED"
        ? {
          ...fields,
          status: "SUBMITTED",
          revision: payload.revision,
          submittedAtUtc,
          applicantType,
          completedStep,
        }
        : {
          ...fields,
          status: "DRAFT",
          revision: payload.revision,
          applicantType,
          completedStep,
        },
      { headers: noStore });
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
  let revision: number | null = null;
  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 4096 ? JSON.parse(raw) : null;
    fields = parseFields(body);
    if (body && typeof body === "object" && "revision" in body &&
      validRevision(body.revision, true))
      revision = body.revision;
  } catch {
    fields = null;
  }
  if (!fields || revision === null)
    return error("اطلاعات اولیه یا نسخهٔ پیش‌نویس معتبر نیست.", 400);

  try {
    const upstream = await fetch(target, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...fields, revision }),
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 400)
      return error("اطلاعات یا شماره مسئول فروشگاه معتبر نیست.", 400);
    if (upstream.status === 409)
      return error("پیش‌نویس در پنجرهٔ دیگری تغییر کرده است. پیش از ذخیره دوباره صفحه را تازه‌سازی کنید.", 409);
    if (!upstream.ok) return error(unavailable, 503);
    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "DRAFT" ||
      !("revision" in payload) ||
      !validRevision(payload.revision, false) ||
      payload.revision !== revision + 1)
      return error(unavailable, 503);
    return NextResponse.json(
      { status: "DRAFT", revision: payload.revision },
      { headers: noStore });
  } catch {
    return error(unavailable, 503);
  }
}


export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);
  const token = bearer(request);
  if (!token) return error("برای ثبت درخواست ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl("/api/v1/seller/registration/submit");
  if (!target) return error(unavailable, 503);

  let revision: number | null = null;
  let idempotencyKey: string | null = null;
  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 1024 ? JSON.parse(raw) : null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("درخواست ثبت معتبر نیست.", 400);
    const value = body as Record<string, unknown>;
    if (Object.keys(value).some((key) =>
      key !== "revision" && key !== "idempotencyKey"))
      return error("درخواست ثبت معتبر نیست.", 400);
    if (validRevision(value.revision, false)) revision = value.revision;
    if (typeof value.idempotencyKey === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(value.idempotencyKey))
      idempotencyKey = value.idempotencyKey;
  } catch {
    return error("درخواست ثبت معتبر نیست.", 400);
  }
  if (revision === null || !idempotencyKey)
    return error("نسخه یا کلید ثبت معتبر نیست.", 400);

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ revision }),
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 404)
      return error("پیش‌نویسی برای ثبت پیدا نشد.", 404);
    if (upstream.status === 400)
      return error("درخواست ثبت معتبر نیست.", 400);
    if (upstream.status === 409)
      return error("پیش‌نویس تغییر کرده یا قبلاً ثبت شده است؛ وضعیت را دوباره بررسی کنید.", 409);
    if (!upstream.ok) return error(unavailable, 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "SUBMITTED" ||
      !("revision" in payload) || !validRevision(payload.revision, false) ||
      !("submittedAtUtc" in payload) ||
      typeof payload.submittedAtUtc !== "string" ||
      Number.isNaN(Date.parse(payload.submittedAtUtc)))
      return error(unavailable, 503);

    return NextResponse.json({
      status: "SUBMITTED",
      revision: payload.revision,
      submittedAtUtc: payload.submittedAtUtc,
    }, { headers: noStore });
  } catch {
    return error(unavailable, 503);
  }
}
