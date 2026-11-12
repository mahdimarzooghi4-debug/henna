/**
 * Owner-approved *navigation* classification for the buyer catalog.
 * This is NOT product eligibility, an approved discount or a commerce price.
 * No trusted public catalog API currently exposes this evidence, so the
 * corresponding product list stays fail-closed until an authoritative read
 * contract exists.
 */
export const CATALOG_COLLECTIONS = {
  henna: {
    title: "طرح‌های ویژه حنا",
    description: "طرح‌های ویژه حنا همان تخفیف‌های حنا هستند؛ تخفیف‌هایی که خود حنا روی کالاها قرار می‌دهد، پس از تأیید و انتشار اطلاعات معتبر.",
    source: "HENNA",
  },
  golden: {
    title: "تخفیف‌های طلایی",
    description: "تخفیف‌های طلایی همان تخفیف‌های مغازه هستند؛ مغازه‌دار برای کالاهای فروشگاه خودش تخفیف تعریف می‌کند.",
    source: "SELLER",
  },
  kalabarg: {
    title: "کالابرگ الکترونیکی",
    description: "کالاهایی که مشمولیت کالابرگ آن‌ها از مرجع معتبر تأیید شده باشد؛ بدون استعلام خودکار موجودی یا مشمولیت شخص.",
    source: "OFFICIAL_ELIGIBILITY",
  },
} as const;

export type CatalogCollection = keyof typeof CATALOG_COLLECTIONS;
export type CatalogCollectionSelection = CatalogCollection | "invalid" | null;

export function catalogCollectionHref(collection: CatalogCollection): string {
  return "/products?collection=" + collection;
}

export function parseCatalogCollection(raw: unknown): CatalogCollectionSelection {
  if (raw === undefined) return null;
  if (typeof raw === "string" && Object.hasOwn(CATALOG_COLLECTIONS, raw))
    return raw as CatalogCollection;
  return "invalid";
}

/** Source-backed feature selection requires authoritative data before products are shown. */
export function parseCatalogFeatureSet(raw: unknown): CatalogCollection[] | null {
  if (raw === undefined) return [];
  if (typeof raw !== "string" || raw.length > 64) return null;
  const values = raw.split(",");
  if (!values.length || values.length > 3 || new Set(values).size !== values.length ||
    !values.every(value => Object.hasOwn(CATALOG_COLLECTIONS, value))) return null;
  return values as CatalogCollection[];
}
