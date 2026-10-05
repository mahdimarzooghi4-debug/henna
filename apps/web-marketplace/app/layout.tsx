import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/700.css";
import "./globals.css";
import { PublicFooter } from "../components/public-footer";

export const metadata: Metadata = {
  title: "حنا",
  description: "سامانه حنا",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}<PublicFooter /></body>
    </html>
  );
}
