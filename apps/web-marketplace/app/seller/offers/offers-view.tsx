"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type Offer = {
  id: string; catalogProductId: string; status: "DRAFT" | "PUBLISHED" | "PAUSED";
  revision: number; priceRials: number | null; sellableQuantity: number | null;
  createdAtUtc: string; updatedAtUtc: string;
  catalogProduct: {
    id: string; name: string; categoryName: string;
    description: string | null; primaryMediaRoute: string | null;
    unitName: string | null; quantityScale: number | null;
  } | null;
};
type Good = {
  id: string; name: string; categoryName: string; unitName: string;
  quantityScale: number;
};
type PageState = "loading" | "ready" | "denied";

const iranDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const normalizeDigits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String(iranDigits.indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
  .replace(/٬/g, "").replace(/٫/g, ".").trim();
const formatRials = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const newKey = () => crypto.randomUUID();

async function json<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" &&
      "message" in body && typeof body.message === "string"
      ? body.message : "درخواست انجام نشد. دوباره تلاش کنید.";
    throw new Error(message);
  }
  return body as T;
}

export function SellerGoodsOffersView() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [goods, setGoods] = useState<Good[]>([]);
  const [goodsTotal, setGoodsTotal] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [selected, setSelected] = useState<Offer | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdOfferId, setCreatedOfferId] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const draftId = useRef<string | null>(null);
  const revision = useRef<number>(1);
  const createKey = useRef(newKey());
  const updateKey = useRef(newKey());
  const publishKey = useRef(newKey());

  const loadOffers = useCallback(async () => {
    const result = await json<{ items: Offer[] }>(await fetch("/api/seller/offers", {
      cache: "no-store",
    }));
    setOffers(result.items);
  }, []);

  const loadGoods = useCallback(async (query: string) => {
    const params = new URLSearchParams({ page: "1", pageSize: "50" });
    if (query.trim()) params.set("search", query.trim());
    const result = await json<{ items: Good[]; total: number }>(await fetch(
      `/api/seller/catalog/goods?${params.toString()}`, { cache: "no-store" },
    ));
    setGoods(result.items);
    setGoodsTotal(result.total);
  }, []);

  const reload = useCallback(async () => {
    setPageState("loading"); setError("");
    try {
      await Promise.all([loadOffers(), loadGoods("")]);
      setPageState("ready");
    } catch (reason) {
      setPageState("denied");
      setError(reason instanceof Error ? reason.message : "فهرست کالاها در دسترس نیست.");
    }
  }, [loadGoods, loadOffers]);

  useEffect(() => { void reload(); }, [reload]);

  function openCreate() {
    setSelected(null); setIsCreating(true); setProductId("");
    setSearchDraft("");
    setCreatedOfferId(null);
    setPrice(""); setQuantity(""); setMessage(""); setError("");
    draftId.current = null; revision.current = 1;
    createKey.current = newKey(); updateKey.current = newKey(); publishKey.current = newKey();
  }

  function openEdit(offer: Offer) {
    setSelected(offer); setIsCreating(false); setProductId(offer.catalogProductId);
    setCreatedOfferId(null);
    setPrice(offer.priceRials === null ? "" : String(offer.priceRials));
    setQuantity(offer.sellableQuantity === null ? "" : String(offer.sellableQuantity));
    setMessage(""); setError("");
    draftId.current = offer.id; revision.current = offer.revision;
    updateKey.current = newKey(); publishKey.current = newKey();
  }

  function closeForm() {
    setSelected(null); setIsCreating(false); setMessage(""); setError("");
    setCreatedOfferId(null);
    draftId.current = null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const selectedGood = goods.find((good) => good.id === productId);
      const priceRials = Number(normalizeDigits(price));
      const sellableQuantity = Number(normalizeDigits(quantity));
      if (!Number.isSafeInteger(priceRials) || priceRials < 1 ||
        !Number.isFinite(sellableQuantity) || sellableQuantity <= 0)
        throw new Error("قیمت به ریال و موجودی قابل عرضه را درست وارد کنید.");
      const decimalPlaces = Number(normalizeDigits(quantity)).toString().split(".")[1];
      if (selectedGood && decimalPlaces !== undefined && decimalPlaces.length > selectedGood.quantityScale)
        throw new Error(`دقت موجودی برای این کالا حداکثر ${selectedGood.quantityScale} رقم اعشار است.`);
      if (!draftId.current) {
        if (!selectedGood) throw new Error("یک کالای موجود در کاتالوگ انتخاب کنید.");
        const created = await json<Offer>(await fetch("/api/seller/offers", {
          method: "POST", cache: "no-store",
          headers: { "content-type": "application/json", "idempotency-key": createKey.current },
          body: JSON.stringify({ catalogProductId: productId }),
        }));
        draftId.current = created.id; revision.current = created.revision;
        setCreatedOfferId(created.id);
      }
      const offerId = draftId.current;
      const updated = await json<{ revision: number }>(await fetch(`/api/seller/offers/${offerId}`, {
        method: "PUT", cache: "no-store",
        headers: { "content-type": "application/json", "idempotency-key": updateKey.current },
        body: JSON.stringify({ expectedRevision: revision.current, priceRials, sellableQuantity }),
      }));
      revision.current = updated.revision;
      updateKey.current = newKey();
      publishKey.current = newKey();
      const published = await json<Offer>(await fetch(`/api/seller/offers/${offerId}/publish`, {
        method: "POST", cache: "no-store",
        headers: { "content-type": "application/json", "idempotency-key": publishKey.current },
        body: JSON.stringify({ expectedRevision: revision.current }),
      }));
      publishKey.current = newKey();
      const catalogProduct = selectedGood ? {
        id: selectedGood.id, name: selectedGood.name,
        categoryName: selectedGood.categoryName, description: null,
        primaryMediaRoute: null, unitName: selectedGood.unitName,
        quantityScale: selectedGood.quantityScale,
      } : selected?.catalogProduct ?? null;
      setOffers((current) => [{ ...published, catalogProduct },
        ...current.filter((item) => item.id !== published.id)]);
      closeForm();
      setMessage("پیشنهاد کالا منتشر شد.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ثبت پیشنهاد تأیید نشد.");
      if (draftId.current) {
        setMessage("پیش‌نویس در حنا ایجاد یا به‌روزرسانی شده است. برای هماهنگ‌کردن نسخه، به فهرست برگردید و دوباره بارگذاری کنید.");
      }
    } finally { setBusy(false); }
  }

  const formVisible = isCreating || selected !== null;
  const chosenGood = goods.find((good) => good.id === productId);

  return (
    <main className="seller-offers-shell" dir="rtl">
      <header className="seller-offers-topbar">
        <Link href="/" className="seller-offers-brand"><strong>حنا</strong><span>بازارگاه حنا</span></Link>
        <span>پنل فروشنده</span>
      </header>
      <div className="seller-offers-layout">
        <section className="seller-offers-content">
          {pageState === "loading" ? <p className="form-status" role="status">در حال دریافت فهرست کالاها…</p> : null}
          {pageState === "denied" ? <div className="seller-offers-error" role="alert">{error}<button type="button" onClick={() => void reload()}>تلاش دوباره</button></div> : null}
          {pageState === "ready" && !formVisible ? <>
            <div className="seller-offers-heading">
              <div><h1>کالاهای فروشگاه</h1><p>پیشنهادهای کالایی فروشگاه خود را از کاتالوگ حنا مدیریت کنید.</p></div>
              <div className="seller-offers-heading__actions"><button type="button" className="seller-offers-secondary" onClick={() => void reload()}>تازه‌سازی</button><button type="button" className="seller-offers-primary" onClick={openCreate}>افزودن کالای فروشگاه</button></div>
            </div>
            {message ? <p className="seller-offers-success" role="status">{message}</p> : null}
            {offers.length === 0 ? <section className="seller-offers-empty">
              <div className="seller-offers-empty-mark" aria-hidden="true">＋</div>
              <h2>هنوز کالایی به فروشگاه اضافه نکرده‌اید</h2>
              <p>برای شروع، یک کالا از کاتالوگ حنا انتخاب و قیمت و موجودی آن را ثبت کنید.</p>
              <button type="button" className="seller-offers-primary" onClick={openCreate}>افزودن کالای فروشگاه</button>
            </section> : <section className="seller-offers-list" aria-label="فهرست پیشنهادهای فروشگاه">
              {offers.map((offer) => <article key={offer.id} className="seller-offer-row">
                <div className="seller-offer-row__main">
                  <strong>{offer.catalogProduct?.name ?? "کالای کاتالوگ در دسترس نیست"}</strong>
                  <span>{offer.catalogProduct?.categoryName ?? ""}</span>
                  <small>{offer.catalogProduct?.unitName ?? "واحد ثبت نشده"}</small>
                </div>
                <div className="seller-offer-row__values">
                  <span>{offer.priceRials === null ? "قیمت ثبت نشده" : `${formatRials(offer.priceRials)} ریال`}</span>
                  <span>{offer.sellableQuantity === null ? "موجودی ثبت نشده" : `${new Intl.NumberFormat("fa-IR").format(offer.sellableQuantity)} ${offer.catalogProduct?.unitName ?? "واحد"}`}</span>
                  <span className={`seller-offer-status seller-offer-status--${offer.status.toLowerCase()}`}>{offer.status === "PUBLISHED" ? "منتشرشده" : offer.status === "PAUSED" ? "متوقف" : "پیش‌نویس"}</span>
                </div>
                <button type="button" className="seller-offers-secondary" onClick={() => openEdit(offer)}>ویرایش</button>
              </article>)}
            </section>}
          </> : null}

          {formVisible ? <>
            <button type="button" className="seller-offers-back" onClick={closeForm} disabled={busy}>بازگشت به کالاهای فروشگاه ←</button>
            <div className="seller-offers-heading seller-offers-heading--form">
              <div><h1>{selected ? "ویرایش کالای فروشگاه" : "افزودن کالای فروشگاه"}</h1><p>کالای کاتالوگ را انتخاب و مشخصات عرضه را تکمیل کنید.</p></div>
            </div>
            {message ? <p className="seller-offers-notice" role="status">{message}</p> : null}
            {error ? <p className="form-status form-status--error" role="alert">{error}</p> : null}
            <div className="seller-offers-form-grid">
              <form className="seller-offers-card" onSubmit={submit}>
                <h2>مشخصات پیشنهاد</h2>
                <label className="seller-offers-field"><span>کالای کاتالوگ</span>
                  {!selected ? <>
                    <div className="seller-offers-search"><input aria-label="جست‌وجوی کالا در کاتالوگ" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="جست‌وجوی کالا" /><button type="button" onClick={async () => { setError(""); try { await loadGoods(searchDraft); } catch (reason) { setError(reason instanceof Error ? reason.message : "جست‌وجوی کالا انجام نشد."); } }}>جست‌وجو</button></div>
                    <select required aria-label="کالای کاتالوگ" value={productId} disabled={createdOfferId !== null} onChange={(event) => setProductId(event.target.value)}>
                      <option value="">انتخاب کالا از کاتالوگ</option>
                      {goods.map((good) => <option key={good.id} value={good.id}>{good.name} — {good.categoryName} ({good.unitName})</option>)}
                    </select>
                    <small>{goodsTotal > goods.length ? `نمایش ${goods.length} کالا از ${goodsTotal} نتیجه؛ برای یافتن کالای دیگر جست‌وجو کنید.` : goods.length === 0 ? "کالای منتشرشده و قابل عرضه‌ای در کاتالوگ پیدا نشد." : "نام و توضیح کالا از کاتالوگ خوانده می‌شود و اینجا قابل ویرایش نیست."}</small>
                  </> : <div className="seller-offers-fixed-product">{selected.catalogProduct?.name ?? "کالای کاتالوگ در دسترس نیست"} · {selected.catalogProduct?.categoryName ?? ""}</div>}
                </label>
                <label className="seller-offers-field"><span>قیمت هر واحد (ریال)</span><input required inputMode="numeric" dir="ltr" value={price} onChange={(event) => setPrice(event.target.value)} /><small>قیمت را به ریال وارد کنید.</small></label>
                <label className="seller-offers-field"><span>موجودی قابل عرضه</span><input required inputMode="decimal" dir="ltr" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><small>{chosenGood ? `واحد: ${chosenGood.unitName} · دقت مجاز: ${chosenGood.quantityScale} رقم اعشار` : selected?.catalogProduct?.unitName ? `واحد: ${selected.catalogProduct.unitName}` : "واحد و دقت مقدار از کاتالوگ خوانده می‌شود."}</small></label>
                <div className="seller-offers-confirm">پس از اعتبارسنجی، پیشنهاد مستقیماً منتشر می‌شود.</div>
                <div className="seller-offers-actions"><button type="button" className="seller-offers-secondary" onClick={closeForm} disabled={busy}>انصراف</button><button type="submit" className="seller-offers-primary" disabled={busy || pageState !== "ready"}>{busy ? "در حال ثبت…" : "ثبت و انتشار"}</button></div>
              </form>
              <aside className="seller-offers-card seller-offers-stock-note"><h2>مدیریت موجودی</h2><p>با شروع پرداخت، تعداد لازم موقتاً رزرو می‌شود. در صورت شکست یا پایان مهلت پرداخت، رزرو آزاد خواهد شد.</p><p className="seller-offers-warning">اگر واحد یا دقت کالا در کاتالوگ ثبت نشده باشد، پیشنهاد قابل انتشار نیست.</p></aside>
            </div>
          </> : null}
        </section>
        <aside className="seller-offers-sidebar" aria-label="ناوبری فروشگاه">
          <h2>مدیریت فروشگاه</h2>
          <Link href="/seller">داشبورد</Link><span aria-disabled="true">سفارش‌ها</span>
          <Link className="is-active" href="/seller/offers">کالاهای فروشگاه</Link>
          <span aria-disabled="true">موجودی و قیمت</span><span aria-disabled="true">اطلاعات کسب‌وکار</span><span aria-disabled="true">پشتیبانی</span>
        </aside>
      </div>
    </main>
  );
}
