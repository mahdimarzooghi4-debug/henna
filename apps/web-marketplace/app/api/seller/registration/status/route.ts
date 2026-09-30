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
      !("trackingCode" in payload) ||
      typeof payload.trackingCode !== "string" ||
      !/^HNA-[0-9A-F]{16}$/.test(payload.trackingCode) ||
      !("overallStatus" in payload) ||
      payload.overallStatus !== "UNDER_REVIEW" ||
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
      ["REVIEW", "UNDER_REVIEW"],
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
