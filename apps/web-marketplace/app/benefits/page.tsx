import { LandingFooter, LandingHeader } from "../../components/landing-chrome";
import { FigmaBuyerServices } from "../../components/figma-buyer-services";
export const metadata={title:"اعتبارها و طرح‌های من | حنا"};
export default async function BenefitsPage({searchParams}:{searchParams:Promise<{section?:string}>}){const section=(await searchParams).section==="credits"?"credits":"plans";return <><LandingHeader/><FigmaBuyerServices key={section} kind="credits" section={section}/><LandingFooter accountPage/></>;}