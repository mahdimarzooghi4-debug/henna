import { LandingFooter, LandingHeader } from "../../../components/landing-chrome";
import { FigmaOrderTracking } from "../../../components/figma-order-tracking";

export default function BuyerTrackingPreviewPage() {
  return <><LandingHeader orderTrackingPage /><FigmaOrderTracking /><LandingFooter /></>;
}
