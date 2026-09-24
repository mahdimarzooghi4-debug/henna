import { NextRequest, NextResponse } from "next/server";
import {
  noStore,
  sessionCookieName,
} from "../../../../../lib/server-auth";
import {
  fetchOrganizationAllocationReadiness,
} from "../../../../../lib/server-organization-allocation";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

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
  if (request.nextUrl.searchParams.size !== 0)
    return error("این مسیر پارامتر query نمی‌پذیرد.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  const result = await fetchOrganizationAllocationReadiness(token);

  if (result.status === "ready")
    return NextResponse.json(result.data, { headers: noStore });
  if (result.status === "unauthenticated")
    return clearSession(
      error("نشست معتبر نیست؛ دوباره وارد شوید.", 401),
    );
  if (result.status === "forbidden")
    return error(
      "این حساب دسترسی فعال به آمادگی تخصیص سازمان ندارد.",
      403,
    );

  return error("وضعیت آمادگی تخصیص در دسترس نیست.", 503);
}
