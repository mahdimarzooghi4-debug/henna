import type { Metadata } from "next";
import { SellerRegistrationShell } from "../seller-registration-shell";
import { PublicSellerRegistrationForm } from "../public-registration-form";

export const metadata:Metadata={
  title:"درخواست همکاری فروشندگان | حنا",
  description:"ثبت درخواست همکاری فروشگاه بدون ورود به حساب خریدار",
};
export default function NewSellerRegistrationPage(){
  return <SellerRegistrationShell>
    <PublicSellerRegistrationForm />
  </SellerRegistrationShell>;
}
