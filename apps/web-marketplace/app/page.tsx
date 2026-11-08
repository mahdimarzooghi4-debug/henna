import { SiteHeader } from "../components/site-header";
import { BuyerBrowse } from "../components/buyer-browse";
import { BuyerAppBanner } from "../components/buyer-app-banner";
import {
  buyerBrowseQuery, buyerParamsFromRecord, parseBuyerBrowseLocation,
} from "../lib/buyer-catalog";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = buyerBrowseQuery(parseBuyerBrowseLocation(
    buyerParamsFromRecord(await searchParams),
  ));
  return (
    <>
      <SiteHeader backHref="/auth" backLabel="ورود / ثبت‌نام" />
      <BuyerAppBanner />
      <BuyerBrowse initialQuery={query} />
    </>
  );
}
