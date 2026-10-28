import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../../components/landing-chrome";
import { RegistrationForm } from "./registration-form";
export const metadata:Metadata={title:"ثبت‌نام فروشگاه در حنا",description:"اطلاعات اولیه فروشگاه برای ثبت‌نام در حنا"};
export default function SellerRegistrationPage(){return <><LandingHeader/><main><div className="page-intro page-intro--seller"><h1>ثبت‌نام فروشگاه در حنا</h1><p>فروشگاه شما بعد از بررسی و تأیید می‌تواند در شبکه فروشندگان حنا فعال شود.</p></div><RegistrationForm/></main><LandingFooter/></>;}