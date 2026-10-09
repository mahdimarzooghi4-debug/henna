import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "./server-auth";
import { parseProposalDetail, parseProposalList, proposalId } from "./allocation-proposals";

export async function forwardProposal(request: NextRequest, id?: string, review = false) {
  const fail = (message: string, status: number) => NextResponse.json({ message }, { status, headers: noStore });
  if (id !== undefined && !proposalId(id)) return fail("شناسه پیشنهاد معتبر نیست.", 400);
  if (review && !isSameOrigin(request)) return fail("درخواست معتبر نیست.", 403);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return fail("برای دسترسی ابتدا وارد شوید.", 401);
  let body: string | undefined;
  if (review) {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("درخواست معتبر نیست.", 400);
    try {
      const input: unknown = await request.json();
      if (!input || typeof input !== "object" || !("decision" in input) || !("reason" in input) ||
        !["APPROVED", "REJECTED"].includes(String(input.decision)) || typeof input.reason !== "string" ||
        !input.reason.trim() || input.reason.length > 2000) return fail("تصمیم و دلیل معتبر لازم است.", 400);
      body = JSON.stringify({ decision: input.decision, reason: input.reason.trim() });
    } catch { return fail("درخواست معتبر نیست.", 400); }
  }
  const page = request.nextUrl.searchParams.get("page") ?? "1";
  if (!id && (!/^\d{1,5}$/.test(page) || Number(page) < 1 || Number(page) > 10000)) return fail("صفحه معتبر نیست.", 400);
  const path = "/api/v1/admin/allocation-proposals" + (id ? `/${id}${review ? "/review" : ""}` : `?page=${Number(page)}&pageSize=20`);
  const target = hanaAuthApiUrl(path);
  if (!target) return fail("سرویس بررسی پیشنهادها در دسترس نیست.", 503);
  try {
    const upstream = await fetch(target, { method: review ? "POST" : "GET", body,
      headers: { Authorization: `Bearer ${token}`, ...(review ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!upstream.ok) {
      const messages: Record<number, string> = { 401: "نشست معتبر نیست؛ دوباره وارد شوید.", 403: "این صفحه فقط برای مدیر مجاز است.",
        404: "پیشنهاد پیدا نشد.", 409: "پیشنهاد قبلاً بررسی شده یا بررسی توسط پیشنهاددهنده مجاز نیست.", 400: "اطلاعات ارسال‌شده معتبر نیست." };
      return fail(messages[upstream.status] ?? "سرویس بررسی پیشنهادها در دسترس نیست.", messages[upstream.status] ? upstream.status : 503);
    }
    const payload: unknown = await upstream.json();
    if (review) {
      if (!payload || typeof payload !== "object" || !("id" in payload) || payload.id !== id ||
        !("active" in payload) || payload.active !== false || !("status" in payload) ||
        !["APPROVED", "REJECTED"].includes(String(payload.status))) return fail("پاسخ قابل تأیید نیست.", 503);
    } else if (!(id ? parseProposalDetail(payload) : parseProposalList(payload))) return fail("پاسخ قابل تأیید نیست.", 503);
    return NextResponse.json(payload, { headers: noStore });
  } catch { return fail("سرویس بررسی پیشنهادها در دسترس نیست.", 503); }
}
