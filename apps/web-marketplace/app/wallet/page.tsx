import type { Metadata } from "next";
import { BuyerWalletCenter } from "../../components/buyer-wallet-center";

export const metadata: Metadata = {
  title: "کیف پول | حنا",
  description: "موجودی نقدی و درخواست برداشت حساب خریدار حنا",
};

export default function BuyerWalletPage(){
  return <BuyerWalletCenter />;
}
