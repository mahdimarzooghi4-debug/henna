import HennaHomepage from "../components/henna-homepage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "خرید روزمره، با اثری فراتر از خرید | حنا",
  description: "خرید کالاهای روزمره از فروشگاه‌های نزدیک، با مقایسه قیمت و پیشنهادهای حنا.",
};

export default function HomePage() {
  return <HennaHomepage />;
}
