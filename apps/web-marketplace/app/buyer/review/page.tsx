import { MarketplaceChrome } from "../../../components/marketplace-chrome";
import { FigmaBasketReviewPreview } from "../../../components/figma-basket-review-preview";

export default function BuyerBasketReviewPreviewPage() {
  return <><MarketplaceChrome basket /><FigmaBasketReviewPreview /><MarketplaceChrome basket footerOnly /></>;
}
