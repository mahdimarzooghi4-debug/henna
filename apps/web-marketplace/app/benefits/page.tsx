import { headers } from "next/headers";
import { LandingFooter, LandingHeader } from "../../components/landing-chrome";
import { FigmaBuyerServices } from "../../components/figma-buyer-services";

export const metadata = { title: "اعتبارهای من | حنا" };

/**
 * Only our Stage host (or an explicitly opted-in local developer) may render
 * fictional example cards. Live credit data always uses the authenticated BFF.
 * ?mode=live overrides Stage preview for testing the real read-only flow.
 */
export default async function BenefitsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const [params, requestHeaders] = await Promise.all([searchParams, headers()]);
  const hostname = (requestHeaders.get("host") ?? "").toLowerCase().split(":")[0];
  const stage = hostname === "henna-stage.onrender.com";
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const previewCredits = params.mode !== "live" &&
    (stage || (local && params.mode === "preview"));
  // Legacy ?section=plans URLs still resolve to this single buyer credit view.
  return <><LandingHeader/><FigmaBuyerServices kind="credits" previewCredits={previewCredits}/><LandingFooter accountPage/></>;
}
