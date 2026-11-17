import type { Metadata } from "next";
import { parseCatalogCollection, parseCatalogFeatureSet } from "../../lib/buyer-catalog-collections";
import { MarketplaceChrome } from "../../components/marketplace-chrome";
import { BuyerBrowse } from "../../components/buyer-browse";
import {
  buyerBrowseQuery, parseBuyerCategorySet,
  buyerParamsFromRecord,
  parseBuyerBrowseLocation,
  validBuyerSearch,
} from "../../lib/buyer-catalog";

export const metadata: Metadata = {
  title: "کاتالوگ کالاها | حنا",
  description: "مرور کالاها و دسته‌بندی‌های منتشرشده در کاتالوگ حنا.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const browseState = parseBuyerBrowseLocation(buyerParamsFromRecord(params));
  const categoryName = typeof params.categoryName === "string" &&
    validBuyerSearch(params.categoryName)
    ? params.categoryName.trim() : "";
  const query = buyerBrowseQuery(browseState);
  const collection = parseCatalogCollection(params.collection);
  const multiCategoryIds = parseBuyerCategorySet(params.categoryIds);
  const invalidMultiCategoryIds = params.categoryIds !== undefined &&
    (multiCategoryIds === null || browseState.categoryId !== null || Boolean(categoryName));
  const selectedFeatures = parseCatalogFeatureSet(params.features);

  return (
    <>
      <MarketplaceChrome initialSearch={browseState.search} activeCollection={collection} />
      <BuyerBrowse initialQuery={query} initialCategoryName={categoryName} initialCollection={collection}
        initialMultiCategoryIds={multiCategoryIds} invalidMultiCategoryIds={invalidMultiCategoryIds}
        initialFeatures={selectedFeatures ?? []} invalidFeatures={selectedFeatures === null} />
      <MarketplaceChrome footerOnly />
    </>
  );
}
