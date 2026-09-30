import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName,
} from "../../../../lib/server-auth";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function bearer(request: NextRequest): string | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

export async function GET(request: NextRequest) {
  const token = bearer(request);
  if (!token) return error("برای ورود به پنل فروشنده ابتدا وارد شوید.", 401);

  const target = hanaAuthApiUrl("/api/v1/seller/access");
  if (!target) return error("دسترسی پنل فروشنده فعلاً در دسترس نیست.", 503);

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403)
      return error("دسترسی فروشندگی برای این حساب فعال نیست.", 403);
    if (!upstream.ok)
      return error("دسترسی پنل فروشنده فعلاً در دسترس نیست.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("sellerAccess" in payload) || payload.sellerAccess !== true ||
      !("sellerPanelEnabled" in payload) ||
      payload.sellerPanelEnabled !== true ||
      !("trackingCode" in payload) ||
      typeof payload.trackingCode !== "string" ||
      !/^HNA-[0-9A-F]{16}$/.test(payload.trackingCode) ||
      !("activatedAtUtc" in payload) ||
      typeof payload.activatedAtUtc !== "string" ||
      Number.isNaN(Date.parse(payload.activatedAtUtc)) ||
      !("storeName" in payload) ||
      typeof payload.storeName !== "string" ||
      !payload.storeName.trim() ||
      !("businessName" in payload) ||
      typeof payload.businessName !== "string" ||
      !payload.businessName.trim() ||
      !("offeringType" in payload) ||
      !["GOOD", "SERVICE", "BOTH"].includes(String(payload.offeringType)) ||
      !("capabilities" in payload) ||
      !payload.capabilities || typeof payload.capabilities !== "object")
      return error("دسترسی پنل فروشنده قابل تأیید نیست.", 503);

    const capabilities = payload.capabilities as Record<string, unknown>;
    const expected: Record<string, boolean> = {
      dashboard: true,
      orders: false,
      listings: false,
      inventory: false,
      pricing: false,
      settlements: false,
      reports: false,
    };
    if (Object.keys(expected).some((key) =>
      capabilities[key] !== expected[key]))
      return error("قابلیت‌های پنل فروشنده قابل تأیید نیست.", 503);

    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return error("دسترسی پنل فروشنده فعلاً در دسترس نیست.", 503);
  }
}
