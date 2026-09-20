import { NextResponse } from "next/server";
import { normalizeDigits } from "../../../../../lib/normalize-digits";
import { challengeIdPattern, hanaAuthApiUrl, isSameOrigin, noStore } from "../../../../../lib/server-auth";

const unavailable = "سرویس ارسال کد تأیید در دسترس نیست؛ کدی ارسال نشد.";

export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return NextResponse.json({ message: "درخواست نامعتبر است." },
      { status: 403, headers: noStore });

  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({ message: "درخواست نامعتبر است." },
      { status: 400, headers: noStore });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: "درخواست نامعتبر است." },
      { status: 400, headers: noStore });
  }

  const rawPhone =
    input !== null &&
    typeof input === "object" &&
    "phone" in input &&
    typeof input.phone === "string"
      ? input.phone
      : "";
  const phone = normalizeDigits(rawPhone.trim());
  if (!/^09\d{9}$/.test(phone))
    return NextResponse.json({ message: "شماره موبایل معتبر نیست." },
      { status: 400, headers: noStore });

  const target = hanaAuthApiUrl("/api/v1/auth/otp/request");
  if (!target)
    return NextResponse.json({ message: unavailable },
      { status: 503, headers: noStore });

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (response.status === 202) {
      const body: unknown = await response.json();
      const challengeId =
        body && typeof body === "object" && "challengeId" in body &&
        typeof body.challengeId === "string" ? body.challengeId : null;
      if (challengeId && challengeIdPattern.test(challengeId))
        return NextResponse.json(
          { message: "درخواست ارسال کد تأیید پذیرفته شد.", challengeId },
          { status: 202, headers: noStore });
      // A malformed response from a provider must NEVER be treated as sent.
      return NextResponse.json({ message: unavailable },
        { status: 503, headers: noStore });
    }

    const status = [400, 429].includes(response.status) ? response.status : 503;
    const message = status === 400
      ? "شماره موبایل معتبر نیست."
      : status === 429
        ? "تعداد درخواست‌ها زیاد است؛ بعداً دوباره تلاش کنید."
        : unavailable;
    return NextResponse.json(
      { message },
      { status, headers: noStore },
    );
  } catch {
    // Do not leak upstream implementation details or phone to the browser.
    return NextResponse.json({ message: unavailable },
      { status: 503, headers: noStore });
  }
}
