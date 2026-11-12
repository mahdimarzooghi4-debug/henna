import type { Metadata } from "next";
import { SupportCommerceView } from "./support-view";

export const metadata: Metadata = {
  title: "پنل پشتیبانی حنا",
  description: "بررسی انسانی گزارش آسیب، کسری و مرجوعی در حنا",
};

export default function SupportPage() {
  return <SupportCommerceView />;
}
