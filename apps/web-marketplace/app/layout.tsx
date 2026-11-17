import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./buyer-offers.css";

export const metadata: Metadata = {
  title: "حنا",
  description: "سامانه حنا",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
