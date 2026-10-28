import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../../../components/landing-chrome";
import { SellerApplicationStatusView } from "./status-view";
export const metadata:Metadata={title:"وضعیت درخواست فروشندگی حنا",description:"پیگیری وضعیت درخواست ثبت‌نام فروشنده در حنا"};
export default function SellerApplicationStatusPage(){return <><LandingHeader/><main><SellerApplicationStatusView/></main><LandingFooter/></>;}