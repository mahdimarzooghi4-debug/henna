import type { Metadata } from "next";
import { MarketplaceChrome } from "../../components/marketplace-chrome";
import { BuyerBrowse } from "../../components/buyer-browse";
import {
  buyerBrowseQuery,
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

  return (
    <>
      <MarketplaceChrome initialSearch={browseState.search} />
      <BuyerBrowse initialQuery={query} initialCategoryName={categoryName} />
      <MarketplaceChrome footerOnly />
    </>
  );
}
