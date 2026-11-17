import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName,
} from "../../../../../lib/server-auth";
import {
  parseFundingInstructionDetail, parseFundingInstructionEvents,
  validFundingInstructionId,
} from "../../../../../lib/admin-funding-instructions";

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

function upstreamError(status: number) {
  if (status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
  if (status === 403) return error("دسترسی مدیریت برای این حساب فعال نیست.", 403);
  if (status === 404) return error("دستور منبع پیدا نشد.", 404);
  return error("جزئیات دستور منبع فعلاً در دسترس نیست.", 503);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ instructionId: string }> },
) {
  if (request.nextUrl.search)
    return error("پارامتر اضافی معتبر نیست.", 400);
  const { instructionId } = await context.params;
  if (!validFundingInstructionId(instructionId))
    return error("دستور منبع پیدا نشد.", 404);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return error("برای مشاهدهٔ دستور منبع ابتدا وارد شوید.", 401);
  const detailUrl = hanaAuthApiUrl(
    `/api/v1/admin/organization-funding-instructions/${instructionId}`);
  const eventsUrl = hanaAuthApiUrl(
    `/api/v1/admin/organization-funding-instructions/${instructionId}/events`);
  if (!detailUrl || !eventsUrl)
    return error("دستور منبع فعلاً در دسترس نیست.", 503);
  try {
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const [detailResponse, eventsResponse] = await Promise.all([
      fetch(detailUrl, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) }),
      fetch(eventsUrl, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) }),
    ]);
    if (!detailResponse.ok) return upstreamError(detailResponse.status);
    if (!eventsResponse.ok) return upstreamError(eventsResponse.status);
    const detail = parseFundingInstructionDetail(await readJson(detailResponse));
    const events = parseFundingInstructionEvents(await readJson(eventsResponse), instructionId);
    if (!detail || !events)
      return error("پاسخ دستور منبع قابل تأیید نیست.", 503);
    return NextResponse.json({ ...detail, events }, { headers: noStore });
  } catch {
    return error("جزئیات دستور منبع فعلاً در دسترس نیست.", 503);
  }
}
