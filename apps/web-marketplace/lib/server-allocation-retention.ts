import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "./server-auth";
import {
  parseAllocationRetentionEvents,
  parseAllocationRetentionPreview,
  parseAllocationRetentionResult,
  validAllocationRetentionCutoff,
  validAllocationRetentionDigest,
} from "./allocation-retention";

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Operation = "preview" | "purge" | "events";

export async function forwardAllocationRetention(
  request: NextRequest,
  operation: Operation,
) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });
  const write = operation === "purge";
  if (write && !isSameOrigin(request))
    return fail("درخواست معتبر نیست.", 403);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return fail("ابتدا وارد شوید.", 401);

  let path: string;
  let body: string | undefined;
  let idempotencyKey: string | null = null;

  if (operation === "preview") {
    const cutoffUtc = request.nextUrl.searchParams.get("cutoffUtc") ?? "";
    if (!validAllocationRetentionCutoff(cutoffUtc))
      return fail("زمان cutoff معتبر لازم است.", 400);
    path = "/api/v1/admin/allocation-proposals/research/retention/preview?cutoffUtc=" +
      encodeURIComponent(cutoffUtc);
  } else if (operation === "events") {
    const page = request.nextUrl.searchParams.get("page") ?? "1";
    if (!/^\d{1,5}$/.test(page) || Number(page) < 1 || Number(page) > 10000)
      return fail("صفحه معتبر نیست.", 400);
    path = "/api/v1/admin/allocation-proposals/research/retention/events?page=" +
      Number(page);
  } else {
    idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey || !uuidV4.test(idempotencyKey))
      return fail("کلید حذف retention معتبر نیست.", 400);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return fail("درخواست معتبر نیست.", 400);

    try {
      const input: unknown = await request.json();
      if (!input || typeof input !== "object" || Array.isArray(input))
        return fail("درخواست معتبر نیست.", 400);
      const row = input as Record<string, unknown>;
      const keys = Object.keys(row).sort();
      if (keys.join("|") !== "cutoffUtc|previewDigest|reason" ||
          typeof row.cutoffUtc !== "string" ||
          !validAllocationRetentionCutoff(row.cutoffUtc) ||
          typeof row.previewDigest !== "string" ||
          !validAllocationRetentionDigest(row.previewDigest) ||
          typeof row.reason !== "string" ||
          !row.reason.trim() ||
          row.reason.length > 2000)
        return fail("cutoff، digest و دلیل معتبر لازم است.", 400);
      body = JSON.stringify({
        cutoffUtc: row.cutoffUtc,
        previewDigest: row.previewDigest,
        reason: row.reason.trim(),
      });
    } catch {
      return fail("درخواست معتبر نیست.", 400);
    }
    path = "/api/v1/admin/allocation-proposals/research/retention/purge";
  }

  const target = hanaAuthApiUrl(path);
  if (!target)
    return fail("سرویس retention در دسترس نیست.", 503);

  try {
    const response = await fetch(target, {
      method: write ? "POST" : "GET",
      body,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        ...(write ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "اطلاعات retention معتبر نیست.",
        401: "نشست معتبر نیست؛ دوباره وارد شوید.",
        403: "این عملیات فقط برای مدیر مجاز است.",
        409: "پیش‌نمایش retention تغییر کرده یا درخواست قبلی با ورودی دیگری ثبت شده است؛ پیش از ادامه وضعیت را دوباره بررسی کنید.",
      };
      return fail(
        messages[response.status] ?? "سرویس retention در دسترس نیست.",
        messages[response.status] ? response.status : 503,
      );
    }

    const payload: unknown = await response.json();
    const valid = operation === "preview"
      ? parseAllocationRetentionPreview(payload)
      : operation === "events"
        ? parseAllocationRetentionEvents(payload)
        : parseAllocationRetentionResult(payload);
    if (!valid)
      return fail("پاسخ retention قابل تأیید نیست.", 503);

    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return fail(
      write
        ? "نتیجه حذف retention قطعی نیست؛ فقط با همان کلید و همان بدنه تکرار کنید."
        : "سرویس retention در دسترس نیست.",
      503,
    );
  }
}
