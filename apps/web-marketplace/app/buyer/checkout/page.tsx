import { MarketplaceChrome } from "../../../components/marketplace-chrome";
import { FigmaCheckoutPreview } from "../../../components/figma-checkout-preview";

export default function BuyerCheckoutPreviewPage() {
  return <><MarketplaceChrome basket /><FigmaCheckoutPreview /><MarketplaceChrome basket footerOnly /></>;
}
