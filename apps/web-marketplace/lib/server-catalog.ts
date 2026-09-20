import { NextResponse } from "next/server";
import { hanaAuthApiUrl, noStore } from "./server-auth";

type JsonObject = Record<string, unknown>;
export type PublicCategory = { id: string; name: string; slug: string };
export type PublicProduct = {
  id: string; categoryId: string; name: string;
  kind: "GOOD" | "SERVICE"; description: string | null;
};
export type PublicProductPage = {
  items: PublicProduct[]; page: number; pageSize: number; total: number;
};

const unavailable = "دریافت اطلاعات کاتالوگ از سرور حنا تأیید نشد؛ دوباره تلاش کنید.";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validCatalogId = (id: string) =>
  uuid.test(id) && id !== "00000000-0000-0000-0000-000000000000";
const record = (value: unknown): JsonObject | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject : null;
const text = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value);
const boundedInteger = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) &&
  value >= min && value <= max;

export function catalogError(status: 400 | 404 | 503, message = unavailable) {
  return NextResponse.json({ message }, { status, headers: noStore });
}

export function parseCategory(value: unknown): PublicCategory | null {
  const x = record(value);
  return x && typeof x.id === "string" && validCatalogId(x.id) &&
    text(x.name, 120) && text(x.slug, 100)
    ? { id: x.id, name: x.name, slug: x.slug } : null;
}

export function parseProduct(value: unknown): PublicProduct | null {
  const x = record(value);
  if (!x || typeof x.id !== "string" || !validCatalogId(x.id) ||
    typeof x.categoryId !== "string" || !validCatalogId(x.categoryId) ||
    !text(x.name, 200) || (x.kind !== "GOOD" && x.kind !== "SERVICE") ||
    (x.description !== null && x.description !== undefined &&
      (typeof x.description !== "string" || x.description.length > 2000)))
    return null;
  return {
    id: x.id, categoryId: x.categoryId, name: x.name,
    kind: x.kind, description: typeof x.description === "string" ? x.description : null,
  };
}

export function parseCategories(value: unknown): { items: PublicCategory[] } | null {
  const raw = record(value);
  if (!Array.isArray(raw?.items) || raw.items.length > 1000) return null;
  const items = raw.items.map(parseCategory);
  return items.every((item): item is PublicCategory => item !== null)
    ? { items } : null;
}

export function parseProducts(value: unknown): PublicProductPage | null {
  const raw = record(value);
  if (!raw || !boundedInteger(raw.page, 1, 10000) ||
    !boundedInteger(raw.pageSize, 1, 50) ||
    !boundedInteger(raw.total, 0, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(raw.items) || raw.items.length > raw.pageSize ||
    raw.items.length > raw.total) return null;
  const items = raw.items.map(parseProduct);
  return items.every((item): item is PublicProduct => item !== null)
    ? {
        items, page: raw.page as number, pageSize: raw.pageSize as number,
        total: raw.total as number,
      } : null;
}

/**
 * Browser receives only reviewed catalog fields. No bearer/cookies are sent
 * upstream. Never turn 503, malformed JSON or invalid shape into empty data.
 */
export async function catalogGet<T>(
  path: string, parse: (value: unknown) => T | null,
  missingIsNotFound = false,
): Promise<NextResponse> {
  const target = hanaAuthApiUrl(path);
  if (!target) return catalogError(503);
  try {
    const response = await fetch(target, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (missingIsNotFound && response.status === 404)
      return catalogError(404, "این کالا یا خدمت در کاتالوگ منتشرشده پیدا نشد.");
    if (response.status !== 200 ||
      !response.headers.get("content-type")?.includes("application/json") ||
      Number(response.headers.get("content-length") ?? "0") > 512_000)
      return catalogError(503);
    const raw = await response.text();
    if (raw.length > 512_000) return catalogError(503);
    const parsed = parse(JSON.parse(raw) as unknown);
    if (parsed === null) return catalogError(503);
    return NextResponse.json(parsed, { headers: noStore });
  } catch {
    return catalogError(503);
  }
}
