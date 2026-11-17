import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName } from "../../../../lib/server-auth";
import { parseBuyerCreditsPage } from "../../../../lib/buyer-credits";

const error = (status: number, message: string) => NextResponse.json({ message }, { status, headers: noStore });

/** Same-origin, account-scoped read: browser never receives upstream bearer or raw financial documents. */
export async function GET(request: NextRequest) {
  const parameters = [...request.nextUrl.searchParams.entries()];
  if (parameters.length !== 1 || parameters[0][0] !== "page" ||
      !/^[1-9]\d{0,3}$/.test(parameters[0][1])) return error(400, "پارامترهای صفحه معتبر نیست.");
  const page = Number(parameters[0][1]);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return error(401, "برای دیدن اعتبارهای خود ابتدا وارد شوید.");
  const target = hanaAuthApiUrl("/api/v1/me/credits");
  if (!target) return error(503, "اطلاعات اعتبارهای حساب فعلاً در دسترس نیست.");
  target.searchParams.set("page", String(page));
  try {
    const response = await fetch(target, {
      method: "GET", cache: "no-store", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) return error(401, "نشست شما معتبر نیست؛ دوباره وارد شوید.");
    if (response.status === 403) return error(403, "دسترسی به اعتبارهای این حساب مجاز نیست.");
    if (response.status !== 200 ||
        !response.headers.get("content-type")?.includes("application/json") ||
        Number(response.headers.get("content-length") ?? "0") > 128000)
      return error(503, "وضعیت اعتبارهای حساب قابل تأیید نیست.");
    const raw = await response.text();
    if (raw.length > 128000) return error(503, "وضعیت اعتبارهای حساب قابل تأیید نیست.");
    const credits = parseBuyerCreditsPage(JSON.parse(raw) as unknown, page);
    return credits ? NextResponse.json(credits, { headers: noStore }) :
      error(503, "پاسخ اعتبارهای حساب قابل تأیید نیست.");
  } catch {
    return error(503, "ارتباط با سرویس اعتبار برقرار نشد.");
  }
}
