import { NextRequest, NextResponse } from "next/server";
import {
  noStore,
  sessionCookieName,
} from "../../../../../lib/server-auth";
import {
  organizationProgramIdPattern,
} from "../../../../../lib/organization-programs";
import {
  fetchOrganizationProgramDetail,
} from "../../../../../lib/server-organization-programs";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.nextUrl.searchParams.size !== 0)
    return NextResponse.json(
      { message: "این مسیر پارامتر query نمی‌پذیرد." },
      { status: 400, headers: noStore },
    );

  const { id } = await params;
  if (!organizationProgramIdPattern.test(id))
    return NextResponse.json(
      { message: "طرح پیدا نشد." },
      { status: 404, headers: noStore },
    );

  const token = request.cookies.get(sessionCookieName)?.value;
  const result = await fetchOrganizationProgramDetail(token, id);

  if (result.status === "ready")
    return NextResponse.json(result.program, { headers: noStore });
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
  if (result.status === "not_found")
    return NextResponse.json(
      { message: "طرح پیدا نشد." },
      { status: 404, headers: noStore },
    );

  return NextResponse.json(
    { message: "جزئیات طرح سازمانی در دسترس نیست." },
    { status: 503, headers: noStore },
  );
}
