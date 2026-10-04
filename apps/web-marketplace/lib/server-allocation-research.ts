import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "./server-auth";
import { parseAssessmentInput } from "./allocation-assessment";
import { parseTrainingRuns, parseTrainingRunDetail } from "./allocation-training-runs";
import { proposalId } from "./allocation-proposals";

export async function forwardResearch(request: NextRequest, operation: "assessments" | "labels" | "train" | "runs", id?: string) {
  const fail = (message: string, status: number) => NextResponse.json({ message }, { status, headers: noStore });
  const write = request.method === "POST";
  if (operation === "runs" && write || id !== undefined && (operation !== "runs" || !proposalId(id))) return fail("درخواست معتبر نیست.",400);
  if (write && !isSameOrigin(request)) return fail("درخواست معتبر نیست.", 403);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return fail("ابتدا وارد شوید.", 401);
  let body: string | undefined, query = "";
  if (write) {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return fail("درخواست معتبر نیست.", 400);
    try {
      const input = await request.json();
      if (operation === "assessments") {
        const assessment = parseAssessmentInput(input);
        if (!assessment) return fail("شناسه‌ها، امتیازها، تاریخ و مرجع سند معتبر لازم است.", 400);
        body = JSON.stringify(assessment);
      } else if (operation === "labels") {
        if (!proposalId(input.snapshotId) || typeof input.needScore !== "number" || !Number.isFinite(input.needScore) ||
          input.needScore < 0 || input.needScore > 1 || typeof input.rubricVersion !== "string" ||
          !input.rubricVersion.trim() || input.rubricVersion.length > 120 || ![1, 2].includes(input.partition)) return fail("امتیاز و معیار معتبر لازم است.", 400);
        body = JSON.stringify({ snapshotId: input.snapshotId, needScore: input.needScore, rubricVersion: input.rubricVersion.trim(), partition: input.partition });
      } else {
        if (!Array.isArray(input.labelIds) || input.labelIds.length < 40 || input.labelIds.length > 500 ||
          !input.labelIds.every(proposalId) || new Set(input.labelIds).size !== input.labelIds.length ||
          !Number.isSafeInteger(input.poolRial) || input.poolRial <= 0) return fail("حداقل ۴۰ امتیاز و مبلغ معتبر لازم است.", 400);
        // Cutoff is issued on the server; client cannot request future labels.
        body = JSON.stringify({ labelIds: input.labelIds, poolRial: input.poolRial, cutoffUtc: new Date().toISOString() });
      }
    } catch { return fail("درخواست معتبر نیست.", 400); }
  } else if (id) {
    query = `/${id}`;
  } else if (operation === "assessments" || operation === "runs") {
    const page = request.nextUrl.searchParams.get("page") ?? "1";
    if (!/^\d{1,5}$/.test(page) || +page < 1 || +page > 10000) return fail("صفحه معتبر نیست.", 400);
    query = `?page=${+page}`;
  } else {
    const rubric = request.nextUrl.searchParams.get("rubricVersion") ?? "";
    if (!rubric.trim() || rubric.length > 120) return fail("نسخه معیار لازم است.", 400);
    query = `?rubricVersion=${encodeURIComponent(rubric.trim())}`;
  }
  const target = hanaAuthApiUrl(`/api/v1/admin/allocation-proposals/research/${operation}${query}`);
  if (!target) return fail("سرویس در دسترس نیست.", 503);
  try {
    const response = await fetch(target, { method: write ? "POST" : "GET", body, cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, ...(write ? { "Content-Type": "application/json" } : {}) }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      const messages: Record<number, string> = { 400: "داده‌ها یا تقسیم آموزش و ارزیابی معتبر نیستند.", 401: "دوباره وارد شوید.", 403: "دسترسی مدیر لازم است.", 404: "سابقه اجرا پیدا نشد.", 409: "این ارزیابی، امتیاز یا پیشنهاد قبلاً ثبت شده است؛ داده قبلی بازنویسی نمی‌شود." };
      return fail(messages[response.status] ?? "اجرای درخواست ممکن نشد.", messages[response.status] ? response.status : 503);
    }
    const payload = await response.json();
    if (!payload || payload.active !== false || (!write && !id && !Array.isArray(payload.items)) || (write && !proposalId(payload.id))) return fail("پاسخ معتبر نیست.", 503);
    if (operation === "runs" && !(id ? parseTrainingRunDetail(payload) : parseTrainingRuns(payload))) return fail("گزارش معتبر نیست.", 503);
    return NextResponse.json(payload, { headers: noStore });
  } catch { return fail("اجرای درخواست ممکن نشد؛ پیش از تکرار، نتیجه ثبت‌شده را بررسی کنید.", 503); }
}
