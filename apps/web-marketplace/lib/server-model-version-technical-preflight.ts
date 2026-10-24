import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName } from "./server-auth";
import { parseModelVersionTechnicalPreflight, validTechnicalSelection } from
  "./model-version-technical-preflight";

export async function forwardModelVersionTechnicalPreflight(request: NextRequest) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });
  if (request.method !== "POST") return fail("درخواست معتبر نیست.", 405);
  if (!isSameOrigin(request)) return fail("مبدأ درخواست معتبر نیست.", 403);
  if (request.nextUrl.search) return fail("پارامتر اضافی مجاز نیست.", 400);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return fail("نوع درخواست معتبر نیست.", 400);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return fail("ابتدا وارد شوید.", 401);
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > 1000) return fail("درخواست بیش از اندازه است.", 400);
  let selected: unknown;
  try { selected = JSON.parse(raw); } catch { return fail("درخواست معتبر نیست.", 400); }
  if (!validTechnicalSelection(selected))
    return fail("انتخاب صریح اثر و ارزیابی معتبر لازم است.", 400);
  const upstream = hanaAuthApiUrl(
    "/api/v1/admin/allocation-proposals/research/model-version-technical-preflight/preview");
  if (!upstream) return fail("سرویس در دسترس نیست.", 503);
  try {
    const response = await fetch(upstream, {
      method: "POST", cache: "no-store", body: JSON.stringify(selected),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return fail(response.status === 403 ? "دسترسی ادمین لازم است." :
      response.status === 401 ? "نشست معتبر نیست." :
      response.status === 400 ? "اثر یا ارزیابی انتخاب‌شده ناسازگار است." :
      "بازبینی نسخه مدل ممکن نشد.",
      [400, 401, 403].includes(response.status) ? response.status : 503);
    const body = await response.text();
    if (body.length > 10000) return fail("پاسخ بیش از اندازه است.", 503);
    const verified = parseModelVersionTechnicalPreflight(JSON.parse(body), selected);
    if (!verified) return fail("پاسخ پیش‌بررسی معتبر نیست.", 503);
    return NextResponse.json(verified, { headers: noStore });
  } catch {
    return fail("ارتباط نامطمئن است؛ هیچ مدلی ثبت یا فعال نشده است.", 503);
  }
}
