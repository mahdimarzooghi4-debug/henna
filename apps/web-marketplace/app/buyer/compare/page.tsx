import { MarketplaceChrome } from "../../../components/marketplace-chrome";
import { FigmaSellerComparisonPreview } from "../../../components/figma-seller-comparison-preview";

export default function BuyerComparePreviewPage() {
  return <><MarketplaceChrome basket /><FigmaSellerComparisonPreview /><MarketplaceChrome basket footerOnly /></>;
}
