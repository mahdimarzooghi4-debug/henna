"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { addBuyerDemoCartItem } from "../lib/buyer-demo-cart";
import {
  BUYER_PAGE_SIZE, buyerCatalogPath, buyerBrowseHref,
  buyerDetailHref, parseBuyerBrowseLocation, parseBuyerCategories,
  parseBuyerPage, reconcilePublishedBuyerCategory,
  reconcilePublishedBuyerPage, validBuyerSearch,
  type BuyerBrowseLocation, type BuyerCategory, type BuyerPage,
} from "../lib/buyer-catalog";

type Load<T> =
  | { status: "loading"; key: string }
  | { status: "unavailable"; key: string }
  | { status: "ok"; key: string; data: T };

const productImages = [
  "/landing/figma/product-rice.png", "/landing/figma/product-oil.png",
  "/landing/figma/product-cheese.png", "/landing/figma/product-tea.png",
  "/landing/figma/product-yogurt.png",
];

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
export function BuyerBrowse({ initialQuery = "" }: { initialQuery?: string }) {
  // Parse server-provided URL before the first paint or catalog request:
  // a directly shared /?page=2&search=... must not flash page 1 results.
  const initial = parseBuyerBrowseLocation(new URLSearchParams(initialQuery));
  const [categories, setCategories] = useState<Load<BuyerCategory[]>>({
    status: "loading", key: "0",
  });
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [categoryRecovery, setCategoryRecovery] = useState("");
  const [pageRecovery, setPageRecovery] = useState("");
  const [selected, setSelected] = useState<string | null>(initial.categoryId);
  const [draftSearch, setDraftSearch] = useState(initial.search);
  const [search, setSearch] = useState(initial.search);
  const [searchError, setSearchError] = useState("");
  const [addedProduct, setAddedProduct] = useState<string | null>(null);
  const [sort, setSort] = useState<"newest" | "name" | "kind">("newest");
  const [page, setPage] = useState(initial.page);
  const [productRetry, setProductRetry] = useState(0);
  const [products, setProducts] = useState<Load<BuyerPage>>({
    status: "loading", key: "",
  });
  const path = buyerCatalogPath(page, selected, search);
  const current = products.key === path && products.status !== "loading"
    ? products : { status: "loading" as const, key: path };
  const locationState: BuyerBrowseLocation = {
    categoryId: selected, search, page,
  };
  const visibleItems = current.status === "ok" ? [...current.data.items].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "fa");
    if (sort === "kind") return a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "fa");
    return 0;
  }) : [];

  function setBrowseLocation(next: BuyerBrowseLocation) {
    setSelected(next.categoryId);
    setSearch(next.search);
    setDraftSearch(next.search);
    setPage(next.page);
    setSearchError("");
    setCategoryRecovery("");
    setPageRecovery("");
    // Native browser Back/Forward and copied URLs restore the same approved
    // public catalog query. No arbitrary return URL or private state.
    const pathname = window.location.pathname === "/products" ? "/products" : "/";
    const href = buyerBrowseHref(next, pathname);
    if ((window.location.pathname === "/" || window.location.pathname === "/products") &&
      window.location.pathname + window.location.search !== href)
      window.history.pushState(window.history.state, "", href);
  }

  useEffect(() => {
    function restore() {
      if (window.location.pathname !== "/" && window.location.pathname !== "/products") return;
      const next = parseBuyerBrowseLocation(
        new URLSearchParams(window.location.search),
      );
      setSelected(next.categoryId);
      setSearch(next.search);
      setDraftSearch(next.search);
      setPage(next.page);
      setSearchError("");
      setCategoryRecovery("");
      setPageRecovery("");
      const href = buyerBrowseHref(next, window.location.pathname);
      if (window.location.pathname + window.location.search !== href)
        window.history.replaceState(window.history.state, "", href);
    }
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [initialQuery]);

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

  useEffect(() => {
    // The published taxonomy is authoritative only after a valid 200. An
    // old bookmark can point to a category that is no longer published;
    // a 503 must NOT be mistaken for a removed category.
    if (categories.status !== "ok") return;
    const next = reconcilePublishedBuyerCategory(
      { categoryId: selected, search, page }, categories.data,
    );
    if (!next) return;
    setSelected(next.categoryId);
    setPage(next.page);
    setCategoryRecovery(
      "دسته‌بندی انتخاب‌شده دیگر منتشر نیست؛ همهٔ دسته‌ها نمایش داده می‌شوند.",
    );
    setPageRecovery("");
    // Correct this SAME history entry rather than creating a ghost "Back"
    // step that reinstates the removed category. Preserve public search.
    const href = buyerBrowseHref(next, window.location.pathname);
    if ((window.location.pathname === "/" || window.location.pathname === "/products") &&
      window.location.pathname + window.location.search !== href)
      window.history.replaceState(window.history.state, "", href);
  }, [categories, selected, search, page]);

  useEffect(() => {
    // A real 200 may confirm that a saved page no longer exists after
    // unpublication. Do not mislabel it "no products" when page one still
    // contains published results; a 503/malformed response cannot repair it.
    if (current.status !== "ok") return;
    const next = reconcilePublishedBuyerPage(
      { categoryId: selected, search, page }, current.data,
    );
    if (!next) return;
    // When a saved category is selected, wait for its taxonomy response so
    // simultaneous category removal takes priority over page-only recovery.
    if (categories.status === "loading" && selected !== null) return;
    // Let the existing category recovery take priority when a confirmed
    // published taxonomy has also removed the selected category.
    if (categories.status === "ok" && reconcilePublishedBuyerCategory(
      { categoryId: selected, search, page }, categories.data,
    )) return;
    setPage(next.page);
    setPageRecovery(
      "صفحهٔ ذخیره‌شده دیگر در فهرست منتشرشده موجود نیست؛ صفحهٔ اول نمایش داده می‌شود.",
    );
    // Replace the SAME history entry; preserve category and Persian search.
    const href = buyerBrowseHref(next, window.location.pathname);
    if ((window.location.pathname === "/" || window.location.pathname === "/products") &&
      window.location.pathname + window.location.search !== href)
      window.history.replaceState(window.history.state, "", href);
  }, [categories, current, selected, search, page]);

  useEffect(() => {
    // Mobile browsers can freeze this page for a long time and restore it
    // without remounting React. Do not leave the buyer looking at a cached
    // category/product page until they manually change the search.
    let lastRefreshAt = -Infinity;
    function revalidateOnReturn() {
      if (document.visibilityState !== "visible" ||
        window.location.pathname !== "/" && window.location.pathname !== "/products") return;
      // Safari can emit both visibilitychange and persisted pageshow on one
      // return. Treat them as one refresh rather than racing duplicate GETs.
      const now = performance.now();
      if (now - lastRefreshAt < 500) return;
      lastRefreshAt = now;
      // Invalidate old result immediately, before the effect sends the new
      // public HTTP request. Never label old items as the resumed query.
      setProducts((current) => ({ status: "loading", key: current.key }));
      setCategoryRetry((n) => n + 1);
      setProductRetry((n) => n + 1);
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
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validBuyerSearch(draftSearch)) {
      setSearchError("جست‌وجو باید حداکثر ۸۰ نویسه و بدون نویسهٔ کنترلی باشد.");
      return;
    }
    setSearchError("");
    const term = draftSearch.trim();
    if (term === search && page === 1) setProductRetry((n) => n + 1);
    setBrowseLocation({ categoryId: selected, search: term, page: 1 });
  }

  function chooseCategory(id: string | null) {
    // A category filter can only be selected from current published API data.
    if (id !== null && (categories.status !== "ok" ||
      !categories.data.some((category) => category.id === id))) return;
    setBrowseLocation({ categoryId: id, search, page: 1 });
  }

  function choosePage(nextPage: number) {
    if (current.status !== "ok" || nextPage < 1 || nextPage > 10000 ||
      (nextPage - 1) * BUYER_PAGE_SIZE >= current.data.total) return;
    setBrowseLocation({ categoryId: selected, search, page: nextPage });
  }

  return (
    <main dir="rtl" className="buyer-main">
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

      <section className="buyer-section buyer-catalog-layout" aria-labelledby="buyer-products-title">
        <aside className="buyer-filter buyer-panel" aria-label="فیلترهای کالا">
          <h2>فیلترها</h2>
          <div className="buyer-filter-group"><h3>دسته‌بندی</h3>
            <button className="buyer-filter-option" type="button" aria-pressed={selected === null} onClick={() => chooseCategory(null)}><span>همه دسته‌ها</span><i/></button>
            {categories.status === "loading" ? <p role="status">دریافت دسته‌بندی‌ها…</p> : categories.status === "unavailable" ? <div role="alert"><p>دریافت دسته‌بندی‌ها ممکن نشد.</p><button type="button" onClick={() => setCategoryRetry((n) => n + 1)}>تلاش دوباره</button></div> : categories.data.map((item) => <button key={item.id} className="buyer-filter-option" type="button" aria-pressed={selected === item.id} onClick={() => chooseCategory(item.id)}><span>{item.name}</span><i/></button>)}
          </div>
          <div className="buyer-filter-group"><h3>ویژگی‌ها</h3><p className="buyer-filter-note">فیلترهای قیمت و موجودی بعد از اتصال پیشنهاد فروشندگان فعال می‌شوند.</p></div>
        </aside>
        <div className="buyer-catalog-results">
        <div className="buyer-catalog-toolbar">
          <div className="buyer-catalog-chips" aria-label="دسته‌بندی فعال">
            <button type="button" aria-pressed={selected === null} onClick={() => chooseCategory(null)}>همه</button>
            {categories.status === "ok" && categories.data.slice(0, 3).map((category) => <button key={category.id} type="button" aria-pressed={selected === category.id} onClick={() => chooseCategory(category.id)}>{category.name}</button>)}
          </div>
          <div className="buyer-sort" role="group" aria-label="مرتب‌سازی کالاها"><span>مرتب‌سازی:</span>{([ ["newest", "پیش‌فرض"], ["name", "نام کالا"], ["kind", "نوع کالا"] ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={sort === key} onClick={() => setSort(key)}>{label}</button>)}</div>
        </div>
        <div className="buyer-catalog-heading"><h1 id="buyer-products-title">{search ? `نتایج جست‌وجو برای «${search}»` : "کالاها و خدمات حنا"}</h1><p>اطلاعات کالاها از کاتالوگ منتشرشده دریافت می‌شود؛ قیمت و موجودی هنوز اعلام نشده است.</p></div>
        {pageRecovery && (
          <p className="buyer-panel" role="status">{pageRecovery}</p>
        )}
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
                {visibleItems.map((item, index) => (
                  <li className="buyer-product" key={item.id}>
                    <Link className="buyer-product-image" href={buyerDetailHref(item.id, locationState) ?? "/"} aria-label={`مشاهده ${item.name}`}><img src={productImages[index % productImages.length]} alt="تصویر نمونه از طرح فیگما" /><span>{item.kind === "SERVICE" ? "خدمات محلی" : "کالای محلی"}</span></Link>
                    <h3><Link className="buyer-product__link" href={buyerDetailHref(item.id, locationState) ?? "/"}>{item.name}</Link></h3>
                    <p className="buyer-product__kind">{item.kind === "SERVICE" ? "خدمت" : "کالا"}{item.description ? ` · ${item.description}` : ""}</p>
                    <div className="buyer-product-actions"><button className="buyer-product__add" type="button" onClick={() => {
                      addBuyerDemoCartItem({
                        id: item.id, name: item.name, detail: item.description ?? "",
                        kind: item.kind, unitPrice: null, image: null,
                      });
                      setAddedProduct(item.id);
                      window.setTimeout(() => setAddedProduct((current) => current === item.id ? null : current), 1400);
                    }}>{addedProduct === item.id ? "به سبد اضافه شد ✓" : "افزودن +"}</button><span>قیمت اعلام نشده</span></div>
                  </li>
                ))}
              </ul>
            </div>
            <nav className="buyer-pagination" aria-label="صفحه‌بندی کالاها">
              <span>صفحهٔ {current.data.page} از {Math.max(1,
                Math.ceil(current.data.total / BUYER_PAGE_SIZE))}</span>
              <button type="button" disabled={page === 1}
                onClick={() => choosePage(page - 1)}>صفحهٔ قبل</button>
              <button type="button" disabled={
                page >= 10000 || page * BUYER_PAGE_SIZE >= current.data.total
              } onClick={() => choosePage(page + 1)}>صفحهٔ بعد</button>
            </nav>
            <p className="buyer-not-commerce">تصاویر در این پیش‌نمایش نمونهٔ فیگما هستند. قیمت، موجودی فروشگاه و پرداخت زنده به سرویس فروشندگان نیاز دارد.</p>
          </>
        )}
        {categoryRecovery && categories.status === "ok" && <p className="buyer-panel" role="status">{categoryRecovery}</p>}
        </div>
      </section>
    </main>
  );
}
