import { SiteHeader } from "../../../components/site-header";
import { BuyerReferenceCartPage } from "../../../components/buyer-reference-cart";

export default function BuyerCartRoute() {
  return <><SiteHeader backHref="/" backLabel="بازگشت به فهرست" /><BuyerReferenceCartPage /></>;
}
