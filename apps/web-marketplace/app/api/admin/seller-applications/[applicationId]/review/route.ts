import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName,
} from "../../../../../../lib/server-auth";
import {
  parseSellerReviewResult, validSellerApplicationId,
} from "../../../../../../lib/admin-seller-applications";

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  if (!isSameOrigin(request))
    return error("درخواست نامعتبر است.", 403);
  const { applicationId } = await context.params;
  if (!validSellerApplicationId(applicationId))
    return error("پرونده پیدا نشد.", 404);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return error("برای ثبت تصمیم ابتدا وارد شوید.", 401);
  if (!request.headers.get("content-type")?.toLowerCase()
    .startsWith("application/json"))
    return error("درخواست معتبر نیست.", 400);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(idempotencyKey) ||
    idempotencyKey === "00000000-0000-0000-0000-000000000000")
    return error("کلید یکتای درخواست معتبر نیست.", 400);

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return error("درخواست معتبر نیست.", 400);
    body = JSON.parse(raw) as unknown;
  } catch {
    return error("درخواست معتبر نیست.", 400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body))
    return error("درخواست معتبر نیست.", 400);
  const input = body as Record<string, unknown>;
  const keys = Object.keys(input);
  const decision = typeof input.decision === "string"
    ? input.decision.trim().toUpperCase() : "";
  const rawReason = input.reason === undefined ? null : input.reason;
  const reason = typeof rawReason === "string" ? rawReason.trim() : rawReason;
  if (keys.some(key => !["revision", "decision", "reason"].includes(key)) ||
    !keys.includes("revision") || !keys.includes("decision") ||
    !Number.isSafeInteger(input.revision) ||
    (input.revision as number) < 1 ||
    (input.revision as number) >= 2_147_483_647 ||
    !(decision === "NEEDS_INFORMATION" || decision === "APPROVED" ||
      decision === "REJECTED") ||
    !(reason === null || (typeof reason === "string" &&
      reason.length > 0 && reason.length <= 500 &&
      !/[\u0000-\u001f\u007f-\u009f]/.test(reason))) ||
    ((decision === "NEEDS_INFORMATION" || decision === "REJECTED") &&
      typeof reason !== "string"))
    return error("نتیجه، نسخه یا دلیل بررسی معتبر نیست.", 400);

  const target = hanaAuthApiUrl(
    `/api/v1/admin/seller-applications/${applicationId}/review`);
  if (!target) return error("ثبت تصمیم بررسی نشد.", 503);
  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ revision: input.revision, decision, reason }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403)
      return error("دسترسی مدیریت برای این حساب فعال نیست.", 403);
    if (upstream.status === 400)
      return error("نتیجه، نسخه یا دلیل بررسی معتبر نیست.", 400);
    if (upstream.status === 404)
      return error("پرونده پیدا نشد.", 404);
    if (upstream.status === 409)
      return error("پرونده تغییر کرده است؛ وضعیت تازه را دریافت کنید.", 409);
    if (upstream.status !== 200)
      return error("ثبت تصمیم بررسی نشد.", 503);
    const result = parseSellerReviewResult(
      await readJson(upstream), applicationId, input.revision as number);
    if (!result) return error("پاسخ تصمیم قابل تأیید نیست.", 503);
    return NextResponse.json(result, { headers: noStore });
  } catch {
    return error("ثبت تصمیم بررسی نشد.", 503);
  }
}
