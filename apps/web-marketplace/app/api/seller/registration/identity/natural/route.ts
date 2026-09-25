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

function validNationalCode(value: string): boolean {
  if (!/^\d{10}$/.test(value) || /^(\d)\1{9}$/.test(value)) return false;
  const sum = [...value.slice(0, 9)].reduce(
    (total, digit, index) =>
      total + Number(digit) * (10 - index), 0);
  const remainder = sum % 11;
  const check = remainder < 2 ? remainder : 11 - remainder;
  return check === Number(value[9]);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);

  const token = bearer(request);
  if (!token) return error("برای احراز هویت ابتدا وارد شوید.", 401);

  let nationalCode: string | null = null;
  let revision: number | null = null;
  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 1024 ? JSON.parse(raw) : null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("اطلاعات احراز هویت معتبر نیست.", 400);
    const value = body as Record<string, unknown>;
    if (Object.keys(value).some((key) =>
      key !== "nationalCode" && key !== "revision"))
      return error("اطلاعات احراز هویت معتبر نیست.", 400);

    if (typeof value.nationalCode === "string") {
      const normalized = normalizeDigits(value.nationalCode.trim());
      if (validNationalCode(normalized)) nationalCode = normalized;
    }
    if (validRevision(value.revision)) revision = value.revision;
  } catch {
    return error("اطلاعات احراز هویت معتبر نیست.", 400);
  }
  if (!nationalCode || revision === null)
    return error("کد ملی یا نسخهٔ پیش‌نویس معتبر نیست.", 400);

  const target = hanaAuthApiUrl(
    "/api/v1/seller/registration/identity/natural");
  if (!target) return error("خدمت استعلام هویت فعال نیست.", 503);

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nationalCode, revision }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 400)
      return error("اطلاعات هویتی تأیید نشد.", 400);
    if (upstream.status === 404)
      return error("پیش‌نویس ثبت‌نام پیدا نشد.", 404);
    if (upstream.status === 409)
      return error("نسخه یا نوع متقاضی تغییر کرده است؛ وضعیت را دوباره بررسی کنید.", 409);
    if (upstream.status === 503)
      return error("استعلام هویت در حال حاضر در دسترس نیست؛ هیچ تأییدی ثبت نشد.", 503);
    if (!upstream.ok)
      return error("استعلام هویت تکمیل نشد.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "DRAFT" ||
      !("revision" in payload) || payload.revision !== revision + 1 ||
      !("identityStatus" in payload) ||
      payload.identityStatus !== "VERIFIED" ||
      !("nationalCodeMasked" in payload) ||
      typeof payload.nationalCodeMasked !== "string" ||
      !/^\*{6}\d{4}$/.test(payload.nationalCodeMasked) ||
      !("completedStep" in payload) || payload.completedStep !== 3)
      return error("استعلام هویت تکمیل نشد.", 503);

    return NextResponse.json({
      status: "DRAFT",
      revision: payload.revision,
      identityStatus: "VERIFIED",
      nationalCodeMasked: payload.nationalCodeMasked,
      completedStep: 3,
    }, { headers: noStore });
  } catch {
    return error("استعلام هویت در حال حاضر در دسترس نیست؛ هیچ تأییدی ثبت نشد.", 503);
  }
}
