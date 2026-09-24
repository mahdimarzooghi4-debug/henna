import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern,
  hanaAuthApiUrl,
  isSameOrigin,
  noStore,
  sessionCookieName,
} from "../../../../../lib/server-auth";
import {
  organizationRecipientImportMaxFileBytes,
  parseOrganizationRecipientImportErrors,
  parseOrganizationRecipientImportSuccess,
} from "../../../../../lib/organization-recipient-import";
import {
  organizationProgramIdPattern,
  organizationProgramStatuses,
} from "../../../../../lib/organization-programs";

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

function knownProgramStatus(value: unknown): string | null {
  return typeof value === "string" &&
    (organizationProgramStatuses as readonly string[]).includes(value)
    ? value
    : null;
}

function fileExtension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export async function GET() {
  const template =
    "\uFEFFنام و عنوان نمایشی,شناسه موردنیاز سازمان,شماره همراه در صورت نیاز\r\n";
  return new Response(template, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="hana-recipient-import-template.csv"',
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return error("درخواست نامعتبر است.", 403);
  if (request.nextUrl.searchParams.size !== 0)
    return error("این مسیر پارامتر query نمی‌پذیرد.", 400);

  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data"))
    return error("فایل import باید به‌صورت multipart ارسال شود.", 415);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 3 * 1024 * 1024)
    return error("حجم درخواست import بیش از حد مجاز است.", 413);

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token || !accessTokenPattern.test(token))
    return clearSession(error("برای import مشمولان ابتدا وارد شوید.", 401));

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("فرم import معتبر نیست.", 400);
  }

  const allowed = new Set(["programId", "file", "idempotencyKey"]);
  const keys = [...form.keys()];
  if (keys.some(key => !allowed.has(key)) ||
    form.getAll("programId").length !== 1 ||
    form.getAll("file").length !== 1 ||
    form.getAll("idempotencyKey").length !== 1)
    return error("فرم import فقط programId، file و idempotencyKey می‌پذیرد.", 400);

  const rawProgramId = form.get("programId");
  const rawKey = form.get("idempotencyKey");
  const rawFile = form.get("file");
  if (typeof rawProgramId !== "string" ||
    !organizationProgramIdPattern.test(rawProgramId) ||
    typeof rawKey !== "string" ||
    !uuidPattern.test(rawKey) ||
    !(rawFile instanceof File))
    return error("اطلاعات import معتبر نیست.", 400);

  if (rawFile.size <= 0 ||
    rawFile.size > organizationRecipientImportMaxFileBytes)
    return error("حجم فایل باید بیشتر از صفر و حداکثر ۲ مگابایت باشد.", 413);

  const extension = fileExtension(rawFile.name);
  if (extension !== ".csv" && extension !== ".xlsx")
    return error("فقط فایل CSV یا XLSX پذیرفته می‌شود.", 415);

  const target =
    hanaAuthApiUrl("/api/v1/organization/recipients/import");
  if (!target)
    return error("سرویس import مشمولان در دسترس نیست.", 503);

  const upstreamBody = new FormData();
  upstreamBody.set("programId", rawProgramId);
  upstreamBody.set("file", rawFile, rawFile.name);

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Idempotency-Key": rawKey,
      },
      body: upstreamBody,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (upstream.status === 401)
      return clearSession(error("نشست معتبر نیست؛ دوباره وارد شوید.", 401));
    if (upstream.status === 403)
      return error("این حساب مجوز import گروهی مشمولان را ندارد.", 403);
    if (upstream.status === 404)
      return error("طرح انتخاب‌شده پیدا نشد.", 404);
    if (upstream.status === 413)
      return error("حجم فایل import بیش از حد مجاز است.", 413);
    if (upstream.status === 415)
      return error("نوع فایل import پشتیبانی نمی‌شود.", 415);

    if (upstream.status === 422) {
      const parsed =
        parseOrganizationRecipientImportErrors(await upstream.json());
      return parsed
        ? NextResponse.json(parsed, { status: 422, headers: noStore })
        : error("گزارش خطای import معتبر نیست.", 503);
    }

    if (upstream.status === 409) {
      let value: unknown = null;
      try {
        value = await upstream.json();
      } catch {
        value = null;
      }

      const parsed = parseOrganizationRecipientImportErrors(value);
      if (parsed)
        return NextResponse.json(parsed, { status: 409, headers: noStore });

      const currentStatus = value && typeof value === "object"
        ? knownProgramStatus(
            (value as Record<string, unknown>).currentStatus,
          )
        : null;
      return error(
        currentStatus
          ? "وضعیت طرح تغییر کرده و import جدید ممکن نیست."
          : "این Idempotency-Key با import دیگری در تعارض است.",
        409,
        currentStatus ? { currentStatus } : {},
      );
    }

    if (upstream.status !== 200 && upstream.status !== 201)
      return error("import مشمولان تأیید نشد؛ دوباره تلاش کنید.", 503);

    const parsed =
      parseOrganizationRecipientImportSuccess(await upstream.json());
    if (!parsed)
      return error("پاسخ سرویس import معتبر نیست.", 503);

    return NextResponse.json(parsed, {
      status: upstream.status,
      headers: noStore,
    });
  } catch {
    return error(
      "ارتباط با سرویس import برقرار نشد؛ تلاش مجدد امن است.",
      503,
    );
  }
}
