export type ReferenceCartItem = { productId: string; quantity: number; unitName: string; quantityScale: number };
export type ReferenceCart = { revision: number; items: ReferenceCartItem[] };
export type CartOfferLine = {
  productId: string; offerId: string; priceRials: number;
  sellableQuantity: number; requestedQuantity: number; unitName: string;
  quantityScale: number; coversRequestedQuantity: boolean; updatedAtUtc: string;
};
export type CartOfferSeller = { sellerPublicId: string; sellerName: string; offers: CartOfferLine[] };
export type CartOfferComparisonItem = ReferenceCartItem & {
  status: "CATALOG_UNAVAILABLE" | "CATALOG_CHANGED" | "HAS_PUBLISHED_OFFERS" | "NO_PUBLISHED_OFFERS";
};
export type CartOfferComparison = {
  cartRevision: number; items: CartOfferComparisonItem[]; sellers: CartOfferSeller[];
};
type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => x !== null && typeof x === "object" && !Array.isArray(x);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const words = (x: unknown, max: number): x is string => typeof x === "string" && !!x.trim() && x.length <= max && !/[\u0000-\u001f\u007f]/.test(x);
const validId = (x: unknown): x is string => typeof x === "string" && uuid.test(x) && x !== "00000000-0000-0000-0000-000000000000";
const date = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$/.test(x) && Number.isFinite(Date.parse(x));
const validQuantity = (quantity: unknown, scale: unknown): quantity is number => {
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000_000 || !Number.isInteger(scale) || (scale as number) < 0 || (scale as number) > 6) return false;
  const factor = 10 ** (scale as number);
  return Math.abs(quantity * factor - Math.round(quantity * factor)) <= 1e-7;
};
export function parseReferenceCart(raw: unknown): ReferenceCart | null {
  if (!object(raw) || !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 0 || !Array.isArray(raw.items) || raw.items.length > 100) return null;
  const items: ReferenceCartItem[] = [], seen = new Set<string>();
  for (const value of raw.items) {
    if (!object(value) || Object.keys(value).sort().join("|") !== "productId|quantity|quantityScale|unitName" || typeof value.productId !== "string" || !uuid.test(value.productId) || value.productId === "00000000-0000-0000-0000-000000000000" || typeof value.quantity !== "number" || !Number.isFinite(value.quantity) || value.quantity <= 0 || value.quantity > 1_000_000_000_000 || typeof value.unitName !== "string" || !value.unitName.trim() || value.unitName.length > 40 || !Number.isInteger(value.quantityScale) || (value.quantityScale as number) < 0 || (value.quantityScale as number) > 6 || seen.has(value.productId.toLowerCase())) return null;
    const factor = 10 ** (value.quantityScale as number);
    if (Math.abs(value.quantity * factor - Math.round(value.quantity * factor)) > 1e-7) return null;
    seen.add(value.productId.toLowerCase());
    items.push({ productId: value.productId, quantity: value.quantity, unitName: value.unitName, quantityScale: value.quantityScale as number });
  }
  return { revision: raw.revision as number, items };
}

/** Fail closed on unknown, stale or malformed comparison data. */
export function parseCartOfferComparison(raw: unknown): CartOfferComparison | null {
  if (!object(raw) || Object.keys(raw).sort().join("|") !== "cartRevision|items|sellers" || !Number.isSafeInteger(raw.cartRevision) || (raw.cartRevision as number) < 0 || !Array.isArray(raw.items) || raw.items.length > 100 || !Array.isArray(raw.sellers) || raw.sellers.length > 2000) return null;
  const items: CartOfferComparisonItem[] = [], itemById = new Map<string, CartOfferComparisonItem>();
  for (const value of raw.items) {
    if (!object(value) || Object.keys(value).sort().join("|") !== "productId|quantity|quantityScale|status|unitName" || !validId(value.productId) || !validQuantity(value.quantity, value.quantityScale) || !words(value.unitName, 40) || !["CATALOG_UNAVAILABLE", "CATALOG_CHANGED", "HAS_PUBLISHED_OFFERS", "NO_PUBLISHED_OFFERS"].includes(String(value.status)) || itemById.has(value.productId.toLowerCase())) return null;
    const item: CartOfferComparisonItem = { productId: value.productId, quantity: value.quantity, unitName: value.unitName, quantityScale: value.quantityScale as number, status: value.status as CartOfferComparisonItem["status"] };
    itemById.set(item.productId.toLowerCase(), item); items.push(item);
  }
  const sellers: CartOfferSeller[] = [], sellerIds = new Set<string>(), offerCounts = new Map<string, number>();
  let totalOffers = 0;
  for (const value of raw.sellers) {
    if (!object(value) || Object.keys(value).sort().join("|") !== "offers|sellerName|sellerPublicId" || !validId(value.sellerPublicId) || !words(value.sellerName, 160) || !Array.isArray(value.offers) || value.offers.length > 100 || sellerIds.has(value.sellerPublicId.toLowerCase())) return null;
    sellerIds.add(value.sellerPublicId.toLowerCase());
    const offers: CartOfferLine[] = [], productsForSeller = new Set<string>();
    for (const candidate of value.offers) {
      if (!object(candidate) || Object.keys(candidate).sort().join("|") !== "coversRequestedQuantity|offerId|priceRials|productId|quantityScale|requestedQuantity|sellableQuantity|unitName|updatedAtUtc" || !validId(candidate.productId) || !validId(candidate.offerId) || !Number.isSafeInteger(candidate.priceRials) || (candidate.priceRials as number) <= 0 || (candidate.priceRials as number) > Number.MAX_SAFE_INTEGER || !validQuantity(candidate.sellableQuantity, candidate.quantityScale) || !validQuantity(candidate.requestedQuantity, candidate.quantityScale) || !words(candidate.unitName, 40) || typeof candidate.coversRequestedQuantity !== "boolean" || candidate.coversRequestedQuantity !== ((candidate.sellableQuantity as number) >= (candidate.requestedQuantity as number)) || !date(candidate.updatedAtUtc) || productsForSeller.has(candidate.productId.toLowerCase())) return null;
      const cartItem = itemById.get((candidate.productId as string).toLowerCase());
      if (!cartItem || cartItem.status === "CATALOG_UNAVAILABLE" || cartItem.status === "CATALOG_CHANGED" || cartItem.quantity !== candidate.requestedQuantity || cartItem.unitName !== candidate.unitName || cartItem.quantityScale !== candidate.quantityScale) return null;
      productsForSeller.add(candidate.productId.toLowerCase());
      offerCounts.set(candidate.productId.toLowerCase(), (offerCounts.get(candidate.productId.toLowerCase()) ?? 0) + 1);
      offers.push({ productId: candidate.productId, offerId: candidate.offerId, priceRials: candidate.priceRials as number, sellableQuantity: candidate.sellableQuantity as number, requestedQuantity: candidate.requestedQuantity as number, unitName: candidate.unitName, quantityScale: candidate.quantityScale as number, coversRequestedQuantity: candidate.coversRequestedQuantity, updatedAtUtc: candidate.updatedAtUtc });
    }
    totalOffers += offers.length;
    if (totalOffers > 2000) return null;
    sellers.push({ sellerPublicId: value.sellerPublicId, sellerName: value.sellerName, offers });
  }
  for (const item of items) {
    const count = offerCounts.get(item.productId.toLowerCase()) ?? 0;
    if ((item.status === "HAS_PUBLISHED_OFFERS") !== (count > 0)) return null;
  }
  return { cartRevision: raw.cartRevision as number, items, sellers };
}
