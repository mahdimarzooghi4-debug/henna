import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  noStore,
  sessionCookieName,
} from "./server-auth";
import { parseAllocationShadowBenchmarks } from "./allocation-shadow-benchmarks";

export async function forwardAllocationShadowBenchmarks(request: NextRequest) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });

  if (request.method !== "GET")
    return fail("درخواست معتبر نیست.", 405);

  const page = request.nextUrl.searchParams.get("page") ?? "1";
  if (!/^\d{1,5}$/.test(page) || +page < 1 || +page > 10000)
    return fail("صفحه معتبر نیست.", 400);

  const fingerprint =
    request.nextUrl.searchParams.get("evaluationFingerprint");
  if (fingerprint !== null && !/^[0-9a-f]{64}$/i.test(fingerprint))
    return fail("شناسه ارزیابی معتبر نیست.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return fail("ابتدا وارد شوید.", 401);

  const query = new URLSearchParams({ page: String(+page) });
  if (fingerprint)
    query.set("evaluationFingerprint", fingerprint.toLowerCase());

  const target = hanaAuthApiUrl(
    `/api/v1/admin/allocation-proposals/research/shadow-benchmarks?${query}`,
  );
  if (!target) return fail("سرویس در دسترس نیست.", 503);

  try {
    const response = await fetch(target, {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "فیلتر benchmark معتبر نیست.",
        401: "دوباره وارد شوید.",
        403: "دسترسی مدیر لازم است.",
      };
      return fail(
        messages[response.status] ?? "دریافت benchmark ممکن نشد.",
        messages[response.status] ? response.status : 503,
      );
    }

    const payload: unknown = await response.json();
    const parsed = parseAllocationShadowBenchmarks(payload);
    if (!parsed)
      return fail("پاسخ benchmark قابل تأیید نیست.", 503);
    return NextResponse.json(parsed, { headers: noStore });
  } catch {
    return fail("دریافت benchmark ممکن نشد.", 503);
  }
}
