import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName } from "./server-auth";
import { parseModelArtifactDossier } from "./model-artifact-dossier";

export async function forwardModelArtifactDossier(request: NextRequest) {
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers: noStore });
  if (request.method !== "GET" ||
      [...request.nextUrl.searchParams.keys()].some(k => k !== "family" && k !== "artifactId"))
    return fail("درخواست معتبر نیست.", 400);
  const family = request.nextUrl.searchParams.get("family");
  const id = request.nextUrl.searchParams.get("artifactId");
  if ((family !== "XGBOOST" && family !== "EBM") ||
      !id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    return fail("شناسه اثر معتبر نیست.", 400);
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return fail("ابتدا وارد شوید.", 401);
  const url = hanaAuthApiUrl(
    "/api/v1/admin/allocation-proposals/research/model-artifacts/" + family +
    "/" + encodeURIComponent(id) + "/evidence");
  if (!url) return fail("سرویس در دسترس نیست.", 503);
  try {
    const response = await fetch(url, {
      method: "GET", cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return fail(response.status === 403 ? "دسترسی ادمین لازم است." :
      response.status === 401 ? "نشست معتبر نیست." :
      response.status === 404 ? "اثر موردنظر پیدا نشد." : "پرونده قابل بررسی نیست.",
      [401, 403, 404].includes(response.status) ? response.status : 503);
    const body = await response.text();
    if (body.length > 40000) return fail("پاسخ بیش از اندازه است.", 503);
    const validated = parseModelArtifactDossier(JSON.parse(body), family, id);
    if (!validated) return fail("ساختار پرونده قابل تأیید نیست.", 503);
    return NextResponse.json(validated, { headers: noStore });
  } catch {
    return fail("بررسی ناموفق است؛ هیچ مدلی پذیرفته نشده است.", 503);
  }
}
