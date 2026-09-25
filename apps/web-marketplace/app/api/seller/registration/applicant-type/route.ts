import { NextRequest, NextResponse } from "next/server";
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

function validRevision(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 && value < 2147483647;
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);

  const token = bearer(request);
  if (!token) return error("برای ادامه ثبت‌نام ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl(
    "/api/v1/seller/registration/applicant-type");
  if (!target) return error("ذخیره نوع متقاضی تأیید نشد.", 503);

  let applicantType: "NATURAL" | "LEGAL" | null = null;
  let revision: number | null = null;
  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 1024 ? JSON.parse(raw) : null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("نوع متقاضی معتبر نیست.", 400);
    const value = body as Record<string, unknown>;
    if (Object.keys(value).some((key) =>
      key !== "applicantType" && key !== "revision"))
      return error("نوع متقاضی معتبر نیست.", 400);
    if (value.applicantType === "NATURAL" ||
      value.applicantType === "LEGAL")
      applicantType = value.applicantType;
    if (validRevision(value.revision)) revision = value.revision;
  } catch {
    return error("نوع متقاضی معتبر نیست.", 400);
  }
  if (!applicantType || revision === null)
    return error("نوع متقاضی یا نسخه پیش‌نویس معتبر نیست.", 400);

  try {
    const upstream = await fetch(target, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ applicantType, revision }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 400)
      return error("نوع متقاضی معتبر نیست.", 400);
    if (upstream.status === 409)
      return error("پیش‌نویس تغییر کرده است؛ وضعیت را دوباره دریافت کنید.", 409);
    if (!upstream.ok) return error("ذخیره نوع متقاضی تأیید نشد.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "DRAFT" ||
      !("revision" in payload) ||
      payload.revision !== revision + 1 ||
      !("applicantType" in payload) ||
      payload.applicantType !== applicantType ||
      !("completedStep" in payload) || payload.completedStep !== 2)
      return error("ذخیره نوع متقاضی تأیید نشد.", 503);

    return NextResponse.json({
      status: "DRAFT",
      revision: payload.revision,
      applicantType,
      completedStep: 2,
    }, { headers: noStore });
  } catch {
    return error("ذخیره نوع متقاضی تأیید نشد.", 503);
  }
}
