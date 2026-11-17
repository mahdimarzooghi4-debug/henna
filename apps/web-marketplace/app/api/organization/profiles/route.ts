import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName } from "../../../../lib/server-auth";

const roles = new Set(["ORG_LEAD", "ORG_REPRESENTATIVE", "ORG_TECHNICAL_OPERATOR"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const error = (message: string, status: number) => NextResponse.json({ message }, { status, headers: noStore });

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return error("برای ورود به پنل سازمان ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl("/api/v1/organization/profiles");
  if (!target) return error("پروفایل سازمان فعلاً در دسترس نیست.", 503);
  try {
    const upstream = await fetch(target, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("برای این حساب عضویت فعال سازمانی ثبت نشده است.", 403);
    if (!upstream.ok) return error("پروفایل سازمان فعلاً در دسترس نیست.", 503);
    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" || !("profiles" in payload) || !Array.isArray(payload.profiles) || payload.profiles.length > 100)
      return error("اطلاعات پروفایل سازمان قابل تأیید نیست.", 503);
    const profiles = payload.profiles;
    if (profiles.some((profile: unknown) => !profile || typeof profile !== "object" ||
      !("organizationId" in profile) || typeof profile.organizationId !== "string" || !uuid.test(profile.organizationId) ||
      !("organizationName" in profile) || typeof profile.organizationName !== "string" || !profile.organizationName.trim() || profile.organizationName.length > 160 ||
      !("memberRole" in profile) || typeof profile.memberRole !== "string" || !roles.has(profile.memberRole) ||
      !("membershipId" in profile) || typeof profile.membershipId !== "string" || !uuid.test(profile.membershipId)))
      return error("اطلاعات پروفایل سازمان قابل تأیید نیست.", 503);
    return NextResponse.json({ profiles }, { headers: noStore });
  } catch { return error("پروفایل سازمان فعلاً در دسترس نیست.", 503); }
}
