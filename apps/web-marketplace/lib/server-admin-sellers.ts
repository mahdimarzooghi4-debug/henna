import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "./server-auth";
import {
  adminSellerId,
  parseAdminSellerDetail,
  parseAdminSellerList,
  parseAdminSellerMutation,
} from "./admin-sellers";

async function boundedJson(response: Response, max: number): Promise<unknown> {
  if (!response.body) throw Error();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        throw Error();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    reader.releaseLock();
  }
}

function fail(status: number, message: string) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function token(request: NextRequest) {
  const value = request.cookies.get(sessionCookieName)?.value;
  return value && accessTokenPattern.test(value) ? value : null;
}

function page(request: NextRequest): number | null {
  if (request.nextUrl.searchParams.size === 0) return 1;
  if (request.nextUrl.searchParams.size !== 1) return null;
  const raw = request.nextUrl.searchParams.get("page");
  return raw && /^[1-9][0-9]{0,3}$/.test(raw) && Number(raw) <= 10000
    ? Number(raw) : null;
}

function cleanReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 500 ||
      /[\u0000-\u001f\u007f]/.test(cleaned)) return null;
  return cleaned;
}

export async function forwardAdminSeller(
  request: NextRequest,
  segments: string[],
  method: "GET" | "POST",
) {
  const auth = token(request);
  if (!auth) return fail(401, "برای دسترسی مدیریتی ابتدا وارد شوید.");

  let upstreamPath = "/api/v1/admin/seller-applications";
  let expectedId: string | null = null;
  let expectedPage = 1;
  let body: string | undefined;
  let idempotencyKey: string | undefined;
  let mode: "list" | "detail" | "review" | "activate";

  if (method === "GET" && segments.length === 0) {
    const requestedPage = page(request);
    if (requestedPage === null) return fail(400, "صفحه‌بندی معتبر نیست.");
    expectedPage = requestedPage;
    upstreamPath += `?page=${expectedPage}&pageSize=20`;
    mode = "list";
  } else if (method === "GET" && segments.length === 1 &&
      adminSellerId(segments[0]) && request.nextUrl.searchParams.size === 0) {
    expectedId = segments[0];
    upstreamPath += "/" + expectedId;
    mode = "detail";
  } else if (method === "POST" && segments.length === 2 &&
      adminSellerId(segments[0]) &&
      ["review", "activate"].includes(segments[1]) &&
      request.nextUrl.searchParams.size === 0) {
    if (!isSameOrigin(request))
      return fail(403, "مبدأ درخواست معتبر نیست.");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return fail(400, "درخواست JSON معتبر لازم است.");
    idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;
    if (!adminSellerId(idempotencyKey))
      return fail(400, "کلید ثبت عملیات معتبر نیست.");

    expectedId = segments[0];
    mode = segments[1] as "review" | "activate";
    upstreamPath += "/" + expectedId + "/" + mode;
    try {
      const raw: unknown = await request.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return fail(400, "اطلاعات عملیات معتبر نیست.");
      const x = raw as Record<string, unknown>;
      if (!Number.isSafeInteger(x.revision) ||
          Number(x.revision) < 1 || Number(x.revision) >= 2147483647)
        return fail(400, "نسخه پرونده معتبر نیست.");
      if (mode === "review") {
        if (!["APPROVED", "NEEDS_INFORMATION", "REJECTED"]
            .includes(String(x.decision)))
          return fail(400, "نتیجه بررسی معتبر نیست.");
        const reason = cleanReason(x.reason);
        if (!reason)
          return fail(400, "دلیل مستند تصمیم الزامی است.");
        body = JSON.stringify({
          revision: x.revision,
          decision: x.decision,
          reason,
        });
      } else {
        body = JSON.stringify({ revision: x.revision });
      }
    } catch {
      return fail(400, "اطلاعات عملیات معتبر نیست.");
    }
  } else {
    return fail(404, "مسیر مدیریتی معتبر نیست.");
  }

  const target = hanaAuthApiUrl(upstreamPath);
  if (!target) return fail(503, "سرویس مدیریت فروشندگان آماده نیست.");

  try {
    const response = await fetch(target, {
      method,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${auth}`,
        ...(method === "POST" ? {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey!,
        } : {}),
      },
    });

    if (!response.ok) {
      const status = [400, 401, 403, 404, 409].includes(response.status)
        ? response.status : 503;
      const messages: Record<number, string> = {
        400: "اطلاعات عملیات معتبر نیست.",
        401: "نشست معتبر نیست؛ دوباره وارد شوید.",
        403: "این عملیات فقط برای مدیر مجاز است.",
        404: "پرونده فروشنده پیدا نشد.",
        409: mode === "activate"
          ? "پرونده تأیید نشده، تغییر کرده یا قبلاً فعال شده است."
          : "پرونده تغییر کرده یا قبلاً بررسی شده است.",
        503: "سرویس مدیریت فروشندگان آماده نیست.",
      };
      return fail(status, messages[status] ?? messages[503]);
    }
    if (response.status !== 200 ||
        !response.headers.get("content-type")?.includes("application/json"))
      return fail(503, "پاسخ مدیریت فروشندگان قابل تأیید نیست.");

    const raw = await boundedJson(response, 512000);
    const parsed = mode === "list"
      ? parseAdminSellerList(raw, expectedPage)
      : mode === "detail"
        ? parseAdminSellerDetail(raw, expectedId!)
        : parseAdminSellerMutation(raw, expectedId!);
    if (!parsed)
      return fail(503, "پاسخ مدیریت فروشندگان قابل اعتماد نیست.");

    return NextResponse.json(parsed, { headers: noStore });
  } catch {
    return fail(503, "سرویس مدیریت فروشندگان آماده نیست.");
  }
}
