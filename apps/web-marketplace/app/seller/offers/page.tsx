import type { Metadata } from "next";
import { SellerGoodsOffersView } from "./offers-view";

export const metadata: Metadata = {
  title: "کالاهای فروشگاه | پنل فروشنده حنا",
  description: "مدیریت پیشنهاد کالاهای فروشگاه در حنا",
};

export default function SellerGoodsOffersPage() {
  return <SellerGoodsOffersView />;
}
