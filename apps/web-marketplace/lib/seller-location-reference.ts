/**
 * Optional reference lookup for the EXISTING first-step seller "شهر / منطقه"
 * free-text field. SELECTABLE is a taxonomy state, not seller coverage or
 * readiness for payments/delivery. No location metadata is written to seller
 * records: that API currently persists only a city/area TEXT draft.
 *
 * Never send draft text, phone, account ID or seller credentials upstream.
 */
export type ReferenceProvince = {
  id: string; name: string; slug: string;
};
export type ReferenceCity = {
  id: string; provinceId: string; name: string; slug: string;
};
export type ReferenceResult<T> =
  | { status: "ok"; items: T[] }
  | { status: "unavailable" };

const validUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validReferenceId(value: string): boolean {
  return validUuid.test(value) &&
    value.toLowerCase() !== "00000000-0000-0000-0000-000000000000";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function name(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    value.length <= 120 &&
    !/[\u0000-\u001f\u007f]/.test(value);
}
function slug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 100 &&
    validSlug.test(value);
}

export function parseReferenceProvinces(
  value: unknown,
): ReferenceProvince[] | null {
  const raw = record(value);
  if (!Array.isArray(raw?.items) || raw.items.length > 100)
    return null;
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const items: ReferenceProvince[] = [];
  for (const entry of raw.items) {
    const item = record(entry);
    if (!item || typeof item.id !== "string" ||
      !validReferenceId(item.id) || !name(item.name) ||
      !slug(item.slug)) return null;
    if (ids.has(item.id.toLowerCase()) ||
      slugs.has(item.slug)) return null;
    ids.add(item.id.toLowerCase());
    slugs.add(item.slug);
    items.push({
      id: item.id, name: item.name, slug: item.slug,
    });
  }
  return items;
}

export function parseReferenceCities(
  value: unknown, provinceId: string,
): ReferenceCity[] | null {
  if (!validReferenceId(provinceId)) return null;
  const raw = record(value);
  if (!Array.isArray(raw?.items) || raw.items.length > 2000)
    return null;
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const items: ReferenceCity[] = [];
  for (const entry of raw.items) {
    const item = record(entry);
    if (!item || typeof item.id !== "string" ||
      !validReferenceId(item.id) ||
      typeof item.provinceId !== "string" ||
      item.provinceId.toLowerCase() !== provinceId.toLowerCase() ||
      !name(item.name) || !slug(item.slug))
      return null;
    if (ids.has(item.id.toLowerCase()) ||
      slugs.has(item.slug)) return null;
    ids.add(item.id.toLowerCase());
    slugs.add(item.slug);
    items.push({
      id: item.id, provinceId: item.provinceId,
      name: item.name, slug: item.slug,
    });
  }
  return items;
}

async function getReference<T>(
  path: string, parse: (json: unknown) => T[] | null,
  fetchFn: typeof fetch, signal?: AbortSignal,
): Promise<ReferenceResult<T>> {
  try {
    const response = await fetchFn(path, {
      method: "GET", cache: "no-store",
      signal, headers: { Accept: "application/json" },
    });
    if (response.status !== 200 ||
      !response.headers.get("content-type")?.includes("application/json"))
      return { status: "unavailable" };
    const parsed = parse(await response.json() as unknown);
    return parsed === null
      ? { status: "unavailable" }
      : { status: "ok", items: parsed };
  } catch {
    return { status: "unavailable" };
  }
}

export function getSellerReferenceProvinces(
  fetchFn: typeof fetch = fetch, signal?: AbortSignal,
): Promise<ReferenceResult<ReferenceProvince>> {
  return getReference("/api/geography/provinces",
    parseReferenceProvinces, fetchFn, signal);
}

export function getSellerReferenceCities(
  provinceId: string, fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ReferenceResult<ReferenceCity>> {
  if (!validReferenceId(provinceId))
    return Promise.resolve({ status: "unavailable" });
  return getReference("/api/geography/cities?provinceId=" +
    encodeURIComponent(provinceId),
    (data) => parseReferenceCities(data, provinceId),
    fetchFn, signal);
}

/**
 * The seller-draft API accepts TEXT only (max 120). The UI does not pretend
 * to store a cityId or infer a selling/delivery eligibility from a city name.
 */
export function formatSellerReferenceCity(
  province: ReferenceProvince, city: ReferenceCity,
): string | null {
  if (city.provinceId.toLowerCase() !== province.id.toLowerCase())
    return null;
  const value = city.name.trim() + "، " + province.name.trim();
  return value.length <= 120 ? value : null;
}
