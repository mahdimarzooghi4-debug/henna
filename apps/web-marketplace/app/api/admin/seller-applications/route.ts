import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName,
} from "../../../../lib/server-auth";
import {
  parseSellerApplicationPage, sellerReviewStatuses,
} from "../../../../lib/admin-seller-applications";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function integer(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max
    ? parsed : null;
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/json") ||
    Number(response.headers.get("content-length") ?? "0") > 512_000)
    throw new Error("Invalid Admin response");
  const body = await response.text();
  if (body.length > 512_000) throw new Error("Admin response too large");
  return JSON.parse(body) as unknown;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const allowed = new Set(["page", "pageSize", "reviewStatus"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1)
      return error("پارامترهای درخواست معتبر نیست.", 400);
  }

  const page = integer(params.get("page"), 1, 1, 10_000);
  const pageSize = integer(params.get("pageSize"), 20, 1, 50);
  const rawStatus = params.get("reviewStatus");
  const status = rawStatus?.trim().toUpperCase() ?? null;
  if (page === null || pageSize === null ||
    (status !== null && status !== "ALL" &&
      !(sellerReviewStatuses as readonly string[]).includes(status)))
    return error("فیلتر یا صفحه‌بندی معتبر نیست.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return error("برای مشاهدهٔ پرونده‌ها ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl("/api/v1/admin/seller-applications");
  if (!target) return error("فهرست پرونده‌ها فعلاً در دسترس نیست.", 503);
  target.searchParams.set("page", String(page));
  target.searchParams.set("pageSize", String(pageSize));
  if (status !== null) target.searchParams.set("reviewStatus", status);

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403)
      return error("دسترسی مدیریت برای این حساب فعال نیست.", 403);
    if (upstream.status !== 200)
      return error("فهرست پرونده‌ها فعلاً در دسترس نیست.", 503);
    const payload = parseSellerApplicationPage(
      await readJson(upstream), page, pageSize);
    if (!payload) return error("پاسخ فهرست پرونده‌ها قابل تأیید نیست.", 503);
    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return error("فهرست پرونده‌ها فعلاً در دسترس نیست.", 503);
  }
}
