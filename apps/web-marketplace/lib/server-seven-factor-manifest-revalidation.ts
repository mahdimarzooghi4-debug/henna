import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore,
  sessionCookieName } from "./server-auth";
import {
  validPartitionRevalidationRequest, parsePartitionPreflightPreview,
  parsePartitionRevalidationResult,
} from "./seven-factor-partitions";

// Original preview is used only for response identity checks on the client,
// NOT trusted for backend verification. Backend always recomputes from real DB.
export async function forwardSevenFactorManifestRevalidation(request: NextRequest) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });
  if (request.method !== "POST") return fail("درخواست معتبر نیست.", 405);
  if (!isSameOrigin(request)) return fail("مبدأ درخواست معتبر نیست.", 403);
  if (request.nextUrl.search) return fail("پارامتر اضافی مجاز نیست.", 400);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return fail("نوع درخواست معتبر نیست.", 400);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return fail("ابتدا وارد شوید.", 401);
  const body = await request.text().catch(() => "");
  if (!body || body.length > 24000) return fail("درخواست بیش از اندازه است.", 400);
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return fail("درخواست معتبر نیست.", 400); }
  if (!validPartitionRevalidationRequest(raw))
    return fail("انتخاب دقیق قبلی، cutoff و SHA-256 معتبر لازم است.", 400);
  const target = hanaAuthApiUrl(
    "/api/v1/admin/allocation-proposals/research/seven-factor/partition-preflight/revalidate");
  if (!target) return fail("سرویس در دسترس نیست.", 503);
  try {
    const response = await fetch(target, {
      method: "POST", cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(raw), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return fail(response.status === 409
      ? "شواهد یا اثرانگشت تغییر کرده‌اند؛ پیش‌بررسی قبلی معتبر نیست."
      : response.status === 401 ? "نشست معتبر نیست."
      : response.status === 403 ? "دسترسی ادمین لازم است."
      : response.status === 400 ? "انتخاب یا نسب‌نامه فعلی معتبر نیست."
      : "بازاعتبارسنجی منبع داده ممکن نشد.",
      [400, 401, 403, 409].includes(response.status) ? response.status : 503);
    const data = await response.text();
    if (data.length > 12000) return fail("پاسخ بیش از اندازه است.", 503);
    const result: unknown = JSON.parse(data);
    // Reject positive admission/activation, forged digest, stale or
    // malformed response while only exposing technical metadata.
    if (!validServerResult(result, raw))
      return fail("شواهد بازبینی به انتخاب قبلی منطبق نیست.", 503);
    return NextResponse.json(result, { headers: noStore });
  } catch {
    return fail("پاسخ نامطمئن است؛ هیچ Dataset یا مدلی پذیرفته نشده.", 503);
  }
}

function validServerResult(
  raw: unknown, request: {
    expectedSha256: string; trainingReviewIds: string[];
    validationReviewIds: string[]; evaluationReviewIds: string[];
    cutoffUtc: string;
  },
): boolean {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return false;
  const r = raw as Record<string, unknown>;
  const preview = parsePartitionPreflightPreview({
    contractVersion: "HENNA-SEVEN-FACTOR-HUMAN-PARTITION-PREFLIGHT-v1",
    cutoffUtc: r.cutoffUtc,
    sourceFormulaVersion: r.sourceFormulaVersion,
    sourceDatasetVersion: r.sourceDatasetVersion,
    sourceInstructionReference: r.sourceInstructionReference,
    trainingCount: r.trainingCount,
    validationCount: r.validationCount,
    evaluationCount: r.evaluationCount,
    sha256: request.expectedSha256,
    admissionStatus: "NOT_ADMITTED_COMPLETE_RUBRIC_AND_EVALUATION_GOVERNANCE_REQUIRED",
    active: false, admitted: false, runtimeApplied: false,
  });
  return !!preview && !!parsePartitionRevalidationResult(raw, request, preview);
}
