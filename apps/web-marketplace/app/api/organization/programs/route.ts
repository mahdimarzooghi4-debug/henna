import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "../../../../lib/server-auth";
import {
  parseOrganizationProgramDetail,
  parseOrganizationProgramUrlQuery,
} from "../../../../lib/organization-programs";
import {
  fetchOrganizationPrograms,
} from "../../../../lib/server-organization-programs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sources = new Set(["MANUAL", "API", "API_OR_MANUAL"]);
const controlChars = /[\u0000-\u001f\u007f]/;

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

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function bearer(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

function parseCreate(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const allowed = new Set([
    "name", "kind", "beneficiarySource", "description", "idempotencyKey",
  ]);
  if (Object.keys(body).some(key => !allowed.has(key)) ||
    Object.keys(body).length !== 5 ||
    typeof body.name !== "string" ||
    typeof body.kind !== "string" ||
    typeof body.beneficiarySource !== "string" ||
    !sources.has(body.beneficiarySource) ||
    typeof body.idempotencyKey !== "string" ||
    !uuidPattern.test(body.idempotencyKey) ||
    !(body.description === null || typeof body.description === "string"))
    return null;

  const name = body.name.trim();
  const kind = body.kind.trim();
  const description = typeof body.description === "string"
    ? body.description.trim() || null
    : null;
  if (!name || name.length > 200 ||
    !kind || kind.length > 120 ||
    (description?.length ?? 0) > 2000 ||
    controlChars.test(body.name) ||
    controlChars.test(body.kind) ||
    (typeof body.description === "string" &&
      controlChars.test(body.description)))
    return null;

  return {
    name,
    kind,
    beneficiarySource: body.beneficiarySource,
    description,
    idempotencyKey: body.idempotencyKey,
  };
}

export async function GET(request: NextRequest) {
  const query = parseOrganizationProgramUrlQuery(request.nextUrl.searchParams);
  if (!query)
    return error("فیلتر یا صفحه‌بندی معتبر نیست.", 400);

  const token = request.cookies.get(sessionCookieName)?.value;
  const result = await fetchOrganizationPrograms(token, query);

  if (result.status === "ready")
    return NextResponse.json(result.data, { headers: noStore });
  if (result.status === "unauthenticated")
    return clearSession(error("نشست معتبر نیست؛ دوباره وارد شوید.", 401));
  if (result.status === "forbidden")
    return error("این حساب دسترسی فعال به طرح‌های سازمانی ندارد.", 403);

  return error("فهرست طرح‌های سازمانی در دسترس نیست.", 503);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return error("درخواست نامعتبر است.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);

  const token = bearer(request);
  if (!token)
    return clearSession(error("برای ثبت طرح ابتدا وارد شوید.", 401));

  let parsed: ReturnType<typeof parseCreate> = null;
  try {
    const raw = await request.text();
    parsed = raw.length <= 8192 ? parseCreate(JSON.parse(raw)) : null;
  } catch {
    parsed = null;
  }
  if (!parsed)
    return error("اطلاعات پیش‌نویس معتبر نیست.", 400);

  const target = hanaAuthApiUrl("/api/v1/organization/programs");
  if (!target)
    return error("سرویس ثبت طرح در دسترس نیست.", 503);

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": parsed.idempotencyKey,
      },
      body: JSON.stringify({
        name: parsed.name,
        kind: parsed.kind,
        beneficiarySource: parsed.beneficiarySource,
        description: parsed.description,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return clearSession(error("نشست معتبر نیست؛ دوباره وارد شوید.", 401));
    if (upstream.status === 403)
      return error("این حساب مجوز ثبت پیش‌نویس طرح را ندارد.", 403);
    if (upstream.status === 400)
      return error("اطلاعات پیش‌نویس معتبر نیست.", 400);
    if (upstream.status === 409)
      return error("کلید ثبت این درخواست با یک درخواست دیگر تداخل دارد.", 409);
    if (upstream.status !== 200 && upstream.status !== 201)
      return error("ثبت پیش‌نویس تأیید نشد؛ دوباره تلاش کنید.", 503);

    const program = parseOrganizationProgramDetail(await upstream.json());
    if (!program ||
      (upstream.status === 201 &&
        (program.status !== "DRAFT" || program.revision !== 1)))
      return error("پاسخ سرویس ثبت طرح معتبر نیست.", 503);

    return NextResponse.json(program, {
      status: upstream.status,
      headers: noStore,
    });
  } catch {
    return error("ثبت پیش‌نویس تأیید نشد؛ دوباره تلاش کنید.", 503);
  }
}
