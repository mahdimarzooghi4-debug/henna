import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName,
} from "../../../../../lib/server-auth";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function bearer(request: NextRequest): string | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

export async function GET(request: NextRequest) {
  const token = bearer(request);
  if (!token)
    return error("برای مشاهده دسته‌بندی‌ها ابتدا وارد شوید.", 401);

  const target = hanaAuthApiUrl(
    "/api/v1/seller/registration/business-categories");
  if (!target)
    return error("دسته‌بندی‌های کسب‌وکار در دسترس نیست.", 503);

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (!upstream.ok)
      return error("دسته‌بندی‌های کسب‌وکار در دسترس نیست.", 503);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" ||
      !("configured" in payload) ||
      typeof payload.configured !== "boolean" ||
      !("items" in payload) ||
      !Array.isArray(payload.items))
      return error("پاسخ دسته‌بندی‌ها معتبر نیست.", 503);

    const items = [];
    for (const raw of payload.items) {
      if (!raw || typeof raw !== "object" ||
        !("id" in raw) || typeof raw.id !== "string" ||
        !uuidPattern.test(raw.id) ||
        !("name" in raw) || typeof raw.name !== "string" ||
        !raw.name.trim() || raw.name.length > 120 ||
        /[\u0000-\u001f\u007f]/.test(raw.name))
        return error("پاسخ دسته‌بندی‌ها معتبر نیست.", 503);
      items.push({ id: raw.id, name: raw.name.trim() });
    }

    if (payload.configured !== (items.length > 0))
      return error("پاسخ دسته‌بندی‌ها معتبر نیست.", 503);

    return NextResponse.json({
      configured: payload.configured,
      items,
    }, { headers: noStore });
  } catch {
    return error("دسته‌بندی‌های کسب‌وکار در دسترس نیست.", 503);
  }
}
