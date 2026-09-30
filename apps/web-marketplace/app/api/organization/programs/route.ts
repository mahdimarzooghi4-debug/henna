import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "../../../../lib/server-auth";

type JsonObject = Record<string, unknown>;
type AllocationMode = "HENNA_NEEDS_BASED" | "ORGANIZATION_DEFINED";
type Program = {
  programId: string; organizationId: string; organizationName?: string; name: string;
  allocationMode: AllocationMode; description: string; state: "DRAFT"; revision: 1; createdAtUtc: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const modes = new Set<AllocationMode>(["HENNA_NEEDS_BASED", "ORGANIZATION_DEFINED"]);
const isRecord = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const validId = (value: unknown): value is string => typeof value === "string" && uuid.test(value) && value !== "00000000-0000-0000-0000-000000000000";
const validText = (value: unknown, max: number, allowEmpty = false): value is string =>
  typeof value === "string" && value.length <= max && (allowEmpty || value.trim().length > 0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const validTimestamp = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
const error = (message: string, status: number) => NextResponse.json({ message }, { status, headers: noStore });
const bearer = (request: NextRequest) => {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
};

function parseProgram(value: unknown, requireOrganizationName = false): Program | null {
  if (!isRecord(value) || !validId(value.programId) || !validId(value.organizationId) ||
    !validText(value.name, 120) || typeof value.allocationMode !== "string" || !modes.has(value.allocationMode as AllocationMode) ||
    !validText(value.description, 1200, true) || value.state !== "DRAFT" || value.revision !== 1 || !validTimestamp(value.createdAtUtc) ||
    (requireOrganizationName && !validText(value.organizationName, 160))) return null;
  return {
    programId: value.programId, organizationId: value.organizationId,
    ...(typeof value.organizationName === "string" ? { organizationName: value.organizationName } : {}),
    name: value.name, allocationMode: value.allocationMode as AllocationMode,
    description: value.description, state: "DRAFT", revision: 1, createdAtUtc: value.createdAtUtc,
  };
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/json") || Number(response.headers.get("content-length") ?? "0") > 512_000) throw new Error("invalid upstream response");
  const raw = await response.text();
  if (raw.length > 512_000) throw new Error("upstream response too large");
  return JSON.parse(raw) as unknown;
}

export async function GET(request: NextRequest) {
  if ([...request.nextUrl.searchParams.keys()].length) return error("پارامترهای درخواست معتبر نیست.", 400);
  const token = bearer(request);
  if (!token) return error("برای مشاهده طرح‌های سازمان ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl("/api/v1/organization/programs");
  if (!target) return error("طرح‌های سازمان فعلاً در دسترس نیست.", 503);
  try {
    const upstream = await fetch(target, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("برای این حساب عضویت فعال سازمانی ثبت نشده است.", 403);
    if (upstream.status !== 200) return error("طرح‌های سازمان فعلاً در دسترس نیست.", 503);
    const payload = await readJson(upstream);
    if (!isRecord(payload) || !Array.isArray(payload.programs) || payload.programs.length > 200) return error("پاسخ طرح‌های سازمان قابل تأیید نیست.", 503);
    const programs = payload.programs.map((item) => parseProgram(item, true));
    if (programs.some((item) => item === null)) return error("پاسخ طرح‌های سازمان قابل تأیید نیست.", 503);
    return NextResponse.json({ programs }, { headers: noStore });
  } catch { return error("طرح‌های سازمان فعلاً در دسترس نیست.", 503); }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  const token = bearer(request);
  if (!token) return error("برای ثبت پیش‌نویس طرح ابتدا وارد شوید.", 401);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error("درخواست نامعتبر است.", 400);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!validId(idempotencyKey)) return error("کلید یکتای درخواست معتبر نیست.", 400);

  let body: { organizationId: string; name: string; allocationMode: AllocationMode; description: string };
  try {
    const raw = await request.text();
    if (raw.length > 8192) return error("درخواست معتبر نیست.", 400);
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || Object.keys(value).length !== 4 ||
      !validId(value.organizationId) || !validText(value.name, 120) ||
      typeof value.allocationMode !== "string" || !modes.has(value.allocationMode as AllocationMode) ||
      !validText(value.description, 1200, true)) return error("مشخصات طرح معتبر نیست.", 400);
    body = { organizationId: value.organizationId, name: value.name.trim(), allocationMode: value.allocationMode as AllocationMode, description: value.description.trim() };
  } catch { return error("درخواست معتبر نیست.", 400); }

  const target = hanaAuthApiUrl("/api/v1/organization/programs");
  if (!target) return error("ثبت پیش‌نویس تأیید نشد.", 503);
  try {
    const upstream = await fetch(target, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("این حساب اجازه ثبت پیش‌نویس طرح را ندارد.", 403);
    if (upstream.status === 400) return error("مشخصات طرح معتبر نیست.", 400);
    if (upstream.status === 409) return error("درخواست تکراری با اطلاعات متفاوت است؛ صفحه را تازه کنید.", 409);
    if (upstream.status !== 200 && upstream.status !== 201) return error("ثبت پیش‌نویس تأیید نشد.", 503);
    const program = parseProgram(await readJson(upstream));
    if (!program || program.organizationId !== body.organizationId || program.name !== body.name || program.allocationMode !== body.allocationMode || program.description !== body.description)
      return error("ثبت پیش‌نویس تأیید نشد.", 503);
    return NextResponse.json(program, { status: upstream.status, headers: noStore });
  } catch { return error("ثبت پیش‌نویس تأیید نشد.", 503); }
}
