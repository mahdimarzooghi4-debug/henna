import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "./server-auth";
import {
  parseAllocationOutcomeInput,
  parseAllocationOutcomeResult,
  parseAllocationOutcomes,
} from "./allocation-outcomes";

export async function forwardAllocationOutcomes(request: NextRequest) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });
  const write = request.method === "POST";
  if (write && !isSameOrigin(request))
    return fail("درخواست معتبر نیست.", 403);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return fail("ابتدا وارد شوید.", 401);

  let body: string | undefined;
  let query = "";
  if (write) {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return fail("درخواست معتبر نیست.", 400);
    try {
      const input = parseAllocationOutcomeInput(await request.json());
      if (!input)
        return fail(
          "بازه، evidence و حداقل یک outcome غیرمالی معتبر لازم است.",
          400,
        );
      body = JSON.stringify(input);
    } catch {
      return fail("درخواست معتبر نیست.", 400);
    }
  } else {
    const page = request.nextUrl.searchParams.get("page") ?? "1";
    if (!/^\d{1,5}$/.test(page) ||
        Number(page) < 1 || Number(page) > 10000)
      return fail("صفحه معتبر نیست.", 400);
    query = "?page=" + Number(page);
  }

  const target = hanaAuthApiUrl(
    "/api/v1/admin/allocation-proposals/research/outcomes" + query,
  );
  if (!target)
    return fail("سرویس outcome در دسترس نیست.", 503);

  try {
    const response = await fetch(target, {
      method: write ? "POST" : "GET",
      body,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        ...(write ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "اطلاعات outcome یا lineage معتبر نیست.",
        401: "نشست معتبر نیست؛ دوباره وارد شوید.",
        403: "ثبت outcome فقط برای مدیر مجاز است.",
        409: "این EventId قبلاً با داده متفاوت استفاده شده است.",
      };
      return fail(
        messages[response.status] ?? "سرویس outcome در دسترس نیست.",
        messages[response.status] ? response.status : 503,
      );
    }

    const payload: unknown = await response.json();
    const valid = write
      ? parseAllocationOutcomeResult(payload)
      : parseAllocationOutcomes(payload);
    if (!valid)
      return fail("پاسخ outcome قابل تأیید نیست.", 503);
    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return fail(
      write
        ? "نتیجه ثبت outcome قطعی نیست؛ فقط همان EventId و همان بدنه را تکرار کنید."
        : "سرویس outcome در دسترس نیست.",
      503,
    );
  }
}
