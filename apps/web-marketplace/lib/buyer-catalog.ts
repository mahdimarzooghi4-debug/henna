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

/**
 * A category can disappear from the published taxonomy after a buyer
 * bookmarked/selected it. Only a CONFIRMED 200 published list can retire
 * the filter; a failed/unknown list must never silently erase a URL.
 *
 * Return a new location only if a published category was actually removed.
 * Keep the buyer's search term; a missing category no longer owns page N.
 */
export function reconcilePublishedBuyerCategory(
  location: BuyerBrowseLocation,
  published: BuyerCategory[],
): BuyerBrowseLocation | null {
  if (location.categoryId === null ||
    published.some((entry) =>
      entry.id.toLowerCase() === location.categoryId?.toLowerCase()))
    return null;
  return { categoryId: null, search: location.search, page: 1 };
}

/**
 * A previously valid bookmarked page can become out of range when published
 * products are withdrawn. Only a parsed, confirmed page-200 response for the
 * SAME request with an empty result and authoritative total can repair it.
 * A network outage, malformed JSON or a nonempty result is not evidence.
 */
export function reconcilePublishedBuyerPage(
  location: BuyerBrowseLocation,
  confirmed: BuyerPage,
): BuyerBrowseLocation | null {
  if (location.page <= 1 || confirmed.page !== location.page ||
    confirmed.pageSize !== BUYER_PAGE_SIZE || confirmed.items.length !== 0 ||
    confirmed.total > (location.page - 1) * BUYER_PAGE_SIZE) return null;
  return { ...location, page: 1 };
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

/**
 * The entire browse/navigation state is a small, same-origin allowlist.
 * A product URL carries search/category/page query values, never a returnTo
 * string that could become an open redirect.
 */
export type BuyerBrowseLocation = {
  categoryId: string | null;
  search: string;
  page: number;
};

export const emptyBuyerBrowseLocation = (): BuyerBrowseLocation => ({
  categoryId: null, search: "", page: 1,
});

export function parseBuyerBrowseLocation(
  params: URLSearchParams,
): BuyerBrowseLocation {
  const category = params.get("categoryId");
  const term = params.get("search") ?? "";
  const pageText = params.get("page") ?? "";
  const number = /^[1-9][0-9]{0,4}$/.test(pageText)
    ? Number(pageText) : 1;
  return {
    categoryId: validBuyerProductId(category) ? category.toLowerCase() : null,
    search: validBuyerSearch(term) ? term.trim() : "",
    page: number >= 1 && number <= 10000 ? number : 1,
  };
}

export function buyerBrowseQuery(state: BuyerBrowseLocation): string {
  const params = new URLSearchParams();
  if (state.categoryId && validBuyerProductId(state.categoryId))
    params.set("categoryId", state.categoryId.toLowerCase());
  if (validBuyerSearch(state.search) && state.search.trim())
    params.set("search", state.search.trim());
  if (Number.isSafeInteger(state.page) &&
    state.page >= 2 && state.page <= 10000)
    params.set("page", String(state.page));
  return params.toString();
}

export function buyerBrowseHref(state: BuyerBrowseLocation): string {
  const query = buyerBrowseQuery(state);
  return "/" + (query ? "?" + query : "");
}

export function buyerDetailHref(
  id: string, state: BuyerBrowseLocation,
): string | null {
  if (!validBuyerProductId(id)) return null;
  const query = buyerBrowseQuery(state);
  return "/products/" + id.toLowerCase() + (query ? "?" + query : "");
}

/** Preserve only plain string search params emitted by Next's server props. */
export function buyerParamsFromRecord(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["categoryId", "search", "page"]) {
    const value = raw[key];
    // Repeated keys are not a valid saved browse state.
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}
