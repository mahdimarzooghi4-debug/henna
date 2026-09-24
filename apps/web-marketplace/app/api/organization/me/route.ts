import { NextRequest, NextResponse } from "next/server";
import {
  noStore,
  sessionCookieName,
} from "../../../../lib/server-auth";
import { fetchOrganizationProfile } from "../../../../lib/server-organization";

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
  const result = await fetchOrganizationProfile(token);

  if (result.status === "ready")
    return NextResponse.json(result.profile, { headers: noStore });

  if (result.status === "unauthenticated")
    return clearSession(NextResponse.json(
      { message: "نشست معتبر نیست؛ دوباره وارد شوید." },
      { status: 401, headers: noStore },
    ));

  if (result.status === "forbidden")
    return NextResponse.json(
      { message: "این حساب دسترسی فعال به پرتال سازمانی ندارد." },
      { status: 403, headers: noStore },
    );

  return NextResponse.json(
    { message: "اطلاعات سازمان در دسترس نیست." },
    { status: 503, headers: noStore },
  );
}
