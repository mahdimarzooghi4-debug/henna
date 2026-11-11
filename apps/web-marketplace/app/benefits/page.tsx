import { LandingFooter, LandingHeader } from "../../components/landing-chrome";
import { FigmaBuyerServices } from "../../components/figma-buyer-services";

export const metadata = { title: "اعتبارهای من | حنا" };

// Legacy ?section=plans URLs intentionally resolve to the single buyer credit view.
// Organization program management remains in the organization portal.
export default function BenefitsPage() {
  return <><LandingHeader/><FigmaBuyerServices kind="credits"/><LandingFooter accountPage/></>;
}
