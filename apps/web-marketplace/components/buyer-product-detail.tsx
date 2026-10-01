"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  parseBuyerProduct, validBuyerProductId, type BuyerProduct,
} from "../lib/buyer-catalog";
import { addBuyerDemoCartItem } from "../lib/buyer-demo-cart";
import { BUYER_FIGMA_DEMO_PRODUCTS } from "../lib/buyer-figma-demo";

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
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<Detail>({ status: "loading", id });
  // Never paint previous product while a new route ID is being fetched.
  const current: Detail = state.id === id
    ? state : { status: "loading", id };
  const figmaProduct = current.status === "ok"
    ? BUYER_FIGMA_DEMO_PRODUCTS.find((item) => item.id === current.product.id)
    : undefined;

  useEffect(() => {
    const figmaProduct = BUYER_FIGMA_DEMO_PRODUCTS.find((item) => item.id === id);
    if (figmaProduct) {
      setState({ status: "ok", id, product: figmaProduct });
      return;
    }
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
        !validBuyerProductId(id) ||
        BUYER_FIGMA_DEMO_PRODUCTS.some((item) => item.id === id)) return;
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
          <div className="buyer-detail-layout">
            <div className="buyer-detail-copy">
              <p className="buyer-detail-eyebrow">{current.product.kind === "SERVICE" ? "خدمات محلی" : "کالاهای محلی"}</p>
              <h1>{current.product.name}</h1>
              <p className="buyer-detail-weight">{current.product.kind === "SERVICE" ? "جزئیات خدمت" : "اطلاعات و مشخصات کالا"}</p>
              <article className="buyer-detail-offer">
                <div className="buyer-detail-base-price"><span>{figmaProduct ? "قیمت نمونه فیگما" : "قیمت پایه بازار (حدودی)"}</span><strong>{figmaProduct ? `${figmaProduct.samplePrice} تومان` : "قیمت از فروشنده دریافت نشده"}</strong></div>
                <p className="buyer-detail-hint">با افزودن کالا به سبد می‌توانید آن را برای مقایسه فروشگاه‌های نزدیک نگه دارید.</p>
                <div className="buyer-detail-actions">
                  <div className="buyer-detail-quantity" aria-label="تعداد کالا"><button type="button" onClick={() => setQuantity((n) => Math.min(99, n + 1))} aria-label="افزایش تعداد">＋</button><span>{new Intl.NumberFormat("fa-IR").format(quantity)}</span><button type="button" onClick={() => setQuantity((n) => Math.max(1, n - 1))} aria-label="کاهش تعداد">−</button></div>
                  <button type="button" className="buyer-detail-button buyer-detail-button--primary" onClick={() => {
                    for (let i = 0; i < quantity; i++) addBuyerDemoCartItem({
                      id: current.product.id, name: current.product.name,
                      detail: current.product.description ?? "",
                      kind: current.product.kind, unitPrice: null, image: "/landing/figma/product-cheese.png",
                    });
                    setAdded(true);
                    window.setTimeout(() => setAdded(false), 1500);
                  }}>{added ? "به سبد اضافه شد ✓" : "افزودن به سبد خرید"}</button>
                </div>
                <Link href="/basket" className="buyer-detail-basket-link">مشاهده سبد خرید</Link>
              </article>
              <article className="buyer-detail-specs">
                <h2>مشخصات و ویژگی‌های محصول</h2>
                <p><strong>نوع</strong><span>{current.product.kind === "SERVICE" ? "خدمت" : "کالا"}</span></p>
                <p><strong>شناسه دسته‌بندی</strong><bdi dir="ltr">{current.product.categoryId}</bdi></p>
                {current.product.description && <p><strong>توضیحات</strong><span>{current.product.description}</span></p>}
              </article>
              <p className="buyer-detail-disclosure">تصویرها صرفاً برای پیش‌نمایش طراحی هستند. قیمت، موجودی، فروشنده و پرداخت زنده از API عمومی در دسترس نیستند.</p>
            </div>
            <div className="buyer-detail-gallery">
              <div className="buyer-detail-main-image"><img src={activeImage === 0 ? figmaProduct?.image ?? "/landing/figma/product-cheese.png" : "/landing/figma/product-yogurt.png"} alt="تصویر نمونه محصول در طرح فیگما" /></div>
              <div className="buyer-detail-thumbnails" aria-label="تصاویر نمونه محصول">
                {[0, 1].map((index) => <button key={index} type="button" aria-pressed={activeImage === index} onClick={() => setActiveImage(index)} aria-label={`تصویر نمونه ${index + 1}`}><img src={index === 0 ? figmaProduct?.image ?? "/landing/figma/product-cheese.png" : "/landing/figma/product-yogurt.png"} alt="" /></button>)}
              </div>
            </div>
          </div>
        </>
      )}
      <Link href={backHref} className="buyer-detail-button buyer-detail-button--back">
        بازگشت به فهرست کالاها
      </Link>
    </main>
  );
}
