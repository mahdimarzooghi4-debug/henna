import type { Metadata } from "next";
import { LandingFooter, LandingHeader } from "../../../components/landing-chrome";
import { RegistrationForm } from "./registration-form";
export const metadata:Metadata={title:"ثبت‌نام فروشگاه در حنا",description:"اطلاعات اولیه فروشگاه برای ثبت‌نام در حنا"};
export default function SellerRegistrationPage(){return <><LandingHeader/><main className="seller-registration-page"><section className="seller-intro-summary"><h1>ثبت‌نام فروشنده / ارائه‌دهنده</h1><p>فروشندگان و ارائه‌دهندگان کالا یا خدمات می‌توانند درخواست همکاری خود را در همین حساب ثبت کنند.</p></section><RegistrationForm/></main><LandingFooter/></>;}