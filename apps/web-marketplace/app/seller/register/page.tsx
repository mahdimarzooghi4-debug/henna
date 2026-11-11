import type { Metadata } from "next";
import { SellerRegistrationShell } from "./seller-registration-shell";
import { SellerRegistrationStart } from "./seller-registration-start";

export const metadata:Metadata={
  title:"ثبت‌نام فروشندگان و ارائه‌دهندگان | حنا",
  description:"شروع ثبت‌نام آزاد فروشنده و پیگیری درخواست، بدون حساب خریدار",
};
export default function SellerRegistrationPage(){
  return <SellerRegistrationShell><SellerRegistrationStart /></SellerRegistrationShell>;
}
