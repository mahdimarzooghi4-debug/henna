import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
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
      <SiteHeader backHref="/" backLabel="صفحهٔ اصلی حنا" />
      <BuyerBrowse initialQuery={query} />
    </>
  );
}
