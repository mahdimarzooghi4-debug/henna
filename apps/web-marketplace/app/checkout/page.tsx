import { SiteHeader } from "../../components/site-header";
import { BuyerCheckout } from "../../components/buyer-checkout";
export default function CheckoutPage() { return <><SiteHeader commerce backHref="/cart" backLabel="بازگشت به سبد"/><BuyerCheckout/></>; }
