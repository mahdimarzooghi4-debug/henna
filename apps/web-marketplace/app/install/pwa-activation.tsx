"use client";

import { useEffect, useState } from "react";
import styles from "./install.module.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaActivation({startUrl, label}: {startUrl: string; label: string}) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "other">("other");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setPlatform(ios ? "ios" : "other");

    const iosStandalone = "standalone" in navigator &&
      Boolean((navigator as Navigator & {standalone?: boolean}).standalone);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
    if (standalone) {
      window.location.replace(startUrl);
      return;
    }

    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/pwa-sw.js", {scope: "/"}).catch(() => {
        // Installation remains available from the browser menu without a worker.
      });
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setStatus("اپلیکیشن حنا به صفحه اصلی اضافه شد.");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [startUrl]);

  async function installApp() {
    if (!installPrompt) return;
    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setStatus(choice.outcome === "accepted"
      ? "درخواست نصب پذیرفته شد؛ آیکون حنا را در صفحه اصلی پیدا کنید."
      : "نصب انجام نشد؛ می‌توانید از منوی مرورگر دوباره اقدام کنید.");
  }

  return (
    <div className={styles.installBox} data-testid="pwa-activation">
      {installPrompt ? (
        <button className={styles.installButton} type="button" onClick={() => void installApp()}>
          نصب PWA {label}
        </button>
      ) : null}
      <p className={styles.installStatus} role="status" aria-live="polite">
        {status || (installed
          ? "نسخه نصب‌شده آماده استفاده است."
          : platform === "ios"
            ? "در آیفون، نصب از Safari و منوی اشتراک‌گذاری انجام می‌شود."
            : "در اندروید یا Chrome، از دکمه نصب یا منوی مرورگر استفاده کنید.")}
      </p>
      <p className={styles.installName}>نام برنامه پس از نصب: <strong>حنا {label}</strong></p>
    </div>
  );
}
