import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "../../../../lib/server-auth";
import {
  parseOrganizationRecipient,
  parseOrganizationRecipientUrlQuery,
} from "../../../../lib/organization-recipients";
import {
  organizationProgramIdPattern,
  organizationProgramStatuses,
} from "../../../../lib/organization-programs";
import {
  fetchOrganizationRecipients,
} from "../../../../lib/server-organization-recipients";

function clearSession(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: new Date(0),
  });
  return response;
}

function error(
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { message, ...extra },
    { status, headers: noStore },
  );
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controlChars = /[\u0000-\u001f\u007f]/;

function parseCreate(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const allowed = new Set([
    "displayName",
    "externalReference",
    "phone",
    "programId",
    "idempotencyKey",
  ]);
  const keys = Object.keys(body);
  if (keys.length !== allowed.size ||
    keys.some(key => !allowed.has(key)) ||
    typeof body.displayName !== "string" ||
    typeof body.externalReference !== "string" ||
    !(body.phone === null || typeof body.phone === "string") ||
    typeof body.programId !== "string" ||
    !organizationProgramIdPattern.test(body.programId) ||
    typeof body.idempotencyKey !== "string" ||
    !uuidPattern.test(body.idempotencyKey))
    return null;

  const displayName = body.displayName.trim();
  const externalReference = body.externalReference.trim();
  const phone = typeof body.phone === "string"
    ? body.phone.trim() || null
    : null;
  if (!displayName || displayName.length > 200 ||
    !externalReference || externalReference.length > 80 ||
    (phone?.length ?? 0) > 32 ||
    controlChars.test(body.displayName) ||
    controlChars.test(body.externalReference) ||
    (typeof body.phone === "string" && controlChars.test(body.phone)))
    return null;

  return {
    displayName,
    externalReference,
    phone,
    programId: body.programId,
    idempotencyKey: body.idempotencyKey,
  };
}

function knownProgramStatus(value: unknown): string | null {
  return typeof value === "string" &&
    (organizationProgramStatuses as readonly string[]).includes(value)
    ? value
    : null;
}

export async function GET(request: NextRequest) {
  const query =
    parseOrganizationRecipientUrlQuery(request.nextUrl.searchParams);
  if (!query)
    return error("فیلتر یا صفحه‌بندی مشمولان معتبر نیست.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  const result = await fetchOrganizationRecipients(token, query);

  if (result.status === "ready")
    return NextResponse.json(result.data, { headers: noStore });
  if (result.status === "unauthenticated")
    return clearSession(error("نشست معتبر نیست؛ دوباره وارد شوید.", 401));
  if (result.status === "forbidden")
    return error("این حساب دسترسی فعال به مشمولان سازمان ندارد.", 403);

  return error("فهرست افراد و مشمولان در دسترس نیست.", 503);
}


export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return error("درخواست نامعتبر است.", 403);
  if (request.nextUrl.searchParams.size !== 0)
    return error("این مسیر پارامتر query نمی‌پذیرد.", 400);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return clearSession(error("برای افزودن مشمول ابتدا وارد شوید.", 401));

  let parsed: ReturnType<typeof parseCreate> = null;
  try {
    const raw = await request.text();
    parsed = raw.length <= 8192 ? parseCreate(JSON.parse(raw)) : null;
  } catch {
    parsed = null;
  }
  if (!parsed)
    return error("اطلاعات مشمول معتبر نیست.", 400);

  const target = hanaAuthApiUrl("/api/v1/organization/recipients");
  if (!target)
    return error("سرویس افزودن مشمول در دسترس نیست.", 503);

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": parsed.idempotencyKey,
      },
      body: JSON.stringify({
        displayName: parsed.displayName,
        externalReference: parsed.externalReference,
        phone: parsed.phone,
        programId: parsed.programId,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return clearSession(error("نشست معتبر نیست؛ دوباره وارد شوید.", 401));
    if (upstream.status === 403)
      return error("این حساب مجوز افزودن مشمول را ندارد.", 403);
    if (upstream.status === 404)
      return error("طرح انتخاب‌شده پیدا نشد.", 404);
    if (upstream.status === 400)
      return error("اطلاعات مشمول معتبر نیست.", 400);

    if (upstream.status === 409) {
      let existingRecipientId: string | null = null;
      let currentStatus: string | null = null;
      try {
        const value: unknown = await upstream.json();
        if (value && typeof value === "object") {
          const conflict = value as Record<string, unknown>;
          if (typeof conflict.existingRecipientId === "string" &&
            uuidPattern.test(conflict.existingRecipientId))
            existingRecipientId = conflict.existingRecipientId;
          currentStatus = knownProgramStatus(conflict.currentStatus);
        }
      } catch {
        existingRecipientId = null;
        currentStatus = null;
      }

      return error(
        existingRecipientId
          ? "این شناسه قبلاً برای همین طرح ثبت شده است."
          : currentStatus
            ? "وضعیت طرح تغییر کرده و افزودن مشمول جدید ممکن نیست."
            : "درخواست افزودن مشمول با وضعیت فعلی سازگار نیست.",
        409,
        {
          ...(existingRecipientId ? { existingRecipientId } : {}),
          ...(currentStatus ? { currentStatus } : {}),
        },
      );
    }

    if (upstream.status !== 200 && upstream.status !== 201)
      return error("افزودن مشمول تأیید نشد؛ دوباره تلاش کنید.", 503);

    const recipient = parseOrganizationRecipient(await upstream.json());
    if (!recipient ||
      recipient.source !== "MANUAL" ||
      (upstream.status === 201 &&
        !["REGISTERED", "ACTIVE"].includes(recipient.program.status)) ||
      !["MATCHED", "NEEDS_MATCH"].includes(recipient.matchStatus))
      return error("پاسخ سرویس افزودن مشمول معتبر نیست.", 503);

    return NextResponse.json(recipient, {
      status: upstream.status,
      headers: noStore,
    });
  } catch {
    return error("افزودن مشمول تأیید نشد؛ دوباره تلاش کنید.", 503);
  }
}
