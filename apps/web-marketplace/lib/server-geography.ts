import { NextResponse } from "next/server";
import { hanaAuthApiUrl, noStore } from "./server-auth";

/**
 * Location reference data, never evidence of store coverage, serviceability
 * or readiness for payment, orders, logistics or city launch.
 */
export type PublicProvince = { id: string; name: string; slug: string };
export type PublicCity = {
  id: string; provinceId: string; name: string; slug: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const unavailable = "اطلاعات استان و شهر از سرور حنا دریافت نشد؛ دوباره تلاش کنید.";
const missing = "این شهر در فهرست قابل انتخاب پیدا نشد.";

export function validGeographyId(value: string): boolean {
  return uuid.test(value) &&
    value !== "00000000-0000-0000-0000-000000000000";
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

export function parseProvince(value: unknown): PublicProvince | null {
  const item = record(value);
  return item && typeof item.id === "string" && validGeographyId(item.id) &&
    validName(item.name) && validSlug(item.slug)
    ? { id: item.id, name: item.name, slug: item.slug } : null;
}

export function parseCity(value: unknown): PublicCity | null {
  const item = record(value);
  return item && typeof item.id === "string" && validGeographyId(item.id) &&
    typeof item.provinceId === "string" &&
    validGeographyId(item.provinceId) &&
    validName(item.name) && validSlug(item.slug)
    ? {
        id: item.id, provinceId: item.provinceId,
        name: item.name, slug: item.slug,
      }
    : null;
}

export function parseProvinces(
  value: unknown,
): { items: PublicProvince[] } | null {
  const raw = record(value);
  if (!Array.isArray(raw?.items) || raw.items.length > 100)
    return null;
  const items = raw.items.map(parseProvince);
  return items.every((item): item is PublicProvince => item !== null)
    ? { items } : null;
}

export function parseCities(
  value: unknown,
  provinceId: string,
): { items: PublicCity[] } | null {
  const raw = record(value);
  if (!Array.isArray(raw?.items) || raw.items.length > 2000)
    return null;
  const items = raw.items.map(parseCity);
  // An upstream response with an unexpected province is not an empty result;
  // reject it instead of silently allowing cross-province selection.
  return items.every((item): item is PublicCity =>
    item !== null && item.provinceId.toLowerCase() === provinceId.toLowerCase())
    ? { items } : null;
}

export function geographyError(
  status: 400 | 404 | 503,
  message = status === 404 ? missing : status === 400
    ? "شناسه استان معتبر و یکتا لازم است." : unavailable,
) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

/** Public Next BFF. Forward no browser cookie, Authorization or other headers. */
export async function geographyGet<T>(
  path: string,
  parse: (value: unknown) => T | null,
  missingIsNotFound = false,
): Promise<NextResponse> {
  const target = hanaAuthApiUrl(path);
  if (!target) return geographyError(503);
  try {
    const response = await fetch(target, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (missingIsNotFound && response.status === 404)
      return geographyError(404);
    if (response.status !== 200 ||
      !response.headers.get("content-type")?.includes("application/json") ||
      Number(response.headers.get("content-length") ?? "0") > 512_000)
      return geographyError(503);
    const raw = await response.text();
    if (raw.length > 512_000) return geographyError(503);
    const parsed = parse(JSON.parse(raw) as unknown);
    if (parsed === null) return geographyError(503);
    return NextResponse.json(parsed, { headers: noStore });
  } catch {
    // Do not describe a server outage as a location with no selectable cities.
    return geographyError(503);
  }
}
