import { safeApiBaseUrl } from "./api-base.ts";

/**
 * Public catalog identities only. Publication never represents a priced,
 * stocked, deliverable or purchasable offer from an approved seller.
 */
export type CatalogCategory = { id: string; name: string; slug: string };
export type CatalogProduct = {
  id: string; categoryId: string; name: string;
  kind: "GOOD" | "SERVICE"; description: string | null;
};
export type CatalogPage = {
  items: CatalogProduct[]; page: number; pageSize: number; total: number;
};
export type CatalogResult<T> =
  { status: "ok"; data: T } |
  { status: "invalid" | "notFound" | "unavailable" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RESPONSE_CHARS = 512_000;
const record = (raw: unknown): Record<string, unknown> | null =>
  raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown> : null;
const boundedText = (raw: unknown, maxLength: number): raw is string =>
  typeof raw === "string" && raw.trim().length > 0 &&
  raw.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(raw);
const boundedInt = (raw: unknown, min: number, max: number): raw is number =>
  typeof raw === "number" && Number.isSafeInteger(raw) &&
  raw >= min && raw <= max;
const validId = (raw: unknown): raw is string =>
  typeof raw === "string" && uuid.test(raw) &&
  raw !== "00000000-0000-0000-0000-000000000000";

function category(raw: unknown): CatalogCategory | null {
  const value = record(raw);
  return value && validId(value.id) &&
    boundedText(value.name, 120) && boundedText(value.slug, 100)
    ? { id: value.id, name: value.name, slug: value.slug } : null;
}

function product(raw: unknown): CatalogProduct | null {
  const value = record(raw);
  if (!value || !validId(value.id) || !validId(value.categoryId) ||
    !boundedText(value.name, 200) ||
    (value.kind !== "GOOD" && value.kind !== "SERVICE") ||
    (value.description !== null &&
      (typeof value.description !== "string" ||
        value.description.length > 2000)))
    return null;
  return {
    id: value.id, categoryId: value.categoryId, name: value.name,
    kind: value.kind, description: value.description,
  };
}

function categories(raw: unknown): CatalogCategory[] | null {
  const value = record(raw);
  if (!value || !Array.isArray(value.items) || value.items.length > 1000)
    return null;
  const items = value.items.map(category);
  return items.every((item): item is CatalogCategory => item !== null)
    ? items : null;
}

function products(raw: unknown): CatalogPage | null {
  const value = record(raw);
  if (!value || !boundedInt(value.page, 1, 10000) ||
    !boundedInt(value.pageSize, 1, 50) ||
    !boundedInt(value.total, 0, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(value.items) ||
    value.items.length > value.pageSize ||
    value.items.length > value.total)
    return null;
  const items = value.items.map(product);
  if (!items.every((item): item is CatalogProduct => item !== null))
    return null;
  return {
    items, page: value.page, pageSize: value.pageSize, total: value.total,
  };
}

export type CatalogQuery = {
  page?: number; pageSize?: number; categoryId?: string; search?: string;
};

/**
 * A small transport for the existing ASP.NET Catalog API, independent of
 * authentication and SecureStore. Real screens can use it when Figma's
 * consumer catalogue frames are approved; no demo data is shipped.
 */
export class MobileCatalogClient {
  private readonly base: string | null;
  private readonly fetchFn: typeof fetch;

  constructor(
    apiBase: string | undefined,
    fetchFn: typeof fetch = fetch,
    allowLocalHttp = false,
  ) {
    this.base = safeApiBaseUrl(apiBase, allowLocalHttp);
    this.fetchFn = fetchFn;
  }

  private async get<T>(
    path: string, parse: (raw: unknown) => T | null,
    canBeMissing = false,
  ): Promise<CatalogResult<T>> {
    if (!this.base) return { status: "unavailable" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await this.fetchFn(this.base + path, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        headers: { Accept: "application/json", "Cache-Control": "no-store" },
        signal: controller.signal,
      });
      if (canBeMissing && response.status === 404)
        return { status: "notFound" };
      if (response.status !== 200 ||
        !response.headers.get("content-type")?.includes("application/json") ||
        Number(response.headers.get("content-length") ?? "0") > MAX_RESPONSE_CHARS)
        return { status: "unavailable" };
      const raw = await response.text();
      if (raw.length > MAX_RESPONSE_CHARS)
        return { status: "unavailable" };
      const value = parse(JSON.parse(raw) as unknown);
      return value === null
        ? { status: "unavailable" }
        : { status: "ok", data: value };
    } catch {
      // Network, timeout and malformed responses do not imply an empty catalog.
      return { status: "unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  }

  categories(): Promise<CatalogResult<CatalogCategory[]>> {
    return this.get("/api/v1/catalog/categories", categories);
  }

  list(query: CatalogQuery = {}): Promise<CatalogResult<CatalogPage>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const categoryId = query.categoryId;
    const search = query.search?.trim();
    if (!boundedInt(page, 1, 10000) ||
      !boundedInt(pageSize, 1, 50) ||
      (categoryId !== undefined && !validId(categoryId)) ||
      (search !== undefined && (search.length > 80 ||
        /[\u0000-\u001f\u007f]/.test(search))))
      return Promise.resolve({ status: "invalid" });

    const params = new URLSearchParams({
      page: String(page), pageSize: String(pageSize),
    });
    if (categoryId !== undefined) params.set("categoryId", categoryId);
    if (search) params.set("search", search);
    return this.get("/api/v1/catalog/products?" + params, products);
  }

  detail(id: string): Promise<CatalogResult<CatalogProduct>> {
    if (!validId(id)) return Promise.resolve({ status: "invalid" });
    return this.get("/api/v1/catalog/products/" + id, product, true);
  }
}
