import { NextRequest, NextResponse } from "next/server";
import { normalizeDigits } from "../../../../../lib/normalize-digits";
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

  let categoryId: string | null = null;
  let businessName: string | null = null;
  let description: string | null = null;
  let businessPhone: string | null = null;
  let offeringType: "GOOD" | "SERVICE" | "BOTH" | null = null;
  let revision: number | null = null;

  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 8192 ? JSON.parse(raw) : null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("اطلاعات کسب‌وکار معتبر نیست.", 400);

    const value = body as Record<string, unknown>;
    const allowed = new Set([
      "categoryId", "businessName", "description",
      "businessPhone", "offeringType", "revision",
    ]);
    if (Object.keys(value).some((key) => !allowed.has(key)))
      return error("اطلاعات کسب‌وکار معتبر نیست.", 400);

    if (typeof value.categoryId === "string" &&
      uuidPattern.test(value.categoryId))
      categoryId = value.categoryId;
    businessName = cleanText(value.businessName, 180);
    description = cleanText(value.description, 500);
    if (typeof value.businessPhone === "string") {
      const normalized = normalizeDigits(value.businessPhone.trim());
      if (/^0\d{10}$/.test(normalized))
        businessPhone = normalized;
    }
    if (value.offeringType === "GOOD" ||
      value.offeringType === "SERVICE" ||
      value.offeringType === "BOTH")
      offeringType = value.offeringType;
    if (validRevision(value.revision))
      revision = value.revision;
  } catch {
    return error("اطلاعات کسب‌وکار معتبر نیست.", 400);
  }

  if (!categoryId || !businessName || !description ||
    !businessPhone || !offeringType || revision === null)
    return error("اطلاعات کسب‌وکار کامل یا معتبر نیست.", 400);

  const target = hanaAuthApiUrl(
    "/api/v1/seller/registration/business-information");
  if (!target)
    return error("ذخیره اطلاعات کسب‌وکار تأیید نشد.", 503);

  try {
    const upstream = await fetch(target, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        categoryId,
        businessName,
        description,
        businessPhone,
        offeringType,
        revision,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 400)
      return error("اطلاعات یا دسته‌بندی کسب‌وکار معتبر نیست.", 400);
    if (upstream.status === 409)
      return error("نسخه یا مرحله ثبت‌نام تغییر کرده است؛ وضعیت را دوباره بررسی کنید.", 409);
    if (!upstream.ok)
      return error("ذخیره اطلاعات کسب‌وکار تأیید نشد.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "DRAFT" ||
      !("revision" in payload) || payload.revision !== revision + 1 ||
      !("completedStep" in payload) || payload.completedStep !== 4 ||
      !("category" in payload) || !payload.category ||
      typeof payload.category !== "object" ||
      !("id" in payload.category) || payload.category.id !== categoryId ||
      !("name" in payload.category) ||
      typeof payload.category.name !== "string" ||
      !payload.category.name.trim() ||
      !("businessName" in payload) ||
      payload.businessName !== businessName ||
      !("description" in payload) ||
      payload.description !== description ||
      !("businessPhone" in payload) ||
      payload.businessPhone !== businessPhone ||
      !("offeringType" in payload) ||
      payload.offeringType !== offeringType)
      return error("ذخیره اطلاعات کسب‌وکار تأیید نشد.", 503);

    return NextResponse.json({
      status: "DRAFT",
      revision: payload.revision,
      completedStep: 4,
      category: {
        id: categoryId,
        name: payload.category.name.trim(),
      },
      businessName,
      description,
      businessPhone,
      offeringType,
    }, { headers: noStore });
  } catch {
    return error("ذخیره اطلاعات کسب‌وکار تأیید نشد.", 503);
  }
}
