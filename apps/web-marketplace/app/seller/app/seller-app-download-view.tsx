"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Result = { kind: "loading" | "sign-in" | "not-active" | "unavailable" | "pending" }
  | { kind: "ready"; url: string };

export function SellerAppDownloadView() {
  const [result, setResult] = useState<Result>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/seller/mobile-download", {
      method: "GET", cache: "no-store", credentials: "same-origin",
      redirect: "error", signal: controller.signal,
    }).then(async response => {
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        setResult({ kind: "sign-in" }); return;
      }
      if (response.status === 403) {
        setResult({ kind: "not-active" }); return;
      }
      if (response.status !== 200) {
        setResult({ kind: "unavailable" }); return;
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" ||
          !("available" in payload) || typeof payload.available !== "boolean") {
        setResult({ kind: "unavailable" }); return;
      }
      if (!payload.available) {
        setResult({ kind: "pending" }); return;
      }
      if (!("url" in payload) || typeof payload.url !== "string" ||
          !payload.url.startsWith("https://")) {
        setResult({ kind: "unavailable" }); return;
      }
      setResult({ kind: "ready", url: payload.url });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ kind: "unavailable" });
    });
    return () => controller.abort();
  }, []);

  return (
    <section className="surface-card" style={{ padding: 28, margin: "26px 0 70px" }}
      aria-label="دریافت اپ فروشنده">
      {result.kind === "loading" && <p role="status">در حال بررسی دسترسی شما…</p>}
      {result.kind === "sign-in" && <>
        <p>برای دریافت لینک اختصاصی فروشندگان، ابتدا وارد حساب خود شوید.</p>
        <Link href="/auth" className="site-header__back">ورود به حنا</Link>
      </>}
      {result.kind === "not-active" && <>
        <p role="status">دسترسی دریافت اپ فروشنده هنوز فعال نیست. تأیید درخواست و فعال‌سازی حساب باید هر دو تکمیل شده باشند.</p>
        <Link href="/seller/register/status" className="site-header__back">پیگیری وضعیت فروشندگی</Link>
      </>}
      {result.kind === "pending" && <p role="status">
        حساب شما فعال است، اما نسخه قابل دانلود اپ فروشنده هنوز برای انتشار تأیید نشده است.
      </p>}
      {result.kind === "unavailable" && <p role="alert">
        وضعیت دسترسی یا انتشار اپ در حال حاضر قابل تأیید نیست. بعداً دوباره بررسی کنید.
      </p>}
      {result.kind === "ready" && <>
        <p>حساب فروشندگی شما فعال است. نسخه رسمی اندروید از لینک زیر قابل دریافت است.</p>
        <a href={result.url} rel="noopener noreferrer" className="primary-button"
          style={{ display: "inline-block", width: "auto", textDecoration: "none" }}>
          دریافت اپ فروشنده
        </a>
      </>}
    </section>
  );
}
