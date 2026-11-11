import { LandingHeader, LandingFooter } from "../../../components/landing-chrome";
import { BuyerBnplPayments } from "../../../components/buyer-bnpl-payments";

export const metadata = {
  title: "روش‌های پرداخت و اعتبار اقساطی | حنا",
  description: "آشنایی با شرکت‌های مستقل ارائه‌دهنده اعتبار خرید و وضعیت استفاده از آن‌ها در حنا.",
};

export default function Page() {
  return <><LandingHeader/><BuyerBnplPayments/><LandingFooter accountPage/></>;
}
