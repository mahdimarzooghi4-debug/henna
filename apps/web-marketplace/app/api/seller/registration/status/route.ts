import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName,
} from "../../../../../lib/server-auth";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function bearer(request: NextRequest): string | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

export async function GET(request: NextRequest) {
  const token = bearer(request);
  if (!token)
    return error("برای مشاهده وضعیت درخواست ابتدا وارد شوید.", 401);

  const target = hanaAuthApiUrl("/api/v1/seller/registration/status");
  if (!target)
    return error("وضعیت درخواست فعلاً در دسترس نیست.", 503);

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 404)
      return error("درخواستی برای این حساب پیدا نشد.", 404);
    if (upstream.status === 409)
      return error("درخواست هنوز برای بررسی نهایی ثبت نشده است.", 409);
    if (!upstream.ok)
      return error("وضعیت درخواست فعلاً در دسترس نیست.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("revision" in payload) ||
      typeof payload.revision !== "number" ||
      !Number.isSafeInteger(payload.revision) ||
      payload.revision < 1 || payload.revision >= 2147483647 ||
      !("trackingCode" in payload) ||
      typeof payload.trackingCode !== "string" ||
      !/^HNA-[0-9A-F]{16}$/.test(payload.trackingCode) ||
      !("overallStatus" in payload) ||
      !["UNDER_REVIEW", "NEEDS_INFORMATION", "APPROVED", "REJECTED"]
        .includes(String(payload.overallStatus)) ||
      !("applicantType" in payload) ||
      (payload.applicantType !== "NATURAL" &&
        payload.applicantType !== "LEGAL") ||
      !("identityStatus" in payload) ||
      (payload.identityStatus !== "VERIFIED" &&
        payload.identityStatus !== "RECORDED") ||
      !("submittedAtUtc" in payload) ||
      typeof payload.submittedAtUtc !== "string" ||
      Number.isNaN(Date.parse(payload.submittedAtUtc)) ||
      !("accuracyConfirmedAtUtc" in payload) ||
      typeof payload.accuracyConfirmedAtUtc !== "string" ||
      Number.isNaN(Date.parse(payload.accuracyConfirmedAtUtc)) ||
      !("reviewReason" in payload) ||
      !("reviewedAtUtc" in payload) ||
      (payload.overallStatus === "UNDER_REVIEW"
        ? payload.reviewReason !== null || payload.reviewedAtUtc !== null
        : (payload.reviewedAtUtc === null ||
          typeof payload.reviewedAtUtc !== "string" ||
          Number.isNaN(Date.parse(payload.reviewedAtUtc)) ||
          ((payload.overallStatus === "NEEDS_INFORMATION" ||
            payload.overallStatus === "REJECTED") &&
            (typeof payload.reviewReason !== "string" ||
              !payload.reviewReason.trim() ||
              payload.reviewReason.length > 500)) ||
          (payload.overallStatus === "APPROVED" &&
            payload.reviewReason !== null &&
            (typeof payload.reviewReason !== "string" ||
              !payload.reviewReason.trim() ||
              payload.reviewReason.length > 500)))) ||
      !("sellerPanelEnabled" in payload) ||
      payload.sellerPanelEnabled !== false ||
      !("steps" in payload) ||
      !Array.isArray(payload.steps))
      return error("وضعیت درخواست قابل تأیید نیست.", 503);

    const steps = payload.steps as unknown[];
    const expected = [
      ["IDENTITY", "COMPLETED"],
      ["BUSINESS", "COMPLETED"],
      ["ACTIVITY", "COMPLETED"],
      ["ADDITIONAL", "COMPLETED"],
      ["REVIEW", String(payload.overallStatus)],
    ];
    if (steps.length !== expected.length ||
      !expected.every(([key, status], index) => {
        const step = steps[index];
        return step && typeof step === "object" &&
          "key" in step && step.key === key &&
          "status" in step && step.status === status;
      }))
      return error("وضعیت درخواست قابل تأیید نیست.", 503);

    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return error("وضعیت درخواست فعلاً در دسترس نیست.", 503);
  }
}
