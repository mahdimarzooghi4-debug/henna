import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hanaAuthApiUrl, isSameOrigin, noStore } from "../../../../lib/server-auth";
import {
  publicIntakeCookie, publicIntakeTokenPattern,
  validPublicIntakeReceipt,
} from "../../../../lib/public-seller-intake";

export const runtime = "nodejs";

const MAX_PUBLIC_INTAKE_BYTES = 8192;
class PublicIntakeBodyTooLargeError extends Error {}

async function readLimitedText(request: NextRequest): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", {fatal:true});
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_PUBLIC_INTAKE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new PublicIntakeBodyTooLargeError();
      }
      text += decoder.decode(value, {stream:true});
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function fail(message: string, status: number) {
  return NextResponse.json({message}, {status,headers:noStore});
}
function cookie(response: NextResponse, secret: string) {
  response.cookies.set(publicIntakeCookie, secret, {
    httpOnly: true, sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/seller/public-registration", // Only the submit and status BFF routes receive this session cookie.
  });
  return response;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("درخواست نامعتبر است.",403);
  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json")
    return fail("نوع درخواست معتبر نیست.",400);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PUBLIC_INTAKE_BYTES)
    return fail("حجم درخواست بیش از حد مجاز است.",413);

  const existing = request.cookies.get(publicIntakeCookie)?.value;
  const secret = existing && publicIntakeTokenPattern.test(existing)
    ? existing : randomBytes(32).toString("hex").toUpperCase();
  const target = hanaAuthApiUrl("/api/v1/seller/public-registration");
  if (!target) return fail("ثبت عمومی درخواست فعلاً به سرور متصل نیست.",503);

  let body: string;
  try {
    body = await readLimitedText(request);
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return fail("اطلاعات درخواست معتبر نیست.",400);
  } catch (error) {
    if (error instanceof PublicIntakeBodyTooLargeError)
      return fail("حجم درخواست بیش از حد مجاز است.",413);
    return fail("اطلاعات درخواست معتبر نیست.",400);
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "X-Hana-Seller-Intake-Token":secret,
      },
      body, cache:"no-store",signal:AbortSignal.timeout(10000),
    });
    if (upstream.status === 429)
      return cookie(fail("تعداد درخواست‌ها زیاد است؛ دوباره تلاش کنید.",429),secret);
    if (upstream.status === 409)
      return cookie(fail("برای این مرورگر درخواست متفاوتی قبلاً ثبت شده است.",409),secret);
    if (upstream.status === 400)
      return cookie(fail("اطلاعات درخواست کامل یا معتبر نیست.",400),secret);
    if (!upstream.ok)
      return cookie(fail("ثبت درخواست تأیید نشد؛ دوباره بررسی کنید.",503),secret);
    const payload:unknown = await upstream.json();
    if (!validPublicIntakeReceipt(payload))
      return cookie(fail("پاسخ ثبت درخواست معتبر نیست؛ وضعیت را بررسی کنید.",503),secret);
    return cookie(NextResponse.json({
      status:"RECEIVED",
      trackingCode: payload.trackingCode,
      submittedAtUtc:payload.submittedAtUtc,
    },{headers:noStore}),secret);
  } catch {
    // Keep the same credential after an ambiguous ACK; retries cannot create
    // a second application from this browser.
    return cookie(fail("پاسخ سرور نامشخص است؛ وضعیت را بررسی کنید.",503),secret);
  }
}
