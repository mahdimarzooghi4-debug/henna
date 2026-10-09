import type { Metadata } from "next";
import { BuyerAccountCenter } from "../../components/buyer-account-center";

export const metadata: Metadata = {
  title: "اعلان‌ها و پشتیبانی | حنا",
  description: "اعلان‌ها و تیکت‌های پشتیبانی حساب خریدار حنا",
};

export default function BuyerAccountPage() {
  return <BuyerAccountCenter />;
}
