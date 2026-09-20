import { NextResponse } from "next/server";
import { normalizeDigits } from "../../../../../lib/normalize-digits";

const unavailable = "سرویس ارسال کد تأیید در دسترس نیست؛ کدی ارسال نشد.";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { message: "درخواست نامعتبر است." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rawPhone =
    input !== null &&
    typeof input === "object" &&
    "phone" in input &&
    typeof input.phone === "string"
      ? input.phone
      : "";
  const phone = normalizeDigits(rawPhone.trim());
  if (!/^09\d{9}$/.test(phone)) {
    return NextResponse.json(
      { message: "شماره موبایل معتبر نیست." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const apiBase = process.env.HANA_API_BASE_URL?.trim();
  if (!apiBase) {
    return NextResponse.json(
      { message: unavailable },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const target = new URL("/api/v1/auth/otp/request", apiBase);
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    const status = [202, 400, 429].includes(response.status) ? response.status : 503;
    const message =
      status === 202
        ? "درخواست ارسال کد تأیید پذیرفته شد."
        : status === 400
          ? "شماره موبایل معتبر نیست."
          : status === 429
            ? "تعداد درخواست‌ها زیاد است؛ بعداً دوباره تلاش کنید."
            : unavailable;
    return NextResponse.json(
      { message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Do not leak upstream implementation details or the phone to the client.
    return NextResponse.json(
      { message: unavailable },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
