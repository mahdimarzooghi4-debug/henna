import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName,
} from "../../../../lib/server-auth";

type JsonObject = Record<string, unknown>;
type OfferDraft = {
  id: string;
  catalogProductId: string;
  status: "DRAFT";
  revision: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  catalogProduct: {
    id: string;
    name: string;
    categoryName: string;
    description: string | null;
    primaryMediaRoute: string | null;
  } | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const validId = (value: unknown): value is string =>
  typeof value === "string" && uuid.test(value) &&
  value !== "00000000-0000-0000-0000-000000000000";
const boundedText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  !Number.isNaN(Date.parse(value));

function parseCatalogProduct(value: unknown, productId: string): OfferDraft["catalogProduct"] | undefined {
  if (value === null) return null;
  if (!isRecord(value) || value.id !== productId ||
    !boundedText(value.name, 200) ||
    !boundedText(value.categoryName, 120) ||
    (value.description !== null &&
      (typeof value.description !== "string" || value.description.length > 2000)) ||
    (value.primaryMediaRoute !== null &&
      (typeof value.primaryMediaRoute !== "string" ||
        !/^\/api\/v1\/catalog\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          .test(value.primaryMediaRoute))))
    return undefined;
  return {
    id: value.id, name: value.name, categoryName: value.categoryName,
    description: typeof value.description === "string" ? value.description : null,
    primaryMediaRoute: typeof value.primaryMediaRoute === "string"
      ? value.primaryMediaRoute : null,
  };
}

function parseDraft(value: unknown, allowMissingCatalogProduct = false): OfferDraft | null {
  if (!isRecord(value) || !validId(value.id) ||
    !validId(value.catalogProductId) || value.status !== "DRAFT" ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) || value.revision < 1 ||
    !validTimestamp(value.createdAtUtc) ||
    !validTimestamp(value.updatedAtUtc))
    return null;
  const hasCatalogProduct = Object.hasOwn(value, "catalogProduct");
  if (!hasCatalogProduct && !allowMissingCatalogProduct) return null;
  const catalogProduct = hasCatalogProduct
    ? parseCatalogProduct(value.catalogProduct, value.catalogProductId) : null;
  if (catalogProduct === undefined) return null;
  return {
    id: value.id, catalogProductId: value.catalogProductId,
    status: "DRAFT", revision: value.revision,
    createdAtUtc: value.createdAtUtc, updatedAtUtc: value.updatedAtUtc,
    catalogProduct,
  };
}

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function bearer(request: NextRequest): string | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/json") ||
    Number(response.headers.get("content-length") ?? "0") > 512_000)
    throw new Error("Invalid upstream response");
  const raw = await response.text();
  if (raw.length > 512_000) throw new Error("Upstream response too large");
  return JSON.parse(raw) as unknown;
}

export async function GET(request: NextRequest) {
  if ([...request.nextUrl.searchParams.keys()].length > 0)
    return error("پارامترهای درخواست معتبر نیست.", 400);
  const token = bearer(request);
  if (!token) return error("برای مشاهده پیش‌نویس کالا ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl("/api/v1/seller/offers");
  if (!target) return error("پیش‌نویس کالا فعلاً در دسترس نیست.", 503);

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("دسترسی فروشندگی برای این حساب فعال نیست.", 403);
    if (upstream.status !== 200) return error("پیش‌نویس کالا فعلاً در دسترس نیست.", 503);
    const payload = await readJson(upstream);
    if (!isRecord(payload) || !Array.isArray(payload.items) ||
      payload.items.length > 10000)
      return error("پاسخ پیش‌نویس‌ها قابل تأیید نیست.", 503);
    const items = payload.items.map((item) => parseDraft(item));
    if (items.some((item): item is null => item === null))
      return error("پاسخ پیش‌نویس‌ها قابل تأیید نیست.", 503);
    return NextResponse.json({ items }, { headers: noStore });
  } catch {
    return error("پیش‌نویس کالا فعلاً در دسترس نیست.", 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return error("درخواست نامعتبر است.", 403);
  const token = bearer(request);
  if (!token) return error("برای ثبت پیش‌نویس ابتدا وارد شوید.", 401);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return error("درخواست نامعتبر است.", 400);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!uuid.test(idempotencyKey) ||
    idempotencyKey === "00000000-0000-0000-0000-000000000000")
    return error("کلید یکتای درخواست معتبر نیست.", 400);

  let catalogProductId: string;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return error("درخواست معتبر نیست.", 400);
    const body: unknown = JSON.parse(raw);
    if (!isRecord(body) || Object.keys(body).length !== 1 ||
      Object.keys(body)[0] !== "catalogProductId" ||
      !validId(body.catalogProductId))
      return error("شناسه کالای کاتالوگ معتبر نیست.", 400);
    catalogProductId = body.catalogProductId;
  } catch {
    return error("درخواست معتبر نیست.", 400);
  }

  const target = hanaAuthApiUrl("/api/v1/seller/offers");
  if (!target) return error("ثبت پیش‌نویس تأیید نشد.", 503);
  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ catalogProductId }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401) return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403) return error("دسترسی فروشندگی برای این حساب فعال نیست.", 403);
    if (upstream.status === 400) return error("درخواست پیش‌نویس معتبر نیست.", 400);
    if (upstream.status === 409) return error("این کالا دیگر برای انتخاب در دسترس نیست.", 409);
    if (upstream.status !== 200 && upstream.status !== 201)
      return error("ثبت پیش‌نویس تأیید نشد.", 503);
    const draft = parseDraft(await readJson(upstream), true);
    if (!draft || draft.catalogProductId !== catalogProductId ||
      draft.catalogProduct !== null)
      return error("ثبت پیش‌نویس تأیید نشد.", 503);
    return NextResponse.json(draft, {
      status: upstream.status, headers: noStore,
    });
  } catch {
    return error("ثبت پیش‌نویس تأیید نشد.", 503);
  }
}
