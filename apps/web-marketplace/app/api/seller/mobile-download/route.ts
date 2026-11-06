import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName,
} from "../../../../lib/server-auth";
import {
  approvedAndroidReleaseUrl, sellerMayReceiveMobileLink,
} from "../../../../lib/mobile-release-links";

const response = (message: string, status: number) =>
  NextResponse.json({ message }, { status, headers: noStore });

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return response("ابتدا وارد حساب فروشندگی خود شوید.", 401);
  const target = hanaAuthApiUrl("/api/v1/seller/registration/status");
  if (!target)
    return response("وضعیت تأیید فروشنده در دسترس نیست.", 503);
  try {
    const upstream = await fetch(target, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Cache-Control": "no-store",
      },
      cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401) return response("نشست معتبر نیست.", 401);
    if (upstream.status === 404 || upstream.status === 409 ||
        upstream.status === 403)
      return response("دسترسی نصب اپ فروشنده فعال نشده است.", 403);
    if (upstream.status !== 200 ||
        !upstream.headers.get("content-type")?.includes("application/json"))
      return response("تأیید وضعیت فروشنده ممکن نیست.", 503);
    const body: unknown = await upstream.json();
    if (!sellerMayReceiveMobileLink(body))
      return response("لینک اپ فقط پس از تأیید و فعال‌سازی حساب فروشنده ارائه می‌شود.", 403);
    const officialUrl = approvedAndroidReleaseUrl(
      process.env.HANA_SELLER_ANDROID_APPROVED_URL,
    );
    const previewUrl = approvedAndroidReleaseUrl(
      process.env.HANA_SELLER_ANDROID_PREVIEW_URL,
    );
    const url = officialUrl ?? previewUrl;
    const channel = officialUrl ? "OFFICIAL" : previewUrl ? "PREVIEW" : null;
    return NextResponse.json(
      url ? { available: true, url, channel } : { available: false },
      { headers: noStore },
    );
  } catch {
    return response("تأیید وضعیت فروشنده ممکن نیست.", 503);
  }
}
