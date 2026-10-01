import type { Metadata } from "next";
import { BuyerAddresses } from "../../../components/buyer-addresses";

export const metadata: Metadata = {
  title: "مدیریت آدرس‌ها | حنا",
  description: "ثبت و مدیریت نشانی‌های تحویل در حنا",
};

export default function AddressesPage() {
  return <BuyerAddresses />;
}
