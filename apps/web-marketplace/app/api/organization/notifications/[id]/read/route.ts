import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName,
} from "../../../../../../lib/server-auth";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  if (request.nextUrl.searchParams.size !== 0 ||
      ![null, "0"].includes(request.headers.get("content-length")) ||
      request.headers.get("transfer-encoding") !== null)
    return error("این مسیر پارامتر یا بدنه نمی‌پذیرد.", 400);
  const { id } = await params;
  if (!uuid.test(id)) return error("اعلان پیدا نشد.", 404);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return error("برای مشاهده اعلان‌ها وارد شوید.", 401);
  const target = hanaAuthApiUrl(
    "/api/v1/organization/notifications/" + encodeURIComponent(id) + "/read",
  );
  if (!target) return error("سرویس اعلان‌ها در دسترس نیست.", 503);
  try {
    const upstream = await fetch(target, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 204)
      return new NextResponse(null, { status: 204, headers: noStore });
    if (upstream.status === 401) {
      const response = error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
      response.cookies.set(sessionCookieName, "", {
        path: "/", httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", expires: new Date(0),
      });
      return response;
    }
    if (upstream.status === 403) return error("دسترسی سازمانی فعال نیست.", 403);
    if (upstream.status === 404) return error("اعلان پیدا نشد.", 404);
    return error("ثبت وضعیت اعلان در دسترس نیست.", 503);
  } catch { return error("ثبت وضعیت اعلان در دسترس نیست.", 503); }
}
