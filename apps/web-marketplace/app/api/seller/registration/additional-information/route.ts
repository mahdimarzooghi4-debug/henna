import { NextRequest, NextResponse } from "next/server";
import { normalizeDigits } from "../../../../../lib/normalize-digits";
import {
  accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName,
} from "../../../../../lib/server-auth";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function bearer(request: NextRequest): string | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

function cleanRequired(value: unknown, max: number): string | null {
  const cleaned = cleanOptional(value, max);
  return cleaned && cleaned.length > 0 ? cleaned : null;
}

function cleanOptional(value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001f\u007f]/.test(text))
    return null;
  return text;
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 && value < 2147483647;
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request))
    return error("درخواست نامعتبر است.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);

  const token = bearer(request);
  if (!token)
    return error("برای ادامه ثبت‌نام ابتدا وارد شوید.", 401);

  let contactName: string | null = null;
  let contactRole: string | null = null;
  let backupPhone: string | null = null;
  let websiteOrSocial: string | null = null;
  let businessEmail: string | null = null;
  let responseHours: string | null = null;
  let revision: number | null = null;

  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 8192 ? JSON.parse(raw) : null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("اطلاعات تکمیلی معتبر نیست.", 400);

    const value = body as Record<string, unknown>;
    const allowed = new Set([
      "contactName", "contactRole", "backupPhone",
      "websiteOrSocial", "businessEmail", "responseHours", "revision",
    ]);
    if (Object.keys(value).some((key) => !allowed.has(key)))
      return error("اطلاعات تکمیلی معتبر نیست.", 400);

    contactName = cleanRequired(value.contactName, 120);
    contactRole = cleanOptional(value.contactRole, 120);
    websiteOrSocial = cleanOptional(value.websiteOrSocial, 300);
    businessEmail = cleanOptional(value.businessEmail, 254);
    responseHours = cleanRequired(value.responseHours, 180);
    if (typeof value.backupPhone === "string" &&
      value.backupPhone.trim().length > 0)
      backupPhone = normalizeDigits(value.backupPhone.trim());
    else if (value.backupPhone !== null &&
      value.backupPhone !== undefined &&
      value.backupPhone !== "")
      return error("تلفن پشتیبان معتبر نیست.", 400);
    if (validRevision(value.revision)) revision = value.revision;
  } catch {
    return error("اطلاعات تکمیلی معتبر نیست.", 400);
  }

  if (!contactName || !responseHours || revision === null ||
    (backupPhone !== null && !/^09\d{9}$/.test(backupPhone)) ||
    (businessEmail !== null && !validEmail(businessEmail)))
    return error("اطلاعات تکمیلی کامل یا معتبر نیست.", 400);

  const target = hanaAuthApiUrl(
    "/api/v1/seller/registration/additional-information");
  if (!target)
    return error("ذخیره اطلاعات تکمیلی تأیید نشد.", 503);

  try {
    const upstream = await fetch(target, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactName,
        contactRole,
        backupPhone,
        websiteOrSocial,
        businessEmail,
        responseHours,
        revision,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 400)
      return error("اطلاعات تکمیلی معتبر نیست.", 400);
    if (upstream.status === 409)
      return error("نسخه یا مرحله ثبت‌نام تغییر کرده است؛ وضعیت را دوباره بررسی کنید.", 409);
    if (!upstream.ok)
      return error("ذخیره اطلاعات تکمیلی تأیید نشد.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) ||
      (payload.status !== "DRAFT" && payload.status !== "REWORK") ||
      !("revision" in payload) || payload.revision !== revision + 1 ||
      !("completedStep" in payload) ||
      (payload.status === "DRAFT"
        ? payload.completedStep !== 6
        : payload.completedStep !== 6) ||
      !("contactName" in payload) || payload.contactName !== contactName ||
      !("responseHours" in payload) ||
      payload.responseHours !== responseHours ||
      !("documentsRequired" in payload) ||
      payload.documentsRequired !== false)
      return error("ذخیره اطلاعات تکمیلی تأیید نشد.", 503);

    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return error("ذخیره اطلاعات تکمیلی تأیید نشد.", 503);
  }
}
