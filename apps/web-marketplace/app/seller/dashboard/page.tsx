import { redirect } from "next/navigation";
import { SellerDashboardReview } from "./dashboard-review";
export const metadata = { title: "پیشخوان مدیریت کسب‌وکار | حنا" };
export const dynamic = "force-dynamic";
export default function SellerDashboardPage() {
  if (process.env.HANA_AUTH_UI_PREVIEW !== "1") redirect("/seller");
  return <SellerDashboardReview />;
}
