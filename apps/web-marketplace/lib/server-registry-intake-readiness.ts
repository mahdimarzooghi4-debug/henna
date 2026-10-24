import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName } from "./server-auth";
import { validTechnicalSelection,
  parseModelVersionTechnicalPreflight } from "./model-version-technical-preflight";
import { parseRegistryIntakeReadiness } from "./registry-intake-readiness";

export async function forwardRegistryIntakeReadiness(request: NextRequest) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });
  if (request.method !== "POST") return fail("درخواست معتبر نیست.", 405);
  if (!isSameOrigin(request)) return fail("مبدأ درخواست معتبر نیست.", 403);
  if (request.nextUrl.search) return fail("پارامتر اضافی مجاز نیست.", 400);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return fail("نوع درخواست معتبر نیست.", 400);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return fail("ابتدا وارد شوید.", 401);
  const source = await request.text().catch(() => "");
  if (!source || source.length > 12000) return fail("درخواست نامعتبر یا بزرگ است.", 400);
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { return fail("درخواست معتبر نیست.", 400); }
  if (!record(raw) || !validTechnicalSelection(raw.selection) ||
      !record(raw.technical) || Object.keys(raw).sort().join("|") !== "selection|technical")
    return fail("شناسه فنی انتخاب‌شده معتبر نیست.", 400);
  const selection = raw.selection;
  const technical = parseModelVersionTechnicalPreflight(raw.technical, selection);
  if (!technical) return fail("سند فنی قابل اعتبارسنجی نیست.", 400);
  const target = hanaAuthApiUrl(
    "/api/v1/admin/allocation-proposals/research/registry-intake-readiness/preview");
  if (!target) return fail("سرویس در دسترس نیست.", 503);
  try {
    const reply = await fetch(target, {
      method: "POST", cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(selection), signal: AbortSignal.timeout(30000)
    });
    if (!reply.ok) return fail(reply.status === 403 ? "دسترسی ادمین لازم است." :
      reply.status === 401 ? "نشست معتبر نیست." :
      reply.status === 400 ? "شواهد انتخاب‌شده منطبق نیست." : "پیش‌نیازهای ثبت قابل دریافت نیست.",
      [400, 401, 403].includes(reply.status) ? reply.status : 503);
    const body = await reply.text();
    if (body.length > 12000) return fail("پاسخ بیش از اندازه است.", 503);
    const validated = parseRegistryIntakeReadiness(JSON.parse(body), selection, technical);
    if (!validated) return fail("پاسخ پیش‌نیازهای Registry با انتخاب شما منطبق نیست.", 503);
    return NextResponse.json(validated, { headers: noStore });
  } catch {
    return fail("پاسخ نامطمئن است؛ هیچ مدلی ثبت یا فعال نشد.", 503);
  }
}
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
