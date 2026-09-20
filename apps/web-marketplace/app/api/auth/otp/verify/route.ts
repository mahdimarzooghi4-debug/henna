import { NextRequest, NextResponse } from "next/server";
import { normalizeDigits } from "../../../../../lib/normalize-digits";
import {
  accessTokenPattern,
  challengeIdPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "../../../../../lib/server-auth";

const unavailable = "تأیید کد در دسترس نیست؛ لطفاً بعداً دوباره تلاش کنید.";

export async function POST(request: NextRequest) {
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

  if (!input || typeof input !== "object")
    return NextResponse.json({ message: "درخواست نامعتبر است." },
      { status: 400, headers: noStore });

  const payload = input as Record<string, unknown>;
  const phone = typeof payload.phone === "string"
    ? normalizeDigits(payload.phone.trim()) : "";
  const code = typeof payload.code === "string"
    ? normalizeDigits(payload.code.trim()) : "";
  const challengeId = typeof payload.challengeId === "string"
    ? payload.challengeId : "";
  if (!/^09\d{9}$/.test(phone) || !/^\d{6}$/.test(code) ||
    !challengeIdPattern.test(challengeId))
    return NextResponse.json({ message: "اطلاعات تأیید معتبر نیست." },
      { status: 400, headers: noStore });

  const target = hanaAuthApiUrl("/api/v1/auth/otp/verify");
  if (!target)
    return NextResponse.json({ message: unavailable },
      { status: 503, headers: noStore });

  try {
    const result = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, challengeId }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (result.status !== 200) {
      const status = [400, 401, 429].includes(result.status)
        ? result.status : 503;
      const message = status === 401
        ? "کد یا اطلاعات تأیید معتبر نیست."
        : status === 429
          ? "تعداد تلاش‌ها زیاد است؛ بعداً دوباره تلاش کنید."
          : status === 400
            ? "اطلاعات تأیید معتبر نیست."
            : unavailable;
      return NextResponse.json({ message }, { status, headers: noStore });
    }

    const responseBody: unknown = await result.json();
    if (!responseBody || typeof responseBody !== "object")
      throw new Error("Invalid upstream response");
    const data = responseBody as Record<string, unknown>;
    const token = data.accessToken;
    const expiry = data.expiresAtUtc;
    const accountId = data.accountId;
    const expiresAt = typeof expiry === "string" ? Date.parse(expiry) : NaN;
    const age = Math.floor((expiresAt - Date.now()) / 1000);

    if (typeof token !== "string" || !accessTokenPattern.test(token) ||
      data.tokenType !== "Bearer" ||
      typeof accountId !== "string" ||
      !challengeIdPattern.test(accountId) ||
      !Number.isFinite(age) || age < 1 || age > 86_400)
      throw new Error("Incomplete upstream session");

    const response = NextResponse.json(
      { authenticated: true, accountId }, { headers: noStore });
    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: age,
      priority: "high",
    });
    return response;
  } catch {
    // The token is never returned in JSON, URL, or client-side storage.
    return NextResponse.json({ message: unavailable },
      { status: 503, headers: noStore });
  }
}
