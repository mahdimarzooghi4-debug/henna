import { SiteHeader } from "../../../components/site-header";
import { BuyerReferenceCartPage } from "../../../components/buyer-reference-cart";
import { LandingDemoCartPage } from "../../../components/landing-demo-cart";
import { MarketplaceChrome } from "../../../components/marketplace-chrome";

type BuyerCartRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BuyerCartRoute({ searchParams }: BuyerCartRouteProps) {
  const params = await searchParams;
  const mode = Array.isArray(params?.mode) ? params.mode[0] : params?.mode;
  if (mode === "preview") {
    return <><MarketplaceChrome basket /><LandingDemoCartPage /><MarketplaceChrome basket footerOnly /></>;
  }
  return <><SiteHeader backHref="/" backLabel="بازگشت به فهرست" /><BuyerReferenceCartPage /></>;
}
