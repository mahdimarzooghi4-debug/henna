import type { Metadata } from "next";
import HennaHomepage from "../components/henna-homepage";

export const metadata: Metadata = {
  title: "حنا(حمایت های نوآورانه اجتماعی)",
  description: "بازارگاه حنا؛ خرید روزانه از فروشگاه‌های محلی و مشارکت در توسعه اجتماعی.",
};

export default function HomePage() {
  return <HennaHomepage />;
}
