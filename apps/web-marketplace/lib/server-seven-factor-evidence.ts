import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "./server-auth";
import { parseSevenFactorInventory, parseSevenFactorPreview, uuidPattern } from "./seven-factor-evidence";

/** Authenticated ADMIN-only BFF. Backend independently authenticates and authorizes.
 * Requests and replies contain no household IDs, amounts, or reviewed features.
 * The POST is a *read-only* digest preview, never Dataset admission.
 */
export async function forwardSevenFactorEvidence(request: NextRequest, preview: boolean) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });
  if (preview ? request.method !== "POST" : request.method !== "GET")
    return fail("درخواست معتبر نیست.", 405);
  if (preview && !isSameOrigin(request)) return fail("مبدأ درخواست معتبر نیست.", 403);
  if (!preview && [...request.nextUrl.searchParams.keys()].some(x => x !== "page"))
    return fail("فیلتر معتبر نیست.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return fail("ابتدا وارد شوید.", 401);
  let body: string | undefined;
  const base = "/api/v1/admin/allocation-proposals/research/seven-factor/review-inventory";
  let path = base;
  if (preview) {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return fail("درخواست معتبر نیست.", 400);
    const raw = await request.text().catch(() => "");
    if (!raw || raw.length > 22000) return fail("درخواست معتبر نیست.", 400);
    try {
      const parsed: unknown = JSON.parse(raw);
      const x = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown> : null;
      const ids = x?.reviewIds;
      const utc = x?.cutoffUtc;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 500 ||
          !ids.every(y => typeof y === "string" && uuidPattern.test(y)) ||
          new Set(ids).size !== ids.length ||
          typeof utc !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(utc) ||
          Number.isNaN(Date.parse(utc)) || Date.parse(utc) > Date.now() ||
          Object.keys(x!).some(k => k !== "reviewIds" && k !== "cutoffUtc"))
        return fail("شناسه‌های بررسی و تاریخ UTC معتبر لازم است.", 400);
      body = JSON.stringify({ reviewIds: ids, cutoffUtc: utc });
      path += "/preview";
    } catch {
      return fail("درخواست معتبر نیست.", 400);
    }
  } else {
    const page = request.nextUrl.searchParams.get("page") ?? "1";
    if (!/^\d{1,5}$/.test(page) || +page < 1 || +page > 10000)
      return fail("صفحه معتبر نیست.", 400);
    path += "?page=" + String(+page);
  }
  const url = hanaAuthApiUrl(path);
  if (!url) return fail("سرویس در دسترس نیست.", 503);
  try {
    const upstream = await fetch(url, {
      method: preview ? "POST" : "GET", body, cache: "no-store",
      headers: { Authorization: `Bearer ${token}`,
        ...(preview ? { "Content-Type": "application/json" } : {}) },
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      const message = upstream.status === 400 ? "انتخاب شواهد ناسازگار یا نامعتبر است؛ نتیجه‌ای پذیرفته نشد." :
        upstream.status === 401 ? "نشست معتبر نیست." :
        upstream.status === 403 ? "دسترسی ادمین لازم است." :
        "دریافت شواهد ناموفق بود.";
      return fail(message, [400,401,403].includes(upstream.status) ? upstream.status : 503);
    }
    const responseText = await upstream.text();
    if (responseText.length > 65536) return fail("پاسخ بیش از اندازه است.", 503);
    const decoded: unknown = JSON.parse(responseText);
    const parsed = preview ? parseSevenFactorPreview(decoded) : parseSevenFactorInventory(decoded);
    if (!parsed) return fail("شواهد معتبر قابل تأیید نیستند.", 503);
    return NextResponse.json(parsed, { headers: noStore });
  } catch {
    return fail("دریافت شواهد ناموفق بود.", 503);
  }
}
