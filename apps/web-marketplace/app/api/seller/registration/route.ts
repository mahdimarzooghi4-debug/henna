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
      (payload.status !== "DRAFT" &&
        payload.status !== "SUBMITTED" &&
        payload.status !== "REWORK") ||
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

    const identityStatus = "identityStatus" in payload
      ? payload.identityStatus : null;
    const nationalCodeMasked = "nationalCodeMasked" in payload
      ? payload.nationalCodeMasked : null;
    const legalNationalId = "legalNationalId" in payload
      ? payload.legalNationalId : null;
    const legalName = "legalName" in payload ? payload.legalName : null;
    const legalRepresentativeName = "legalRepresentativeName" in payload
      ? payload.legalRepresentativeName : null;
    const legalRepresentativePhone = "legalRepresentativePhone" in payload
      ? payload.legalRepresentativePhone : null;

    if (completedStep < 3) {
      if (identityStatus !== null || nationalCodeMasked !== null ||
        legalNationalId !== null || legalName !== null ||
        legalRepresentativeName !== null || legalRepresentativePhone !== null)
        return error(unavailable, 503);
    } else if (applicantType === "NATURAL") {
      if (identityStatus !== "VERIFIED" ||
        typeof nationalCodeMasked !== "string" ||
        !/^\*{6}\d{4}$/.test(nationalCodeMasked) ||
        legalNationalId !== null || legalName !== null ||
        legalRepresentativeName !== null || legalRepresentativePhone !== null)
        return error(unavailable, 503);
    } else {
      if (identityStatus !== "RECORDED" ||
        nationalCodeMasked !== null ||
        typeof legalNationalId !== "string" ||
        !/^\d{11}$/.test(legalNationalId) ||
        typeof legalName !== "string" || !legalName ||
        typeof legalRepresentativeName !== "string" ||
        !legalRepresentativeName ||
        typeof legalRepresentativePhone !== "string" ||
        !/^09\d{9}$/.test(legalRepresentativePhone))
        return error(unavailable, 503);
    }

    const businessCategoryId = "businessCategoryId" in payload
      ? payload.businessCategoryId : null;
    const businessCategoryName = "businessCategoryName" in payload
      ? payload.businessCategoryName : null;
    const businessName = "businessName" in payload
      ? payload.businessName : null;
    const businessDescription = "businessDescription" in payload
      ? payload.businessDescription : null;
    const businessPhone = "businessPhone" in payload
      ? payload.businessPhone : null;
    const offeringType = "offeringType" in payload
      ? payload.offeringType : null;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (completedStep < 4) {
      if (businessCategoryId !== null || businessCategoryName !== null ||
        businessName !== null || businessDescription !== null ||
        businessPhone !== null || offeringType !== null)
        return error(unavailable, 503);
    } else if (
      typeof businessCategoryId !== "string" ||
      !uuidPattern.test(businessCategoryId) ||
      typeof businessCategoryName !== "string" ||
      !businessCategoryName.trim() || businessCategoryName.length > 120 ||
      typeof businessName !== "string" ||
      !businessName.trim() || businessName.length > 180 ||
      typeof businessDescription !== "string" ||
      !businessDescription.trim() || businessDescription.length > 500 ||
      typeof businessPhone !== "string" ||
      !/^0\d{10}$/.test(businessPhone) ||
      (offeringType !== "GOOD" &&
        offeringType !== "SERVICE" &&
        offeringType !== "BOTH")
    ) {
      return error(unavailable, 503);
    }

    const activityProvinceId = "activityProvinceId" in payload
      ? payload.activityProvinceId : null;
    const activityProvinceName = "activityProvinceName" in payload
      ? payload.activityProvinceName : null;
    const activityCityId = "activityCityId" in payload
      ? payload.activityCityId : null;
    const activityCityName = "activityCityName" in payload
      ? payload.activityCityName : null;
    const activityAddress = "activityAddress" in payload
      ? payload.activityAddress : null;
    const activityHours = "activityHours" in payload
      ? payload.activityHours : null;
    const sellerDelivery = "sellerDelivery" in payload
      ? payload.sellerDelivery : null;
    const pickup = "pickup" in payload ? payload.pickup : null;
    const serviceArea = "serviceArea" in payload
      ? payload.serviceArea : null;

    if (completedStep < 5) {
      if (activityProvinceId !== null || activityProvinceName !== null ||
        activityCityId !== null || activityCityName !== null ||
        activityAddress !== null || activityHours !== null ||
        sellerDelivery !== null || pickup !== null || serviceArea !== null)
        return error(unavailable, 503);
    } else if (
      typeof activityProvinceId !== "string" ||
      !uuidPattern.test(activityProvinceId) ||
      typeof activityProvinceName !== "string" ||
      !activityProvinceName.trim() || activityProvinceName.length > 120 ||
      typeof activityCityId !== "string" ||
      !uuidPattern.test(activityCityId) ||
      typeof activityCityName !== "string" ||
      !activityCityName.trim() || activityCityName.length > 120 ||
      typeof activityAddress !== "string" ||
      !activityAddress.trim() || activityAddress.length > 500 ||
      typeof activityHours !== "string" ||
      !activityHours.trim() || activityHours.length > 180 ||
      typeof sellerDelivery !== "boolean" ||
      typeof pickup !== "boolean" ||
      (!sellerDelivery && !pickup) ||
      typeof serviceArea !== "string" ||
      !serviceArea.trim() || serviceArea.length > 240
    ) {
      return error(unavailable, 503);
    }

    const registrationContactName =
      "registrationContactName" in payload
        ? payload.registrationContactName : null;
    const registrationContactRole =
      "registrationContactRole" in payload
        ? payload.registrationContactRole : null;
    const backupPhone = "backupPhone" in payload
      ? payload.backupPhone : null;
    const websiteOrSocial = "websiteOrSocial" in payload
      ? payload.websiteOrSocial : null;
    const businessEmail = "businessEmail" in payload
      ? payload.businessEmail : null;
    const responseHours = "responseHours" in payload
      ? payload.responseHours : null;
    const documentsRequired = "documentsRequired" in payload
      ? payload.documentsRequired : false;

    const optionalText = (
      value: unknown, max: number,
    ) => value === null ||
      (typeof value === "string" &&
        value.trim().length > 0 && value.length <= max &&
        !/[\u0000-\u001f\u007f]/.test(value));

    if (completedStep < 6) {
      if (registrationContactName !== null ||
        registrationContactRole !== null ||
        backupPhone !== null || websiteOrSocial !== null ||
        businessEmail !== null || responseHours !== null)
        return error(unavailable, 503);
    } else if (
      typeof registrationContactName !== "string" ||
      !registrationContactName.trim() ||
      registrationContactName.length > 120 ||
      !optionalText(registrationContactRole, 120) ||
      !optionalText(websiteOrSocial, 300) ||
      !optionalText(businessEmail, 254) ||
      (backupPhone !== null &&
        (typeof backupPhone !== "string" ||
          !/^09\d{9}$/.test(backupPhone))) ||
      typeof responseHours !== "string" ||
      !responseHours.trim() || responseHours.length > 180 ||
      documentsRequired !== false
    ) {
      return error(unavailable, 503);
    }

    const submittedAtUtc = "submittedAtUtc" in payload
      ? payload.submittedAtUtc : null;
    const trackingCode = "trackingCode" in payload
      ? payload.trackingCode : null;
    const reviewStatus = "reviewStatus" in payload
      ? payload.reviewStatus : null;
    const reviewReason = "reviewReason" in payload
      ? payload.reviewReason : null;
    const reviewedAtUtc = "reviewedAtUtc" in payload
      ? payload.reviewedAtUtc : null;
    if ((payload.status === "SUBMITTED" || payload.status === "REWORK") &&
      (completedStep !== 6 ||
        typeof submittedAtUtc !== "string" ||
        Number.isNaN(Date.parse(submittedAtUtc)) ||
        typeof trackingCode !== "string" ||
        !/^HNA-[0-9A-F]{16}$/.test(trackingCode)))
      return error(unavailable, 503);

    if (payload.status === "REWORK" &&
      (reviewStatus !== "NEEDS_INFORMATION" ||
        typeof reviewReason !== "string" ||
        !reviewReason.trim() || reviewReason.length > 500 ||
        typeof reviewedAtUtc !== "string" ||
        Number.isNaN(Date.parse(reviewedAtUtc))))
      return error(unavailable, 503);
    const base = {
          ...fields,
          revision: payload.revision,
          applicantType,
          identityStatus,
          nationalCodeMasked,
          legalNationalId,
          legalName,
          legalRepresentativeName,
          legalRepresentativePhone,
          businessCategoryId,
          businessCategoryName,
          businessName,
          businessDescription,
          businessPhone,
          offeringType,
          activityProvinceId,
          activityProvinceName,
          activityCityId,
          activityCityName,
          activityAddress,
          activityHours,
          sellerDelivery,
          pickup,
          serviceArea,
          registrationContactName,
          registrationContactRole,
          backupPhone,
          websiteOrSocial,
          businessEmail,
          responseHours,
          documentsRequired,
          completedStep,
        };
    if (payload.status === "SUBMITTED")
      return NextResponse.json({
        ...base,
        status: "SUBMITTED",
        submittedAtUtc,
        trackingCode,
      }, { headers: noStore });

    if (payload.status === "REWORK")
      return NextResponse.json({
        ...base,
        status: "REWORK",
        submittedAtUtc,
        trackingCode,
        reviewStatus,
        reviewReason,
        reviewedAtUtc,
      }, { headers: noStore });

    return NextResponse.json({
      ...base,
      status: "DRAFT",
    }, { headers: noStore });
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
  let confirmed = false;
  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 1024 ? JSON.parse(raw) : null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("درخواست ثبت معتبر نیست.", 400);
    const value = body as Record<string, unknown>;
    if (Object.keys(value).some((key) =>
      key !== "revision" && key !== "idempotencyKey" &&
      key !== "confirmed"))
      return error("درخواست ثبت معتبر نیست.", 400);
    if (validRevision(value.revision, false)) revision = value.revision;
    confirmed = value.confirmed === true;
    if (typeof value.idempotencyKey === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(value.idempotencyKey))
      idempotencyKey = value.idempotencyKey;
  } catch {
    return error("درخواست ثبت معتبر نیست.", 400);
  }
  if (revision === null || !idempotencyKey || !confirmed)
    return error("نسخه، کلید ثبت یا تأیید صحت اطلاعات معتبر نیست.", 400);

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ revision, confirmed }),
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
      Number.isNaN(Date.parse(payload.submittedAtUtc)) ||
      !("accuracyConfirmedAtUtc" in payload) ||
      typeof payload.accuracyConfirmedAtUtc !== "string" ||
      Number.isNaN(Date.parse(payload.accuracyConfirmedAtUtc)) ||
      !("trackingCode" in payload) ||
      typeof payload.trackingCode !== "string" ||
      !/^HNA-[0-9A-F]{16}$/.test(payload.trackingCode))
      return error(unavailable, 503);

    return NextResponse.json({
      status: "SUBMITTED",
      revision: payload.revision,
      submittedAtUtc: payload.submittedAtUtc,
      accuracyConfirmedAtUtc: payload.accuracyConfirmedAtUtc,
      trackingCode: payload.trackingCode,
    }, { headers: noStore });
  } catch {
    return error(unavailable, 503);
  }
}
