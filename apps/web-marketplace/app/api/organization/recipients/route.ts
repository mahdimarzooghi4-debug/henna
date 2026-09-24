import { NextRequest, NextResponse } from "next/server";
import {
  noStore,
  sessionCookieName,
} from "../../../../lib/server-auth";
import {
  parseOrganizationRecipientUrlQuery,
} from "../../../../lib/organization-recipients";
import {
  fetchOrganizationRecipients,
} from "../../../../lib/server-organization-recipients";

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

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

export async function GET(request: NextRequest) {
  const query =
    parseOrganizationRecipientUrlQuery(request.nextUrl.searchParams);
  if (!query)
    return error("فیلتر یا صفحه‌بندی مشمولان معتبر نیست.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  const result = await fetchOrganizationRecipients(token, query);

  if (result.status === "ready")
    return NextResponse.json(result.data, { headers: noStore });
  if (result.status === "unauthenticated")
    return clearSession(error("نشست معتبر نیست؛ دوباره وارد شوید.", 401));
  if (result.status === "forbidden")
    return error("این حساب دسترسی فعال به مشمولان سازمان ندارد.", 403);

  return error("فهرست افراد و مشمولان در دسترس نیست.", 503);
}
