"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  BUYER_PAGE_SIZE, buyerCatalogPath, parseBuyerCategories,
  parseBuyerPage, validBuyerSearch,
  type BuyerCategory, type BuyerPage,
} from "../lib/buyer-catalog";

type Load<T> =
  | { status: "loading"; key: string }
  | { status: "unavailable"; key: string }
  | { status: "ok"; key: string; data: T };

async function publicJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    method: "GET", cache: "no-store", credentials: "omit",
    redirect: "error",
    headers: { Accept: "application/json", "Cache-Control": "no-store" },
    signal,
  });
  if (response.status !== 200 ||
    !response.headers.get("content-type")?.includes("application/json"))
    throw Error("catalog not confirmed");
  return response.json() as Promise<unknown>;
}

/** Figma 476:3/476:4 (empty) + 478:2/478:22 (API-backed); approved by owner. */
export function BuyerBrowse() {
  const [categories, setCategories] = useState<Load<BuyerCategory[]>>({
    status: "loading", key: "0",
  });
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [searchError, setSearchError] = useState("");
  const [page, setPage] = useState(1);
  const [productRetry, setProductRetry] = useState(0);
  const [products, setProducts] = useState<Load<BuyerPage>>({
    status: "loading", key: "",
  });
  const path = buyerCatalogPath(page, selected, search);
  const current = products.key === path && products.status !== "loading"
    ? products : { status: "loading" as const, key: path };

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    setCategories({ status: "loading", key: String(categoryRetry) });
    void publicJson("/api/catalog/categories", abort.signal)
      .then(parseBuyerCategories)
      .then((data) => {
        if (!active) return;
        setCategories(data === null
          ? { status: "unavailable", key: String(categoryRetry) }
          : { status: "ok", key: String(categoryRetry), data });
      })
      .catch(() => {
        if (active) setCategories({
          status: "unavailable", key: String(categoryRetry),
        });
      });
    return () => { active = false; abort.abort(); };
  }, [categoryRetry]);

  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    setProducts({ status: "loading", key: path });
    void publicJson(path, abort.signal)
      .then((data) => parseBuyerPage(data, page))
      .then((data) => {
        if (!active) return;
        setProducts(data === null
          ? { status: "unavailable", key: path }
          : { status: "ok", key: path, data });
      })
      .catch(() => {
        if (active) setProducts({ status: "unavailable", key: path });
      });
    return () => { active = false; abort.abort(); };
  }, [path, page, productRetry]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validBuyerSearch(draftSearch)) {
      setSearchError("جست‌وجو باید حداکثر ۸۰ نویسه و بدون نویسهٔ کنترلی باشد.");
      return;
    }
    setSearchError("");
    const term = draftSearch.trim();
    setPage(1);
    if (term === search && page === 1) setProductRetry((n) => n + 1);
    setSearch(term);
  }

  function chooseCategory(id: string | null) {
    setSelected(id);
    setPage(1);
  }

  return (
    <main dir="rtl" className="buyer-main">
      <div className="buyer-intro">
        <p className="buyer-intro__eyebrow">مرور کاتالوگ حنا</p>
        <h1>کالاها را در حنا مرور کنید</h1>
        <p>دسته‌بندی‌ها و کالاها تنها در صورت تأیید و انتشار در کاتالوگ حنا نمایش داده می‌شوند.</p>
      </div>

      <form className="buyer-search" onSubmit={submitSearch} role="search">
        <label className="buyer-visually-hidden" htmlFor="buyer-search">جست‌وجو در نام کالاها</label>
        <input id="buyer-search" name="search" type="search" maxLength={80}
          value={draftSearch} onChange={(event) => {
            setDraftSearch(event.target.value);
            setSearchError("");
          }} placeholder="جست‌وجو در نام کالاها..."
          aria-invalid={searchError ? true : undefined}
          aria-describedby={searchError ? "buyer-search-error" : undefined} />
        <button type="submit">جست‌وجو</button>
      </form>
      {searchError && <p id="buyer-search-error" className="buyer-error" role="alert">{searchError}</p>}

      <section className="buyer-section" aria-labelledby="buyer-categories-title">
        <h2 id="buyer-categories-title">دسته‌بندی‌ها</h2>
        {categories.status === "loading" ? (
          <p className="buyer-panel" role="status">در حال دریافت دسته‌بندی‌ها…</p>
        ) : categories.status === "unavailable" ? (
          <div className="buyer-panel buyer-panel--error" role="alert">
            <p>دریافت دسته‌بندی‌ها از سرور تأیید نشد.</p>
            <button type="button" onClick={() => setCategoryRetry((n) => n + 1)}>تلاش دوباره برای دسته‌بندی‌ها</button>
          </div>
        ) : categories.data.length === 0 ? (
          <p className="buyer-panel">هنوز دسته‌بندی قابل نمایش در حنا ثبت نشده است.</p>
        ) : (
          <div className="buyer-panel buyer-categories" aria-label="فیلتر دسته‌بندی">
            <button className="buyer-chip" type="button" aria-pressed={selected === null}
              onClick={() => chooseCategory(null)}>همه دسته‌ها</button>
            {categories.data.map((item) => (
              <button key={item.id} className="buyer-chip" type="button"
                aria-pressed={selected === item.id}
                onClick={() => chooseCategory(item.id)}>{item.name}</button>
            ))}
          </div>
        )}
      </section>

      <section className="buyer-section" aria-labelledby="buyer-products-title">
        <h2 id="buyer-products-title">کالاها</h2>
        {current.status === "loading" ? (
          <p className="buyer-panel buyer-products-status" role="status">در حال دریافت کالاها…</p>
        ) : current.status === "unavailable" ? (
          <div className="buyer-panel buyer-products-status buyer-panel--error" role="alert">
            <h3>دریافت کالاها تأیید نشد</h3>
            <p>ارتباط با کاتالوگ برقرار نشد یا پاسخ قابل اعتماد نبود؛ دوباره تلاش کنید.</p>
            <button type="button" onClick={() => setProductRetry((n) => n + 1)}>تلاش دوباره برای کالاها</button>
          </div>
        ) : current.data.items.length === 0 ? (
          <div className="buyer-panel buyer-products-status">
            <h3>فعلاً کالایی برای نمایش نداریم</h3>
            <p>{search || selected
              ? "در این جست‌وجو یا دسته‌بندی کالای منتشرشده‌ای پیدا نشد."
              : "فهرست واقعی پس از تأیید و انتشار کالاها اینجا ظاهر می‌شود."} نمایش قیمت، سبد خرید و ثبت سفارش در این نسخه فعال نیست.</p>
          </div>
        ) : (
          <>
            <div className="buyer-panel buyer-product-wrap">
              <ul className="buyer-products" aria-label="فهرست کالاهای منتشرشده">
                {current.data.items.map((item) => (
                  <li className="buyer-product" key={item.id}>
                    <h3><Link className="buyer-product__link" href={`/products/${item.id}`} aria-label={`جزئیات ${item.name}`}>{item.name}</Link></h3>
                    <p className="buyer-product__kind">{item.kind === "SERVICE" ? "خدمت" : "کالا"}</p>
                    {item.description && <p>{item.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
            <nav className="buyer-pagination" aria-label="صفحه‌بندی کالاها">
              <span>صفحهٔ {current.data.page} از {Math.max(1,
                Math.ceil(current.data.total / BUYER_PAGE_SIZE))}</span>
              <button type="button" disabled={page === 1}
                onClick={() => setPage((n) => Math.max(1, n - 1))}>صفحهٔ قبل</button>
              <button type="button" disabled={
                page >= 10000 || page * BUYER_PAGE_SIZE >= current.data.total
              } onClick={() => setPage((n) => n + 1)}>صفحهٔ بعد</button>
            </nav>
            <p className="buyer-not-commerce">این فهرست صرفاً برای مرور است؛ قیمت، موجودی و امکان خرید هنوز فعال نیست.</p>
          </>
        )}
      </section>
    </main>
  );
}
