"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  parseBuyerProduct, validBuyerProductId, type BuyerProduct,
} from "../lib/buyer-catalog";

type Detail =
  | { status: "loading"; id: string }
  | { status: "missing"; id: string }
  | { status: "unavailable"; id: string }
  | { status: "ok"; id: string; product: BuyerProduct };

/** Owner-approved Figma 480:2–480:7: published / 404 / unavailable. */
export function BuyerProductDetail({ id, backHref }: {
  id: string; backHref: string;
}) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<Detail>({ status: "loading", id });
  // Never paint previous product while a new route ID is being fetched.
  const current: Detail = state.id === id
    ? state : { status: "loading", id };

  useEffect(() => {
    if (!validBuyerProductId(id)) {
      setState({ status: "missing", id });
      return;
    }
    const abort = new AbortController();
    let active = true;
    setState({ status: "loading", id });
    void (async () => {
      try {
        const response = await fetch(
          "/api/catalog/products/" + encodeURIComponent(id), {
            method: "GET", cache: "no-store", credentials: "omit",
            redirect: "error",
            headers: {
              Accept: "application/json", "Cache-Control": "no-store",
            },
            signal: abort.signal,
          },
        );
        if (response.status === 404) {
          if (active) setState({ status: "missing", id });
          return;
        }
        if (response.status !== 200 ||
          !response.headers.get("content-type")?.includes("application/json"))
          throw Error("detail not confirmed");
        const parsed = parseBuyerProduct(await response.json() as unknown, id);
        if (active) setState(parsed
          ? { status: "ok", id, product: parsed }
          : { status: "unavailable", id });
      } catch {
        if (active) setState({ status: "unavailable", id });
      }
    })();
    return () => { active = false; abort.abort(); };
  }, [id, retry]);

  useEffect(() => {
    // Mobile browsers may restore this mounted detail from a frozen tab or
    // back-forward cache without re-running the initial fetch. A previously
    // published item must not remain a trusted detail indefinitely.
    let lastRefreshAt = -Infinity;
    function revalidateOnReturn() {
      if (document.visibilityState !== "visible" ||
        !window.location.pathname.startsWith("/products/") ||
        !validBuyerProductId(id)) return;
      // One mobile restore can emit both events. Keep a single fresh GET.
      const now = performance.now();
      if (now - lastRefreshAt < 500) return;
      lastRefreshAt = now;
      // Hide old detail immediately, including when it previously was 404.
      // The fetch effect aborts its prior request when retry changes.
      setState({ status: "loading", id });
      setRetry((n) => n + 1);
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) revalidateOnReturn();
    };
    document.addEventListener("visibilitychange", revalidateOnReturn);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", revalidateOnReturn);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [id]);

  return (
    <main dir="rtl" className="buyer-detail-main">
      <p className="buyer-detail-eyebrow">جزئیات کاتالوگ عمومی حنا</p>
      <h1>جزئیات کالا یا خدمت</h1>
      <p className="buyer-detail-intro">
        فقط اطلاعات منتشرشده از API حنا؛ خرید در این مرحله فعال نیست.
      </p>

      {current.status === "loading" ? (
        <div className="buyer-detail-card buyer-detail-card--status"
          role="status">در حال دریافت جزئیات…</div>
      ) : current.status === "missing" ? (
        <div className="buyer-detail-card buyer-detail-card--status">
          <h2>این کالا یا خدمت پیدا نشد</h2>
          <p>این شناسه در کاتالوگ منتشرشدهٔ حنا قابل مشاهده نیست.</p>
        </div>
      ) : current.status === "unavailable" ? (
        <>
          <div className="buyer-detail-card buyer-detail-card--status" role="alert">
            <h2 className="buyer-detail-error">دریافت جزئیات تأیید نشد</h2>
            <p>قطع ارتباط یا پاسخ نامعتبر به معنای نبود کالا نیست؛ دوباره تلاش کنید.</p>
          </div>
          <button type="button" className="buyer-detail-button buyer-detail-button--primary"
            onClick={() => setRetry((n) => n + 1)}>
            تلاش دوباره برای دریافت جزئیات
          </button>
        </>
      ) : (
        <>
          <article className="buyer-detail-card">
            <p className="buyer-detail-card__eyebrow">محتوای منتشرشدهٔ کاتالوگ</p>
            <h2>{current.product.name}</h2>
            <p className="buyer-detail-kind">نوع: {
              current.product.kind === "SERVICE" ? "خدمت" : "کالا"
            }</p>
            <p className="buyer-detail-category">
              شناسهٔ دسته‌بندی: <bdi dir="ltr">{current.product.categoryId}</bdi>
            </p>
            {current.product.description !== null &&
              <p className="buyer-detail-description">{current.product.description}</p>}
          </article>
          <p className="buyer-detail-disclosure">
            قیمت، موجودی، تصویر، فروشنده، شهر و دکمهٔ خرید هنوز در قرارداد عمومی وجود ندارند.
          </p>
        </>
      )}
      <Link href={backHref} className="buyer-detail-button buyer-detail-button--back">
        بازگشت به فهرست کالاها
      </Link>
    </main>
  );
}
