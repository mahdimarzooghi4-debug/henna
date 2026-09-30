import type { Metadata } from "next";
import { SellerDashboardView } from "./dashboard-view";

export const metadata: Metadata = {
  title: "پنل فروشنده حنا",
  description: "پیشخوان مدیریت کسب‌وکار فعال‌شده در حنا",
};

export default function SellerPanelPage() {
  return <SellerDashboardView />;
}
