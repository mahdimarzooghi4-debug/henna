import type { Metadata } from "next";
import HennaHomepage from "../components/henna-homepage";

export const metadata: Metadata = {
  title: "خرید روزمره، با اثری فراتر از خرید | حنا",
  description: "بازارگاه حنا؛ خرید روزانه از فروشگاه‌های محلی و مشارکت در توسعه اجتماعی.",
};

export default function HomePage() {
  return <HennaHomepage />;
}
