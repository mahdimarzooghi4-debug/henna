import { MarketplaceChrome } from "../../../components/marketplace-chrome";
import { FigmaOrderTracking } from "../../../components/figma-order-tracking";

export default function BuyerTrackingPreviewPage() {
  return <><MarketplaceChrome basket /><FigmaOrderTracking /><MarketplaceChrome basket footerOnly /></>;
}
