"use client";

import { useEffect } from "react";

export function PwaActivation({startUrl}: {startUrl: string}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const iosStandalone = "standalone" in navigator && Boolean((navigator as Navigator & {standalone?: boolean}).standalone);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
    if (standalone) {
      // Safari can launch the installation URL rather than the manifest start_url.
      window.location.replace(startUrl);
      return;
    }
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/pwa-sw.js", {scope: "/"}).catch(() => {
        // Installing to the Home Screen must remain possible if SW is blocked.
      });
    }
  }, [startUrl]);
  return null;
}
