import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  noStore,
  sessionCookieName,
} from "../../../../lib/server-auth";
import { parseOrganizationDashboard } from "../../../../lib/organization-portal";

async function boundedJson(response: Response, maxBytes: number): Promise<unknown> {
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
      if (bytes > maxBytes) {
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

function error(status: number, message: string) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.size) return error(400, "پارامتر اضافی مجاز نیست.");
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return error(401, "برای ورود به پرتال سازمانی وارد حساب خود شوید.");

  const target = hanaAuthApiUrl("/api/v1/organization/dashboard");
  if (!target) return error(503, "سرویس سازمانی در این محیط آماده نیست.");

  try {
    const response = await fetch(target, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401)
        return error(401, "نشست شما معتبر نیست؛ دوباره وارد شوید.");
      if (response.status === 403)
        return error(403, "عضویت مدیر سازمان برای این حساب فعال نیست.");
      return error(503, "دریافت وضعیت سازمان از سرور تأیید نشد.");
    }
    if (!response.headers.get("content-type")?.includes("application/json"))
      return error(503, "پاسخ سازمانی معتبر نیست.");
    const parsed = parseOrganizationDashboard(await boundedJson(response, 512000));
    if (!parsed) return error(503, "پاسخ سازمانی قابل اعتماد نیست.");
    return NextResponse.json(parsed, { headers: noStore });
  } catch {
    return error(503, "دریافت وضعیت سازمان از سرور تأیید نشد.");
  }
}
