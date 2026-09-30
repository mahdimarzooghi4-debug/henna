import { NextRequest, NextResponse } from "next/server";
import { normalizeDigits } from "../../../../../../lib/normalize-digits";
import {
  accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName,
} from "../../../../../../lib/server-auth";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function bearer(request: NextRequest): string | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 && value < 2147483647;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text))
    return null;
  return text;
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);

  const token = bearer(request);
  if (!token) return error("برای ادامه ثبت‌نام ابتدا وارد شوید.", 401);

  let revision: number | null = null;
  let legalNationalId: string | null = null;
  let legalName: string | null = null;
  let representativeName: string | null = null;
  let representativePhone: string | null = null;

  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 4096 ? JSON.parse(raw) : null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("اطلاعات شخصیت حقوقی معتبر نیست.", 400);
    const value = body as Record<string, unknown>;
    const allowed = new Set([
      "legalNationalId", "legalName", "representativeName",
      "representativePhone", "revision",
    ]);
    if (Object.keys(value).some((key) => !allowed.has(key)))
      return error("اطلاعات شخصیت حقوقی معتبر نیست.", 400);

    if (typeof value.legalNationalId === "string") {
      const normalized = normalizeDigits(value.legalNationalId.trim());
      if (/^\d{11}$/.test(normalized)) legalNationalId = normalized;
    }
    legalName = cleanText(value.legalName, 180);
    representativeName = cleanText(value.representativeName, 120);
    if (typeof value.representativePhone === "string") {
      const normalized = normalizeDigits(value.representativePhone.trim());
      if (/^09\d{9}$/.test(normalized)) representativePhone = normalized;
    }
    if (validRevision(value.revision)) revision = value.revision;
  } catch {
    return error("اطلاعات شخصیت حقوقی معتبر نیست.", 400);
  }

  if (!legalNationalId || !legalName || !representativeName ||
    !representativePhone || revision === null)
    return error("اطلاعات شخصیت حقوقی یا نسخهٔ پیش‌نویس معتبر نیست.", 400);

  const target = hanaAuthApiUrl(
    "/api/v1/seller/registration/identity/legal");
  if (!target) return error("ذخیره اطلاعات شخصیت حقوقی تأیید نشد.", 503);

  try {
    const upstream = await fetch(target, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        legalNationalId,
        legalName,
        representativeName,
        representativePhone,
        revision,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 400)
      return error("اطلاعات شخصیت حقوقی یا شماره نماینده معتبر نیست.", 400);
    if (upstream.status === 404)
      return error("پیش‌نویس ثبت‌نام پیدا نشد.", 404);
    if (upstream.status === 409)
      return error("نسخه یا نوع متقاضی تغییر کرده است؛ وضعیت را دوباره بررسی کنید.", 409);
    if (!upstream.ok)
      return error("ذخیره اطلاعات شخصیت حقوقی تأیید نشد.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "DRAFT" ||
      !("revision" in payload) || payload.revision !== revision + 1 ||
      !("identityStatus" in payload) ||
      payload.identityStatus !== "RECORDED" ||
      !("completedStep" in payload) || payload.completedStep !== 3)
      return error("ذخیره اطلاعات شخصیت حقوقی تأیید نشد.", 503);

    return NextResponse.json({
      status: "DRAFT",
      revision: payload.revision,
      identityStatus: "RECORDED",
      completedStep: 3,
    }, { headers: noStore });
  } catch {
    return error("ذخیره اطلاعات شخصیت حقوقی تأیید نشد.", 503);
  }
}
