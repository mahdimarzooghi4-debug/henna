import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName } from "./server-auth";
import { parseModelArtifactInventory } from "./model-artifact-inventory";

export async function forwardModelArtifactInventory(request: NextRequest) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });
  if (request.method !== "GET" ||
      [...request.nextUrl.searchParams.keys()].some(k => k !== "page"))
    return fail("درخواست معتبر نیست.", 400);
  const page = request.nextUrl.searchParams.get("page") ?? "1";
  if (!/^\d{1,5}$/.test(page) || +page < 1 || +page > 10000)
    return fail("صفحه معتبر نیست.", 400);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return fail("ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl(
    "/api/v1/admin/allocation-proposals/research/model-artifacts?page=" + String(+page));
  if (!target) return fail("سرویس در دسترس نیست.", 503);
  try {
    const res = await fetch(target, {
      method: "GET", cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return fail(res.status === 403 ? "دسترسی ادمین لازم است." :
      res.status === 401 ? "نشست معتبر نیست." : "دفتر آثار در دسترس نیست.",
      [401, 403].includes(res.status) ? res.status : 503);
    const body = await res.text();
    if (body.length > 20000) return fail("پاسخ بیش از اندازه است.", 503);
    const parsed = parseModelArtifactInventory(JSON.parse(body));
    if (!parsed || parsed.page !== +page)
      return fail("دفتر آثار قابل اعتبارسنجی نیست.", 503);
    return NextResponse.json(parsed, { headers: noStore });
  } catch {
    return fail("ارتباط نامطمئن است؛ هیچ مدل جدیدی ثبت یا فعال نشد.", 503);
  }
}
