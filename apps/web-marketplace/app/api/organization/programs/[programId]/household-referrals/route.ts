import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "../../../../../../lib/server-auth";

type JsonObject = Record<string, unknown>;
type Member = { memberNumber: number; genderCategory: string; lifeStage: string; educationLevel: string; healthNeed: string };
type Referral = { referralId: string; programId: string; externalReference: string; provinceId: string; cityId: string | null; settlementType: string; revision: number; submittedAtUtc: string; members: Member[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = (value: unknown): value is string => typeof value === "string" && uuid.test(value) && value !== "00000000-0000-0000-0000-000000000000";
const isRecord = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const error = (message: string, status: number) => NextResponse.json({ message }, { status, headers: noStore });
const enums = {
  genderCategory: new Set(["FEMALE", "MALE", "NOT_REPORTED"]),
  lifeStage: new Set(["INFANT", "PRESCHOOL", "SCHOOL_AGE", "ADULT", "OLDER_ADULT"]),
  educationLevel: new Set(["NO_FORMAL_EDUCATION", "PRIMARY", "SECONDARY", "DIPLOMA", "HIGHER_EDUCATION", "NOT_REPORTED"]),
  healthNeed: new Set(["NO_KNOWN_CHRONIC_NEED", "CHRONIC_NEED", "NOT_REPORTED"]),
};
const validTimestamp = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
const validReference = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 120 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
function parseReferral(value: unknown, programId: string): Referral | null {
  if (!isRecord(value) || !validId(value.referralId) || value.programId !== programId ||
    !validReference(value.externalReference) || !validId(value.provinceId) ||
    !(value.cityId === null || validId(value.cityId)) ||
    !(value.settlementType === "URBAN" || value.settlementType === "RURAL") || !Number.isSafeInteger(value.revision) || value.revision !== 1 ||
    !validTimestamp(value.submittedAtUtc) || !Array.isArray(value.members) || value.members.length < 1 || value.members.length > 20) return null;
  const members = value.members.map((member, index) => {
    if (!isRecord(member) || member.memberNumber !== index + 1 ||
      typeof member.genderCategory !== "string" || !enums.genderCategory.has(member.genderCategory) ||
      typeof member.lifeStage !== "string" || !enums.lifeStage.has(member.lifeStage) ||
      typeof member.educationLevel !== "string" || !enums.educationLevel.has(member.educationLevel) ||
      typeof member.healthNeed !== "string" || !enums.healthNeed.has(member.healthNeed)) return null;
    return { memberNumber: index + 1, genderCategory: member.genderCategory, lifeStage: member.lifeStage, educationLevel: member.educationLevel, healthNeed: member.healthNeed };
  });
  if (members.some(x => x === null)) return null;
  return { referralId: value.referralId, programId, externalReference: value.externalReference, provinceId: value.provinceId, cityId: value.cityId as string | null, settlementType: value.settlementType, revision: 1, submittedAtUtc: value.submittedAtUtc, members: members as Member[] };
}
async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/json") || Number(response.headers.get("content-length") ?? "0") > 512_000) throw new Error("invalid response");
  const raw = await response.text();
  if (raw.length > 512_000) throw new Error("response too large");
  return JSON.parse(raw) as unknown;
}
function context(request: NextRequest, programId: string) {
  if (!validId(programId)) return { response: error("شناسه طرح معتبر نیست.", 400) };
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return { response: error("برای مشاهده مشمولان ابتدا وارد شوید.", 401) };
  const target = hanaAuthApiUrl(`/api/v1/organization/programs/${programId}/household-referrals`);
  if (!target) return { response: error("فهرست ارجاع‌ها در دسترس نیست.", 503) };
  return { token, target };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  if ([...request.nextUrl.searchParams.keys()].length) return error("پارامترهای درخواست معتبر نیست.", 400);
  const { programId } = await params;
  const ctx = context(request, programId);
  if ("response" in ctx) return ctx.response;
  try {
    const upstream = await fetch(ctx.target, { headers: { Authorization: `Bearer ${ctx.token}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("برای این طرح دسترسی ندارید.", 403);
    if (upstream.status === 404) return error("طرح پیدا نشد یا دسترسی ندارید.", 404);
    if (upstream.status !== 200) return error("فهرست ارجاع‌ها در دسترس نیست.", 503);
    const body = await readJson(upstream);
    if (!isRecord(body) || !Array.isArray(body.referrals) || body.referrals.length > 500) return error("پاسخ فهرست ارجاع‌ها معتبر نیست.", 503);
    const referrals = body.referrals.map(item => parseReferral(item, programId));
    if (referrals.some(item => item === null)) return error("پاسخ فهرست ارجاع‌ها معتبر نیست.", 503);
    return NextResponse.json({ referrals }, { headers: noStore });
  } catch { return error("فهرست ارجاع‌ها در دسترس نیست.", 503); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  const { programId } = await params;
  const ctx = context(request, programId);
  if ("response" in ctx) return ctx.response;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error("درخواست نامعتبر است.", 400);
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!uuid.test(key) || key === "00000000-0000-0000-0000-000000000000") return error("کلید یکتای درخواست معتبر نیست.", 400);
  let body: { programRevision: number; externalReference: string; provinceId: string; cityId: string | null; settlementType: string; members: Omit<Member, "memberNumber">[] };
  try {
    const raw = await request.text();
    if (raw.length > 64_000) return error("درخواست معتبر نیست.", 400);
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || Object.keys(value).length !== 6 || !Number.isSafeInteger(value.programRevision) || (value.programRevision as number) < 1 ||
      !validReference(value.externalReference) || !validId(value.provinceId) ||
      !(value.cityId === null || validId(value.cityId)) ||
      !(value.settlementType === "URBAN" || value.settlementType === "RURAL") || (value.settlementType === "URBAN" && value.cityId === null) ||
      !Array.isArray(value.members) || value.members.length < 1 || value.members.length > 20) return error("مشخصات ارجاع خانوار معتبر نیست.", 400);
    const members = value.members.map((member: unknown) => {
      if (!isRecord(member) || Object.keys(member).length !== 4 || typeof member.genderCategory !== "string" || !enums.genderCategory.has(member.genderCategory) ||
        typeof member.lifeStage !== "string" || !enums.lifeStage.has(member.lifeStage) || typeof member.educationLevel !== "string" || !enums.educationLevel.has(member.educationLevel) ||
        typeof member.healthNeed !== "string" || !enums.healthNeed.has(member.healthNeed)) return null;
      return { genderCategory: member.genderCategory, lifeStage: member.lifeStage, educationLevel: member.educationLevel, healthNeed: member.healthNeed };
    });
    if (members.some(item => item === null)) return error("دسته‌بندی اعضای خانوار معتبر نیست.", 400);
    body = { programRevision: value.programRevision as number, externalReference: value.externalReference, provinceId: value.provinceId, cityId: value.cityId as string | null, settlementType: value.settlementType, members: members as Omit<Member, "memberNumber">[] };
  } catch { return error("درخواست معتبر نیست.", 400); }
  try {
    const upstream = await fetch(ctx.target, { method: "POST", headers: { Authorization: `Bearer ${ctx.token}`, Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("این نقش اجازه ثبت ارجاع ندارد.", 403);
    if (upstream.status === 404) return error("طرح پیدا نشد یا دسترسی ندارید.", 404);
    if (upstream.status === 400) return error("مشخصات ارجاع یا منطقه معتبر نیست.", 400);
    if (upstream.status === 409) return error("نسخه طرح تغییر کرده یا شناسه ارجاع تکراری است.", 409);
    if (upstream.status !== 200 && upstream.status !== 201) return error("ثبت ارجاع تأیید نشد.", 503);
    const referral = parseReferral(await readJson(upstream), programId);
    if (!referral || referral.externalReference !== body.externalReference || referral.provinceId !== body.provinceId || referral.cityId !== body.cityId || referral.settlementType !== body.settlementType ||
      referral.members.length !== body.members.length || referral.members.some((member, index) => member.genderCategory !== body.members[index].genderCategory || member.lifeStage !== body.members[index].lifeStage || member.educationLevel !== body.members[index].educationLevel || member.healthNeed !== body.members[index].healthNeed)) return error("ثبت ارجاع تأیید نشد.", 503);
    return NextResponse.json(referral, { status: upstream.status, headers: noStore });
  } catch { return error("ثبت ارجاع تأیید نشد.", 503); }
}
