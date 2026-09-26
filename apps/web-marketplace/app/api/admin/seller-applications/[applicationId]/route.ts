import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName,
} from "../../../../../lib/server-auth";
import {
  parseSellerApplicationDetail, validSellerApplicationId,
} from "../../../../../lib/admin-seller-applications";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/json") ||
    Number(response.headers.get("content-length") ?? "0") > 512_000)
    throw new Error("Invalid Admin response");
  const body = await response.text();
  if (body.length > 512_000) throw new Error("Admin response too large");
  return JSON.parse(body) as unknown;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  if (request.nextUrl.search)
    return error("پارامتر اضافی معتبر نیست.", 400);
  const { applicationId } = await context.params;
  if (!validSellerApplicationId(applicationId))
    return error("پرونده پیدا نشد.", 404);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return error("برای مشاهدهٔ پرونده ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl(
    "/api/v1/admin/seller-applications/" + applicationId);
  if (!target) return error("پرونده فعلاً در دسترس نیست.", 503);

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403)
      return error("دسترسی مدیریت برای این حساب فعال نیست.", 403);
    if (upstream.status === 404)
      return error("پرونده پیدا نشد.", 404);
    if (upstream.status !== 200)
      return error("پرونده فعلاً در دسترس نیست.", 503);
    const payload = parseSellerApplicationDetail(await readJson(upstream));
    if (!payload) return error("پاسخ پرونده قابل تأیید نیست.", 503);
    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return error("پرونده فعلاً در دسترس نیست.", 503);
  }
}
