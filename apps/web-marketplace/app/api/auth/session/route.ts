import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "../../../../lib/server-auth";

function clearSession(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: new Date(0),
  });
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return NextResponse.json({ authenticated: false },
      { status: 401, headers: noStore });

  const target = hanaAuthApiUrl("/api/v1/auth/session");
  if (!target)
    return NextResponse.json({ message: "خدمت هویت در دسترس نیست." },
      { status: 503, headers: noStore });
  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return clearSession(NextResponse.json({ authenticated: false },
        { status: 401, headers: noStore }));

    if (!upstream.ok)
      return NextResponse.json({ message: "خدمت هویت در دسترس نیست." },
        { status: 503, headers: noStore });

    const body: unknown = await upstream.json();
    if (!body || typeof body !== "object" ||
      !("accountId" in body) || typeof body.accountId !== "string")
      throw new Error("Invalid identity response");
    return NextResponse.json(
      { authenticated: true, accountId: body.accountId },
      { headers: noStore });
  } catch {
    return NextResponse.json({ message: "خدمت هویت در دسترس نیست." },
      { status: 503, headers: noStore });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json({ message: "درخواست نامعتبر است." },
      { status: 403, headers: noStore });

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return clearSession(NextResponse.json({ authenticated: false },
      { status: 401, headers: noStore }));

  const target = hanaAuthApiUrl("/api/v1/auth/session");
  if (!target)
    return NextResponse.json({ message: "خدمت هویت در دسترس نیست." },
      { status: 503, headers: noStore });

  try {
    const upstream = await fetch(target, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 204)
      return clearSession(new NextResponse(null,
        { status: 204, headers: noStore }));
    if (upstream.status === 401)
      return clearSession(NextResponse.json({ authenticated: false },
        { status: 401, headers: noStore }));
  } catch {
    // Keep cookie if upstream revocation outcome is unknown; retry is safe.
  }

  return NextResponse.json(
    { message: "خروج تأیید نشد؛ دوباره تلاش کنید." },
    { status: 503, headers: noStore });
}
