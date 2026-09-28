"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddReferenceCartItem } from "./buyer-reference-cart";
import {
  BUYER_OFFERS_PAGE_SIZE, parseBuyerOfferPage, parseBuyerProduct,
  validBuyerProductId, type BuyerOffer, type BuyerOfferPage, type BuyerProduct,
} from "../lib/buyer-catalog";

type Detail =
  | { status: "loading"; id: string }
  | { status: "missing"; id: string }
  | { status: "unavailable"; id: string }
  | { status: "ok"; id: string; product: BuyerProduct };

/** DRAFT Figma 480:2–480:3 adds the published seller-offer read model. */
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
          {current.product.kind === "GOOD" ? (
            <>
              <BuyerOffers productId={current.product.id} reloadToken={retry} />
              <AddReferenceCartItem product={current.product} />
            </>
          ) : (
            <p className="buyer-detail-disclosure">
              پیشنهاد فروش کالای فیزیکی برای این خدمت نمایش داده نمی‌شود.
            </p>
          )}
          <p className="buyer-detail-disclosure">
            قیمت و مقدار، دادهٔ پیشنهاد منتشرشدهٔ فروشنده است؛ مقدار اعلام‌شده تضمین موجودی لحظه‌ای نیست و رزرو، ارسال یا خرید در این مرحله انجام نمی‌شود.
          </p>
        </>
      )}
      <Link href={backHref} className="buyer-detail-button buyer-detail-button--back">
        بازگشت به فهرست کالاها
      </Link>
      {current.status === "ok" && current.product.kind === "SERVICE" && (
        <Link href="/buyer/cart" className="buyer-detail-button buyer-detail-button--back">
          مشاهدهٔ سبد مرجع
        </Link>
      )}
    </main>
  );
}


type OffersState =
  | { status: "loading"; productId: string; page: number; reloadToken: number }
  | { status: "unavailable"; productId: string; page: number; reloadToken: number }
  | { status: "ok"; productId: string; page: number; reloadToken: number; data: BuyerOfferPage };

function BuyerOffers({ productId, reloadToken }: {
  productId: string; reloadToken: number;
}) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<OffersState>({
    status: "loading", productId, page: 1, reloadToken,
  });
  const current: OffersState = state.productId === productId &&
    state.page === page && state.reloadToken === reloadToken
    ? state : { status: "loading", productId, page, reloadToken };

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    setState({ status: "loading", productId, page, reloadToken });
    void (async () => {
      try {
        const response = await fetch(
          "/api/catalog/products/" + encodeURIComponent(productId) +
            "/offers?page=" + page + "&pageSize=" + BUYER_OFFERS_PAGE_SIZE,
          {
            method: "GET", cache: "no-store", credentials: "omit",
            redirect: "error",
            headers: { Accept: "application/json", "Cache-Control": "no-store" },
            signal: abort.signal,
          },
        );
        if (response.status !== 200 ||
          !response.headers.get("content-type")?.includes("application/json"))
          throw Error("offers not confirmed");
        const data = parseBuyerOfferPage(
          await response.json() as unknown, page, BUYER_OFFERS_PAGE_SIZE,
        );
        if (!data) throw Error("offers invalid");
        if (active) setState({
          status: "ok", productId, page, reloadToken, data,
        });
      } catch {
        if (active) setState({
          status: "unavailable", productId, page, reloadToken,
        });
      }
    })();
    return () => { active = false; abort.abort(); };
  }, [productId, page, reloadToken, retry]);

  const start = (page - 1) * BUYER_OFFERS_PAGE_SIZE;
  const pageCount = current.status === "ok"
    ? Math.max(1, Math.ceil(current.data.total / BUYER_OFFERS_PAGE_SIZE)) : 1;
  return (
    <section className="buyer-offers" aria-labelledby="buyer-offers-title">
      <h2 id="buyer-offers-title">پیشنهادهای منتشرشدهٔ فروشندگان</h2>
      {current.status === "loading" ? (
        <p role="status" className="buyer-offers-status">در حال دریافت پیشنهادها…</p>
      ) : current.status === "unavailable" ? (
        <div className="buyer-offers-status" role="alert">
          <p>دریافت پیشنهادها تأیید نشد؛ وضعیت نامشخص به معنای نبود پیشنهاد نیست.</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            تلاش دوباره
          </button>
        </div>
      ) : current.data.total === 0 ? (
        <p className="buyer-offers-status">در حال حاضر پیشنهاد منتشرشده‌ای برای این کالا ثبت نشده است.</p>
      ) : (
        <>
          <ul className="buyer-offers-list">
            {current.data.items.map((offer) => (
              <li className="buyer-offer" key={offer.id}>
                <strong>{offer.sellerName}</strong>
                <span>قیمت هر واحد: {formatRials(offer.priceRials)}</span>
                <span>مقدار اعلام‌شده: {formatQuantity(offer)} {offer.unitName}</span>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <nav className="buyer-offers-pagination" aria-label="صفحه‌های پیشنهادها">
              <button type="button" disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}>
                قبلی
              </button>
              <span>صفحهٔ {page} از {pageCount}</span>
              <button type="button" disabled={page >= pageCount}
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                بعدی
              </button>
            </nav>
          )}
          <p className="buyer-offers-count">نمایش {start + 1} تا {Math.min(start + current.data.items.length, current.data.total)} از {current.data.total} پیشنهاد</p>
        </>
      )}
    </section>
  );
}

function formatRials(value: number): string {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 })
    .format(value) + " ریال";
}

function formatQuantity(offer: BuyerOffer): string {
  return new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: offer.quantityScale,
    maximumFractionDigits: offer.quantityScale,
  }).format(offer.sellableQuantity);
}
