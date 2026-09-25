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

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return error("درخواست نامعتبر است.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);

  const token = bearer(request);
  if (!token)
    return error("برای تکمیل پرونده ابتدا وارد شوید.", 401);

  let revision: number | null = null;
  try {
    const raw = await request.text();
    const body: unknown = raw.length <= 512 ? JSON.parse(raw) : null;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return error("درخواست بازگشایی معتبر نیست.", 400);
    const value = body as Record<string, unknown>;
    if (Object.keys(value).some((key) => key !== "revision") ||
      !validRevision(value.revision))
      return error("درخواست بازگشایی معتبر نیست.", 400);
    revision = value.revision;
  } catch {
    return error("درخواست بازگشایی معتبر نیست.", 400);
  }

  const target = hanaAuthApiUrl("/api/v1/seller/registration/reopen");
  if (!target)
    return error("بازگشایی پرونده تأیید نشد.", 503);

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ revision }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 404)
      return error("پرونده‌ای برای این حساب پیدا نشد.", 404);
    if (upstream.status === 400)
      return error("درخواست بازگشایی معتبر نیست.", 400);
    if (upstream.status === 409)
      return error("پرونده دیگر در وضعیت قابل اصلاح نیست؛ وضعیت را دوباره بررسی کنید.", 409);
    if (!upstream.ok)
      return error("بازگشایی پرونده تأیید نشد.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("status" in payload) || payload.status !== "REWORK" ||
      !("revision" in payload) || !validRevision(payload.revision) ||
      payload.revision !== revision + 1 ||
      !("completedStep" in payload) || payload.completedStep !== 6 ||
      !("trackingCode" in payload) ||
      typeof payload.trackingCode !== "string" ||
      !/^HNA-[0-9A-F]{16}$/.test(payload.trackingCode) ||
      !("reviewStatus" in payload) ||
      payload.reviewStatus !== "NEEDS_INFORMATION" ||
      !("reviewReason" in payload) ||
      typeof payload.reviewReason !== "string" ||
      !payload.reviewReason.trim())
      return error("بازگشایی پرونده قابل تأیید نیست.", 503);

    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return error("بازگشایی پرونده تأیید نشد.", 503);
  }
}
