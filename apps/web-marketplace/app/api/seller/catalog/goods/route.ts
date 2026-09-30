import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, noStore, sessionCookieName,
} from "../../../../../lib/server-auth";

type JsonObject = Record<string, unknown>;
type CatalogCategory = { id: string; name: string; slug: string };
type CatalogGood = {
  id: string;
  categoryId: string;
  name: string;
  categoryName: string;
  description: string | null;
  imageUrl: string | null;
};
type CatalogPage = {
  items: CatalogGood[];
  categories: CatalogCategory[];
  page: number;
  pageSize: number;
  total: number;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mediaRoute = /^\/api\/v1\/catalog\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const validId = (value: unknown): value is string =>
  typeof value === "string" && uuid.test(value) &&
  value !== "00000000-0000-0000-0000-000000000000";
const boundedText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const exactKeys = (value: JsonObject, keys: string[]) =>
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

function bearer(request: NextRequest): string | null {
  const token = request.cookies.get(sessionCookieName)?.value;
  return token && accessTokenPattern.test(token) ? token : null;
}

function parseInteger(value: string | null, fallback: number, min: number, max: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max
    ? parsed : null;
}

function parsePage(value: unknown, requestedPage: number, requestedSize: number): CatalogPage | null {
  if (!isRecord(value) ||
    !Array.isArray(value.items) || !Array.isArray(value.categories) ||
    value.items.length > requestedSize || value.categories.length > 500 ||
    value.page !== requestedPage || value.pageSize !== requestedSize ||
    typeof value.total !== "number" || !Number.isSafeInteger(value.total) ||
    value.total < value.items.length)
    return null;

  const items: CatalogGood[] = [];
  for (const item of value.items) {
    if (!isRecord(item) ||
      !exactKeys(item, ["id", "categoryId", "name", "categoryName", "description", "imageUrl"]) ||
      !validId(item.id) || !validId(item.categoryId) ||
      !boundedText(item.name, 200) || !boundedText(item.categoryName, 120) ||
      (item.description !== null &&
        (typeof item.description !== "string" || item.description.length > 2000 ||
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(item.description))) ||
      (item.imageUrl !== null &&
        (typeof item.imageUrl !== "string" || !mediaRoute.test(item.imageUrl))))
      return null;
    items.push({
      id: item.id, categoryId: item.categoryId, name: item.name,
      categoryName: item.categoryName,
      description: typeof item.description === "string" ? item.description : null,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
    });
  }

  const categories: CatalogCategory[] = [];
  for (const category of value.categories) {
    if (!isRecord(category) ||
      !exactKeys(category, ["id", "name", "slug"]) ||
      !validId(category.id) || !boundedText(category.name, 120) ||
      !boundedText(category.slug, 100))
      return null;
    categories.push({
      id: category.id, name: category.name, slug: category.slug,
    });
  }
  return {
    items, categories, page: requestedPage, pageSize: requestedSize,
    total: value.total,
  };
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
  const params = request.nextUrl.searchParams;
  const allowed = new Set(["page", "pageSize", "categoryId", "search"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1)
      return error("پارامترهای درخواست معتبر نیست.", 400);
  }

  const page = parseInteger(params.get("page"), 1, 1, 10000);
  const pageSize = parseInteger(params.get("pageSize"), 20, 1, 50);
  const rawCategory = params.get("categoryId");
  const rawSearch = params.get("search");
  const categoryId = rawCategory === null ? null :
    validId(rawCategory) ? rawCategory : undefined;
  const search = rawSearch === null ? null : rawSearch.trim();
  if (page === null || pageSize === null || categoryId === undefined ||
    (search !== null &&
      (search.length > 80 || /[\u0000-\u001f\u007f]/.test(search))))
    return error("پارامترهای درخواست معتبر نیست.", 400);

  const token = bearer(request);
  if (!token) return error("برای مشاهده کالاهای کاتالوگ ابتدا وارد شوید.", 401);
  const target = hanaAuthApiUrl("/api/v1/seller/catalog/goods");
  if (!target) return error("فهرست کالا فعلاً در دسترس نیست.", 503);

  target.searchParams.set("page", String(page));
  target.searchParams.set("pageSize", String(pageSize));
  if (categoryId !== null) target.searchParams.set("categoryId", categoryId);
  if (search !== null && search.length > 0)
    target.searchParams.set("search", search);

  try {
    const upstream = await fetch(target, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (upstream.status === 401)
      return error("نشست معتبر نیست؛ دوباره وارد شوید.", 401);
    if (upstream.status === 403)
      return error("دسترسی فروشندگی برای این حساب فعال نیست.", 403);
    if (upstream.status !== 200)
      return error("فهرست کالا فعلاً در دسترس نیست.", 503);
    const payload = parsePage(await readJson(upstream), page, pageSize);
    if (!payload) return error("پاسخ فهرست کالا قابل تأیید نیست.", 503);
    return NextResponse.json(payload, { headers: noStore });
  } catch {
    return error("فهرست کالا فعلاً در دسترس نیست.", 503);
  }
}
