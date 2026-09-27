import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName } from "../../../../../../lib/server-auth";

type JsonObject = Record<string, unknown>;
type AllocationMode = "HENNA_NEEDS_BASED" | "ORGANIZATION_DEFINED";
type Instruction = {
  instructionId: string; programId: string; programRevision: number; allocationMode: AllocationMode;
  sourceInstructionReference: string; state: "PENDING_VERIFICATION"; revision: number; submittedAtUtc: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const modes = new Set<AllocationMode>(["HENNA_NEEDS_BASED", "ORGANIZATION_DEFINED"]);
const isRecord = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const error = (message: string, status: number) => NextResponse.json({ message }, { status, headers: noStore });
const validTimestamp = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
const validReference = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 160 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);

function parseInstruction(value: unknown, expectedProgramId: string): Instruction | null {
  if (!isRecord(value) || typeof value.instructionId !== "string" || !uuid.test(value.instructionId) ||
    value.programId !== expectedProgramId || !Number.isSafeInteger(value.programRevision) || (value.programRevision as number) < 1 ||
    typeof value.allocationMode !== "string" || !modes.has(value.allocationMode as AllocationMode) ||
    !validReference(value.sourceInstructionReference) || value.state !== "PENDING_VERIFICATION" ||
    !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 || !validTimestamp(value.submittedAtUtc)) return null;
  return {
    instructionId: value.instructionId, programId: expectedProgramId, programRevision: value.programRevision as number,
    allocationMode: value.allocationMode as AllocationMode, sourceInstructionReference: value.sourceInstructionReference,
    state: "PENDING_VERIFICATION", revision: value.revision as number, submittedAtUtc: value.submittedAtUtc,
  };
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/json") || Number(response.headers.get("content-length") ?? "0") > 64_000) throw new Error("invalid upstream response");
  const raw = await response.text();
  if (raw.length > 64_000) throw new Error("upstream response too large");
  return JSON.parse(raw) as unknown;
}

async function requestContext(request: NextRequest, programId: string) {
  if (!uuid.test(programId) || programId === "00000000-0000-0000-0000-000000000000") return { response: error("شناسه طرح معتبر نیست.", 400) };
  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token)) return { response: error("برای مشاهده دستور منبع ابتدا وارد شوید.", 401) };
  const target = hanaAuthApiUrl(`/api/v1/organization/programs/${programId}/funding-instruction`);
  if (!target) return { response: error("اطلاعات دستور منبع در دسترس نیست.", 503) };
  return { token, target };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  if ([...request.nextUrl.searchParams.keys()].length) return error("پارامترهای درخواست معتبر نیست.", 400);
  const { programId } = await params;
  const context = await requestContext(request, programId);
  if ("response" in context) return context.response;
  try {
    const upstream = await fetch(context.target, { headers: { Authorization: `Bearer ${context.token}`, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (upstream.status === 404) return error("برای این طرح هنوز دستور منبع ثبت نشده است.", 404);
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("برای این طرح دسترسی ندارید.", 403);
    if (upstream.status !== 200) return error("اطلاعات دستور منبع در دسترس نیست.", 503);
    const instruction = parseInstruction(await readJson(upstream), programId);
    return instruction ? NextResponse.json(instruction, { headers: noStore }) : error("پاسخ دستور منبع قابل تأیید نیست.", 503);
  } catch { return error("اطلاعات دستور منبع در دسترس نیست.", 503); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  const { programId } = await params;
  const context = await requestContext(request, programId);
  if ("response" in context) return context.response;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error("درخواست نامعتبر است.", 400);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!uuid.test(idempotencyKey) || idempotencyKey === "00000000-0000-0000-0000-000000000000") return error("کلید یکتای درخواست معتبر نیست.", 400);
  let body: { programRevision: number; sourceInstructionReference: string };
  try {
    const raw = await request.text();
    if (raw.length > 8192) return error("درخواست معتبر نیست.", 400);
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || Object.keys(value).length !== 2 || !Number.isSafeInteger(value.programRevision) ||
      (value.programRevision as number) < 1 || !validReference(value.sourceInstructionReference)) return error("مشخصات دستور منبع معتبر نیست.", 400);
    body = { programRevision: value.programRevision as number, sourceInstructionReference: value.sourceInstructionReference };
  } catch { return error("درخواست معتبر نیست.", 400); }
  try {
    const upstream = await fetch(context.target, {
      method: "POST", headers: { Authorization: `Bearer ${context.token}`, Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("این حساب اجازه ثبت دستور منبع را ندارد.", 403);
    if (upstream.status === 404) return error("طرح پیدا نشد یا دسترسی ندارید.", 404);
    if (upstream.status === 400) return error("مشخصات دستور منبع معتبر نیست.", 400);
    if (upstream.status === 409) return error("نسخه طرح تغییر کرده یا برای آن قبلاً دستور ثبت شده است. صفحه را تازه کنید.", 409);
    if (upstream.status !== 200 && upstream.status !== 201) return error("ثبت دستور منبع تأیید نشد.", 503);
    const instruction = parseInstruction(await readJson(upstream), programId);
    if (!instruction || instruction.programRevision !== body.programRevision || instruction.sourceInstructionReference !== body.sourceInstructionReference) return error("ثبت دستور منبع تأیید نشد.", 503);
    return NextResponse.json(instruction, { status: upstream.status, headers: noStore });
  } catch { return error("ثبت دستور منبع تأیید نشد.", 503); }
}
