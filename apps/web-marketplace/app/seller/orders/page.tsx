import { redirect } from "next/navigation";
import { SellerOrdersReview } from "./orders-review";

export const metadata = { title: "مدیریت سفارش‌ها | پنل فروشنده حنا" };
export const dynamic = "force-dynamic";

export default function SellerOrdersPage() {
  // Reuse the existing server-only Stage review switch. No seller session or
  // commerce mutation is created by this visual review route.
  if (process.env.HANA_AUTH_UI_PREVIEW !== "1") redirect("/seller");
  return <SellerOrdersReview />;
}
