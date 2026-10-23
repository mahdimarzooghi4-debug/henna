import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "./server-auth";
import { parseHumanReviewInventory, parsePartitionPreflightPreview,
  validPartitionChoices } from "./seven-factor-partitions";

// No API model endpoint: only guarded human evidence inventory and a
// read-only manifest. Never return raw household data, labels or scores.
export async function forwardPartitionPreflight(request: NextRequest, preview: boolean) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });
  if (preview ? request.method !== "POST" : request.method !== "GET")
    return fail("درخواست معتبر نیست.", 405);
  if (preview && !isSameOrigin(request)) return fail("مبدأ درخواست معتبر نیست.", 403);
  if (!preview && [...request.nextUrl.searchParams.keys()].some(x => x !== "page"))
    return fail("فیلتر معتبر نیست.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return fail("ابتدا وارد شوید.", 401);

  let path = "/api/v1/admin/allocation-proposals/research/seven-factor/";
  let body: string | undefined;
  if (preview) {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return fail("درخواست معتبر نیست.", 400);
    const raw = await request.text().catch(() => "");
    if (!raw || raw.length > 24000) return fail("درخواست معتبر نیست.", 400);
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!validPartitionChoices(parsed)) return fail("سه بخش مستقل و زمان UTC معتبر لازم است.", 400);
      body = JSON.stringify(parsed);
    } catch { return fail("درخواست معتبر نیست.", 400); }
    path += "partition-preflight/preview";
  } else {
    const page = request.nextUrl.searchParams.get("page") ?? "1";
    if (!/^\d{1,5}$/.test(page) || +page < 1 || +page > 10000)
      return fail("صفحه معتبر نیست.", 400);
    path += "human-reviews?page=" + String(+page);
  }
  const url = hanaAuthApiUrl(path);
  if (!url) return fail("سرویس در دسترس نیست.", 503);
  try {
    const response = await fetch(url, {
      method: preview ? "POST" : "GET", body, cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(preview ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const message = response.status === 400
        ? "شواهد انتخاب‌شده ناسازگار، متعارض یا نامعتبرند؛ هیچ Dataset پذیرفته نشد."
        : response.status === 401 ? "نشست معتبر نیست."
        : response.status === 403 ? "دسترسی ادمین لازم است."
        : "پیش‌بررسی شواهد ممکن نشد.";
      return fail(message, [400, 401, 403].includes(response.status) ? response.status : 503);
    }
    const text = await response.text();
    if (text.length > 65536) return fail("پاسخ بیش از اندازه است.", 503);
    const parsed: unknown = JSON.parse(text);
    const validated = preview ? parsePartitionPreflightPreview(parsed) : parseHumanReviewInventory(parsed);
    if (!validated) return fail("پاسخ شواهد اعتبارسنجی نشد.", 503);
    return NextResponse.json(validated, { headers: noStore });
  } catch {
    return fail("ارتباط نامطمئن است؛ هیچ Dataset یا مدل جدیدی فعال نشده است.", 503);
  }
}
