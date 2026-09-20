import { safeApiBaseUrl } from "./api-base.ts";

/**
 * Geography is reference data, not a claim about active city, merchant
 * inventory, purchasable offers or delivery coverage.
 */
export type GeographyProvince = {
  id: string; name: string; slug: string;
};
export type GeographyCity = {
  id: string; provinceId: string; name: string; slug: string;
};
export type GeographyResult<T> =
  | { status: "ok"; data: T }
  | { status: "invalid" | "notFound" | "unavailable" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_RESPONSE_CHARS = 512_000;

export function validGeographyId(id: unknown): id is string {
  return typeof id === "string" && uuid.test(id) &&
    id !== "00000000-0000-0000-0000-000000000000";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value);
}

function validSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 100 &&
    slug.test(value);
}

function province(value: unknown): GeographyProvince | null {
  const item = record(value);
  return item && validGeographyId(item.id) &&
    validName(item.name) && validSlug(item.slug)
    ? { id: item.id, name: item.name, slug: item.slug }
    : null;
}

function city(value: unknown): GeographyCity | null {
  const item = record(value);
  return item && validGeographyId(item.id) &&
    validGeographyId(item.provinceId) &&
    validName(item.name) && validSlug(item.slug)
    ? {
        id: item.id, provinceId: item.provinceId,
        name: item.name, slug: item.slug,
      }
    : null;
}

function provinces(value: unknown): GeographyProvince[] | null {
  const body = record(value);
  if (!Array.isArray(body?.items) || body.items.length > 100)
    return null;
  const items = body.items.map(province);
  return items.every((item): item is GeographyProvince => item !== null)
    ? items : null;
}

function cities(
  value: unknown, provinceId: string,
): GeographyCity[] | null {
  const body = record(value);
  if (!Array.isArray(body?.items) || body.items.length > 2000)
    return null;
  const items = body.items.map(city);
  return items.every((item): item is GeographyCity =>
    item !== null &&
    item.provinceId.toLowerCase() === provinceId.toLowerCase())
    ? items : null;
}

/**
 * Works with the production ASP.NET geography read routes. No authorization
 * token or cookies are needed; app UI is deferred until approved Figma frames.
 */
export class MobileGeographyClient {
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
  ): Promise<GeographyResult<T>> {
    if (!this.base) return { status: "unavailable" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await this.fetchFn(this.base + path, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        headers: {
          Accept: "application/json", "Cache-Control": "no-store",
        },
        signal: controller.signal,
      });
      if (canBeMissing && response.status === 404)
        return { status: "notFound" };
      if (response.status !== 200 ||
        !response.headers.get("content-type")?.includes("application/json") ||
        Number(response.headers.get("content-length") ?? "0") >
          MAX_RESPONSE_CHARS)
        return { status: "unavailable" };
      const raw = await response.text();
      if (raw.length > MAX_RESPONSE_CHARS)
        return { status: "unavailable" };
      const parsed = parse(JSON.parse(raw) as unknown);
      return parsed === null
        ? { status: "unavailable" }
        : { status: "ok", data: parsed };
    } catch {
      return { status: "unavailable" };
    } finally {
      clearTimeout(timeout);
    }
  }

  provinces(): Promise<GeographyResult<GeographyProvince[]>> {
    return this.get("/api/v1/geography/provinces", provinces);
  }

  cities(provinceId: string): Promise<GeographyResult<GeographyCity[]>> {
    if (!validGeographyId(provinceId))
      return Promise.resolve({ status: "invalid" });
    const query = new URLSearchParams({ provinceId });
    return this.get("/api/v1/geography/cities?" + query,
      (raw) => cities(raw, provinceId));
  }

  city(id: string): Promise<GeographyResult<GeographyCity>> {
    if (!validGeographyId(id))
      return Promise.resolve({ status: "invalid" });
    return this.get("/api/v1/geography/cities/" + id, city, true);
  }
}
