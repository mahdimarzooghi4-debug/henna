import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  noStore,
  sessionCookieName,
} from "../../../../../../lib/server-auth";
import { parseMonoDeliveryStatusView } from "../../../../../../lib/mono-delivery-status";

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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.getAll("orderId");
  if (request.nextUrl.searchParams.size !== 1 || ids.length !== 1 ||
      !uuidPattern.test(ids[0]))
    return fail(400, "شناسه سفارش معتبر نیست.");

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return fail(401, "برای مشاهده وضعیت ارسال ابتدا وارد شوید.");

  const target = hanaAuthApiUrl(
    "/api/v1/admin/integrations/mono/orders/" +
    encodeURIComponent(ids[0].toLowerCase()) + "/status");
  if (!target) return fail(503, "سرویس وضعیت ارسال آماده نیست.");

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
      if (response.status === 401)
        return fail(401, "نشست معتبر نیست؛ دوباره وارد شوید.");
      if (response.status === 403)
        return fail(403, "این بخش فقط برای ادمین مجاز است.");
      if (response.status === 404)
        return fail(404, "برای این سفارش سابقهٔ ارسال ثبت نشده است.");
      if (response.status === 409)
        return fail(409, "وضعیت هم‌بستگی سفارش نیاز به بررسی عملیاتی دارد.");
      return fail(503, "سرویس وضعیت ارسال آماده نیست.");
    }
    if (response.status !== 200 ||
        !response.headers.get("content-type")?.includes("application/json"))
      return fail(503, "پاسخ وضعیت ارسال قابل تأیید نیست.");

    const parsed = parseMonoDeliveryStatusView(
      await boundedJson(response, 32768));
    if (!parsed || parsed.orderId !== ids[0].toLowerCase())
      return fail(503, "پاسخ وضعیت ارسال با سفارش درخواستی تطبیق ندارد.");
    return NextResponse.json(parsed, { headers: noStore });
  } catch {
    return fail(503, "سرویس وضعیت ارسال آماده نیست.");
  }
}
