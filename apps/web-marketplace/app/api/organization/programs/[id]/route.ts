import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "../../../../../lib/server-auth";
import {
  organizationProgramIdPattern,
  parseOrganizationProgramDetail,
} from "../../../../../lib/organization-programs";
import {
  fetchOrganizationProgramDetail,
} from "../../../../../lib/server-organization-programs";

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

function bearer(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

function parseUpdate(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const allowed = new Set([
    "name", "kind", "beneficiarySource", "description", "revision",
  ]);
  if (Object.keys(body).some(key => !allowed.has(key)) ||
    Object.keys(body).length !== 5 ||
    typeof body.name !== "string" ||
    typeof body.kind !== "string" ||
    typeof body.beneficiarySource !== "string" ||
    !sources.has(body.beneficiarySource) ||
    !(body.description === null || typeof body.description === "string") ||
    typeof body.revision !== "number" ||
    !Number.isSafeInteger(body.revision) ||
    body.revision < 1 ||
    body.revision >= 2147483647)
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
    revision: body.revision,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.nextUrl.searchParams.size !== 0)
    return error("این مسیر پارامتر query نمی‌پذیرد.", 400);

  const { id } = await params;
  if (!organizationProgramIdPattern.test(id))
    return error("طرح پیدا نشد.", 404);

  const token = request.cookies.get(sessionCookieName)?.value;
  const result = await fetchOrganizationProgramDetail(token, id);

  if (result.status === "ready")
    return NextResponse.json(result.program, { headers: noStore });
  if (result.status === "unauthenticated")
    return clearSession(error("نشست معتبر نیست؛ دوباره وارد شوید.", 401));
  if (result.status === "forbidden")
    return error("این حساب دسترسی فعال به طرح‌های سازمانی ندارد.", 403);
  if (result.status === "not_found")
    return error("طرح پیدا نشد.", 404);

  return error("جزئیات طرح سازمانی در دسترس نیست.", 503);
}

export async function PUT(
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

  const token = bearer(request);
  if (!token)
    return clearSession(error("برای ویرایش طرح ابتدا وارد شوید.", 401));

  let parsed: ReturnType<typeof parseUpdate> = null;
  try {
    const raw = await request.text();
    parsed = raw.length <= 8192 ? parseUpdate(JSON.parse(raw)) : null;
  } catch {
    parsed = null;
  }
  if (!parsed)
    return error("اطلاعات یا نسخه پیش‌نویس معتبر نیست.", 400);

  const target = hanaAuthApiUrl(
    "/api/v1/organization/programs/" + encodeURIComponent(id),
  );
  if (!target)
    return error("سرویس ویرایش طرح در دسترس نیست.", 503);

  try {
    const upstream = await fetch(target, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (upstream.status === 401)
      return clearSession(error("نشست معتبر نیست؛ دوباره وارد شوید.", 401));
    if (upstream.status === 403)
      return error("این حساب مجوز ویرایش پیش‌نویس را ندارد.", 403);
    if (upstream.status === 404)
      return error("طرح پیدا نشد.", 404);
    if (upstream.status === 400)
      return error("اطلاعات یا نسخه پیش‌نویس معتبر نیست.", 400);
    if (upstream.status === 409) {
      let currentRevision: number | null = null;
      try {
        const body: unknown = await upstream.json();
        if (body && typeof body === "object" &&
          "currentRevision" in body &&
          typeof body.currentRevision === "number" &&
          Number.isSafeInteger(body.currentRevision) &&
          body.currentRevision >= 1)
          currentRevision = body.currentRevision;
      } catch {
        currentRevision = null;
      }
      return error(
        "پیش‌نویس با نسخه فعلی قابل ذخیره نیست.",
        409,
        currentRevision === null ? {} : { currentRevision },
      );
    }
    if (!upstream.ok)
      return error("ذخیره پیش‌نویس تأیید نشد؛ دوباره تلاش کنید.", 503);

    const program = parseOrganizationProgramDetail(await upstream.json());
    if (!program ||
      program.id.toLowerCase() !== id.toLowerCase() ||
      program.status !== "DRAFT" ||
      program.revision !== parsed.revision + 1)
      return error("پاسخ سرویس ویرایش طرح معتبر نیست.", 503);

    return NextResponse.json(program, { headers: noStore });
  } catch {
    return error("ذخیره پیش‌نویس تأیید نشد؛ دوباره تلاش کنید.", 503);
  }
}
