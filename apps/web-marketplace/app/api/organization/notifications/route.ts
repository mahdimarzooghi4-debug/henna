import { NextRequest, NextResponse } from "next/server";
import { noStore, sessionCookieName } from "../../../../lib/server-auth";
import { fetchOrganizationNotifications } from "../../../../lib/server-organization-notifications";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.size !== 0)
    return error("این مسیر پارامتر query نمی‌پذیرد.", 400);
  const result = await fetchOrganizationNotifications(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (result.status === "ready")
    return NextResponse.json({ notifications: result.notifications }, { headers: noStore });
  if (result.status === "unauthenticated") {
    const response = error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    response.cookies.set(sessionCookieName, "", {
      path: "/", httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict", expires: new Date(0),
    });
    return response;
  }
  if (result.status === "forbidden")
    return error("دسترسی فعال به اعلان‌های سازمان ندارید.", 403);
  return error("اعلان‌های سازمان در دسترس نیست.", 503);
}
