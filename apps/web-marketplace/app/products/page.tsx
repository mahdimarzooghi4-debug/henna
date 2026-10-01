import type { Metadata } from "next";
import { MarketplaceChrome } from "../../components/marketplace-chrome";
import { BuyerBrowse } from "../../components/buyer-browse";
import {
  buyerBrowseQuery,
  buyerParamsFromRecord,
  parseBuyerBrowseLocation,
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
  const query = buyerBrowseQuery(parseBuyerBrowseLocation(
    buyerParamsFromRecord(await searchParams),
  ));

  return (
    <>
      <MarketplaceChrome />
      <BuyerBrowse initialQuery={query} />
      <MarketplaceChrome footerOnly />
    </>
  );
}
