import type { Metadata } from "next";
import { SellerRegistrationShell } from "../seller-registration-shell";
import { PublicSellerIntakeStatus } from "./public-status";

export const metadata:Metadata={
  title:"پیگیری درخواست عمومی فروشندگی | حنا",
  description:"پیگیری رسید درخواست همکاری بدون حساب خریدار",
};
export default function PublicSellerStatusPage(){
  return <SellerRegistrationShell>
    <section className="seller-intro-summary">
      <h1>رسید درخواست همکاری فروشگاه</h1>
      <p>این رسید فقط در مرورگری نمایش داده می‌شود که درخواست را ثبت کرده است.</p>
    </section>
    <PublicSellerIntakeStatus />
  </SellerRegistrationShell>;
}
