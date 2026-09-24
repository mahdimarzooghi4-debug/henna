import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "../../../../../../lib/server-auth";
import {
  organizationProgramIdPattern,
  organizationProgramStatuses,
  parseOrganizationProgramDetail,
} from "../../../../../../lib/organization-programs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function parseRequest(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length !== 2 ||
    keys.some(key => key !== "revision" && key !== "idempotencyKey") ||
    typeof body.revision !== "number" ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 1 ||
    body.revision >= 2147483647 ||
    typeof body.idempotencyKey !== "string" ||
    !uuidPattern.test(body.idempotencyKey))
    return null;

  return {
    revision: body.revision,
    idempotencyKey: body.idempotencyKey,
  };
}

function knownStatus(value: unknown): string | null {
  return typeof value === "string" &&
    (organizationProgramStatuses as readonly string[]).includes(value)
    ? value
    : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request))
    return error("درخواست نامعتبر است.", 403);
  if (request.nextUrl.searchParams.size !== 0)
    return error("این مسیر پارامتر query نمی‌پذیرد.", 400);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);

  const { id } = await params;
  if (!organizationProgramIdPattern.test(id))
    return error("طرح پیدا نشد.", 404);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return clearSession(error("برای ثبت نهایی طرح ابتدا وارد شوید.", 401));

  let parsed: ReturnType<typeof parseRequest> = null;
  try {
    const raw = await request.text();
    parsed = raw.length <= 4096 ? parseRequest(JSON.parse(raw)) : null;
  } catch {
    parsed = null;
  }
  if (!parsed)
    return error("نسخه یا کلید ثبت نهایی معتبر نیست.", 400);

  const target = hanaAuthApiUrl(
    "/api/v1/organization/programs/" +
      encodeURIComponent(id) +
      "/register",
  );
  if (!target)
    return error("سرویس ثبت نهایی طرح در دسترس نیست.", 503);

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": parsed.idempotencyKey,
      },
      body: JSON.stringify({ revision: parsed.revision }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return clearSession(error("نشست معتبر نیست؛ دوباره وارد شوید.", 401));
    if (upstream.status === 403)
      return error("این حساب مجوز ثبت نهایی طرح را ندارد.", 403);
    if (upstream.status === 404)
      return error("طرح پیدا نشد.", 404);
    if (upstream.status === 400)
      return error("نسخه یا درخواست ثبت نهایی معتبر نیست.", 400);

    if (upstream.status === 409) {
      let currentRevision: number | null = null;
      let currentStatus: string | null = null;
      try {
        const value: unknown = await upstream.json();
        if (value && typeof value === "object") {
          if ("currentRevision" in value &&
            typeof value.currentRevision === "number" &&
            Number.isSafeInteger(value.currentRevision) &&
            value.currentRevision >= 1)
            currentRevision = value.currentRevision;
          if ("currentStatus" in value)
            currentStatus = knownStatus(value.currentStatus);
        }
      } catch {
        currentRevision = null;
        currentStatus = null;
      }
      return error(
        "وضعیت یا نسخه طرح برای ثبت نهایی تغییر کرده است.",
        409,
        {
          ...(currentRevision === null ? {} : { currentRevision }),
          ...(currentStatus === null ? {} : { currentStatus }),
        },
      );
    }

    if (upstream.status !== 200)
      return error("ثبت نهایی طرح تأیید نشد؛ دوباره تلاش کنید.", 503);

    const program = parseOrganizationProgramDetail(await upstream.json());
    if (!program ||
      program.id.toLowerCase() !== id.toLowerCase() ||
      program.status !== "REGISTERED" ||
      program.revision !== parsed.revision + 1 ||
      program.registeredAtUtc === null)
      return error("پاسخ سرویس ثبت نهایی طرح معتبر نیست.", 503);

    return NextResponse.json(program, { headers: noStore });
  } catch {
    return error("ثبت نهایی طرح تأیید نشد؛ دوباره تلاش کنید.", 503);
  }
}
