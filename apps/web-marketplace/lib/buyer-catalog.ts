/** Buyer browse uses only public, published catalog identities. No offers or prices. */
export type BuyerCategory = { id: string; name: string; slug: string };
export type BuyerProduct = {
  id: string; categoryId: string; name: string;
  kind: "GOOD" | "SERVICE"; description: string | null;
};
export type BuyerPage = {
  items: BuyerProduct[]; page: number; pageSize: number; total: number;
};
export const BUYER_PAGE_SIZE = 20;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (x: unknown): Record<string, unknown> | null =>
  x !== null && typeof x === "object" && !Array.isArray(x)
    ? x as Record<string, unknown> : null;
const words = (x: unknown, max: number): x is string =>
  typeof x === "string" && x.trim().length > 0 &&
  x.length <= max && !/[\u0000-\u001f\u007f]/.test(x);
const id = (x: unknown): x is string =>
  typeof x === "string" && uuid.test(x) &&
  x !== "00000000-0000-0000-0000-000000000000";
const integer = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= min && x <= max;

export function validBuyerSearch(search: string): boolean {
  return search.trim().length <= 80 &&
    !/[\u0000-\u001f\u007f]/.test(search);
}

export function buyerCatalogPath(
  page: number, categoryId: string | null, search: string,
): string {
  const params = new URLSearchParams({
    page: String(page), pageSize: String(BUYER_PAGE_SIZE),
  });
  if (categoryId) params.set("categoryId", categoryId);
  if (search) params.set("search", search);
  return "/api/catalog/products?" + params.toString();
}

export function parseBuyerCategories(raw: unknown): BuyerCategory[] | null {
  const x = object(raw);
  if (!Array.isArray(x?.items) || x.items.length > 1000) return null;
  const items: BuyerCategory[] = [];
  for (const candidate of x.items) {
    const c = object(candidate);
    if (!c || !id(c.id) || !words(c.name, 120) || !words(c.slug, 100))
      return null;
    items.push({ id: c.id, name: c.name, slug: c.slug });
  }
  return items;
}

export function parseBuyerPage(raw: unknown, requestedPage: number): BuyerPage | null {
  const x = object(raw);
  if (!x || x.page !== requestedPage || x.pageSize !== BUYER_PAGE_SIZE ||
    !integer(x.total, 0, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(x.items) || x.items.length > BUYER_PAGE_SIZE ||
    x.items.length > x.total) return null;
  const items: BuyerProduct[] = [];
  for (const candidate of x.items) {
    const p = object(candidate);
    if (!p || !id(p.id) || !id(p.categoryId) || !words(p.name, 200) ||
      (p.kind !== "GOOD" && p.kind !== "SERVICE") ||
      (p.description !== null && (typeof p.description !== "string" ||
        p.description.length > 2000))) return null;
    items.push({
      id: p.id, categoryId: p.categoryId, name: p.name,
      kind: p.kind, description: p.description,
    });
  }
  return {
    items, page: requestedPage, pageSize: BUYER_PAGE_SIZE, total: x.total,
  };
}

/** A product identity is not a seller offer, price or stock claim. */
export function validBuyerProductId(value: unknown): value is string {
  return id(value);
}

/** Do not reuse listing data as proof that a detail lookup succeeded. */
export function parseBuyerProduct(
  raw: unknown, requestedId: string,
): BuyerProduct | null {
  const x = object(raw);
  if (!validBuyerProductId(requestedId) || !x ||
    !id(x.id) || x.id.toLowerCase() !== requestedId.toLowerCase() ||
    !id(x.categoryId) || !words(x.name, 200) ||
    (x.kind !== "GOOD" && x.kind !== "SERVICE") ||
    (x.description !== null && x.description !== undefined &&
      (typeof x.description !== "string" || x.description.length > 2000)))
    return null;
  return {
    id: x.id, categoryId: x.categoryId, name: x.name,
    kind: x.kind, description: typeof x.description === "string"
      ? x.description : null,
  };
}
