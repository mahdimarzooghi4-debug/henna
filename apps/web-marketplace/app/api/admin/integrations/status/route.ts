import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  noStore,
  sessionCookieName,
} from "../../../../../lib/server-auth";
import {
  parseExternalIntegrationStatus,
} from "../../../../../lib/external-integration-status";

async function boundedJson(response: Response, max: number): Promise<unknown> {
  if (!response.body) throw Error();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
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

const fail = (status: number, message: string) =>
  NextResponse.json({ message }, { status, headers: noStore });

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.size)
    return fail(400, "پارامتر اضافی پذیرفته نیست.");
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return fail(401, "برای مشاهده وضعیت اتصال‌ها ابتدا وارد شوید.");

  const target = hanaAuthApiUrl("/api/v1/admin/integrations/status");
  if (!target) return fail(503, "سرویس وضعیت اتصال‌ها آماده نیست.");

  try {
    const response = await fetch(target, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const status = [401, 403].includes(response.status)
        ? response.status : 503;
      return fail(status, status === 403
        ? "مشاهده وضعیت اتصال‌ها فقط برای ادمین مجاز است."
        : status === 401
          ? "نشست معتبر نیست؛ دوباره وارد شوید."
          : "سرویس وضعیت اتصال‌ها آماده نیست.");
    }
    if (response.status !== 200 ||
        !response.headers.get("content-type")?.includes("application/json"))
      return fail(503, "پاسخ وضعیت اتصال‌ها قابل تأیید نیست.");

    const parsed = parseExternalIntegrationStatus(
      await boundedJson(response, 32768));
    return parsed
      ? NextResponse.json(parsed, { headers: noStore })
      : fail(503, "پاسخ وضعیت اتصال‌ها قابل اعتماد نیست.");
  } catch {
    return fail(503, "سرویس وضعیت اتصال‌ها آماده نیست.");
  }
}
