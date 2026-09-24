import { NextRequest, NextResponse } from "next/server";
import {
  noStore,
  sessionCookieName,
} from "../../../../lib/server-auth";
import {
  parseOrganizationProgramUrlQuery,
} from "../../../../lib/organization-programs";
import {
  fetchOrganizationPrograms,
} from "../../../../lib/server-organization-programs";

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
  const query = parseOrganizationProgramUrlQuery(request.nextUrl.searchParams);
  if (!query)
    return NextResponse.json(
      { message: "فیلتر یا صفحه‌بندی معتبر نیست." },
      { status: 400, headers: noStore },
    );

  const token = request.cookies.get(sessionCookieName)?.value;
  const result = await fetchOrganizationPrograms(token, query);

  if (result.status === "ready")
    return NextResponse.json(result.data, { headers: noStore });
  if (result.status === "unauthenticated")
    return clearSession(NextResponse.json(
      { message: "نشست معتبر نیست؛ دوباره وارد شوید." },
      { status: 401, headers: noStore },
    ));
  if (result.status === "forbidden")
    return NextResponse.json(
      { message: "این حساب دسترسی فعال به طرح‌های سازمانی ندارد." },
      { status: 403, headers: noStore },
    );

  return NextResponse.json(
    { message: "فهرست طرح‌های سازمانی در دسترس نیست." },
    { status: 503, headers: noStore },
  );
}
