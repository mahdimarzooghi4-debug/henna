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
    description: "تخفیف‌های تعریف‌شده توسط خود حنا، فقط پس از تأیید و انتشار اطلاعات معتبر.",
    source: "HENNA",
  },
  golden: {
    title: "تخفیف‌های طلایی",
    description: "تخفیف‌هایی که فروشگاه‌دار برای کالاهای فروشگاه خودش تعریف کرده است.",
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
