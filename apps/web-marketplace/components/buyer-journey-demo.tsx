"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  BUYER_DEMO_ORDER_KEY, BUYER_DEMO_STORE_KEY, BuyerDemoCartItem,
  BuyerDemoOrder, buyerDemoCartCount, buyerDemoCartEventName,
  formatBuyerDemoPrice, readBuyerDemoCart, readBuyerDemoOrder,
  writeBuyerDemoCart,
} from "../lib/buyer-demo-cart";

type Screen = "basket" | "comparison" | "review" | "checkout" | "success" | "tracking" | "orders" | "account";

const stores = [
  { id: "sample-1", name: "فروشگاه نمونه ۱", distance: "۱.۲ کیلومتر", price: 265000, available: "۲ از ۲ کالا موجود" },
  { id: "sample-2", name: "فروشگاه نمونه ۲", distance: "۰.۸ کیلومتر", price: 270000, available: "۲ از ۲ کالا موجود" },
  { id: "sample-3", name: "فروشگاه نمونه ۳", distance: "۲.۴ کیلومتر", price: 260000, available: "۱ از ۲ کالا موجود" },
];

function DemoNotice() {
  return <p className="journey-demo-notice">دموی مسیر فیگما — نام فروشگاه‌ها، قیمت‌ها و وضعیت سفارش نمونه هستند؛ پرداخت یا سفارش واقعی انجام نمی‌شود.</p>;
}

function JourneyHeader({ count }: { count: number }) {
  return <header className="journey-header" dir="rtl">
    <Link href="/" className="journey-logo" aria-label="صفحه اصلی حنا"><img src="/hana-logo.png" alt="حنا" /></Link>
    <form action="/products" className="journey-search"><input name="search" placeholder="جست‌وجوی کالاها، خدمات و نیازهای روزمره..." aria-label="جست‌وجو"/><button type="submit" aria-label="جست‌وجو">⌕</button></form>
    <div className="journey-header-actions"><Link href="/account">حساب کاربری</Link><Link href="/basket" className="journey-cart">سبد خرید <span>{new Intl.NumberFormat("fa-IR").format(count)}</span></Link></div>
    <nav className="journey-nav"><Link href="/products">همه دسته‌ها</Link><Link href="/products">کالاها و خدمات</Link><Link href="/programs">کالابرگ / اعتبارها</Link><Link href="/programs">طرح‌های ویژه</Link><Link href="/#offers">پیشنهادها</Link></nav>
  </header>;
}

function JourneyFooter() {
  return <footer className="journey-footer"><Link href="/buyer-guide">راهنمای خرید</Link><Link href="/seller-guide">همکاری با حنا</Link><Link href="/support">تماس با پشتیبانی</Link><Link href="/">صفحه اصلی حنا</Link></footer>;
}

export function BuyerJourneyDemo({ screen }: { screen: Screen }) {
  const router = useRouter();
  const [items, setItems] = useState<BuyerDemoCartItem[]>([]);
  const [order, setOrder] = useState<BuyerDemoOrder | null>(null);
  const [selectedStore, setSelectedStore] = useState(stores[0]);
  const [sort, setSort] = useState<"cheap" | "complete" | "near">("cheap");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [payment, setPayment] = useState<BuyerDemoOrder["payment"]>("online");

  useEffect(() => {
    const sync = () => {
      const cart = readBuyerDemoCart();
      setItems(cart);
      setOrder(readBuyerDemoOrder());
      const storeId = window.localStorage.getItem(BUYER_DEMO_STORE_KEY);
      setSelectedStore(stores.find((store) => store.id === storeId) ?? stores[0]);
      setReady(true);
    };
    sync();
    window.addEventListener(buyerDemoCartEventName(), sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(buyerDemoCartEventName(), sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const count = buyerDemoCartCount(items);
  const total = items.every((item) => item.unitPrice !== null)
    ? items.reduce((sum, item) => sum + (item.unitPrice ?? 0) * item.quantity, 0)
    : null;
  const comparisonStores = sort === "cheap"
    ? [...stores].sort((a, b) => a.price - b.price)
    : sort === "near"
      ? [stores[1], stores[0], stores[2]]
      : [stores[0], stores[1], stores[2]];

  function setQuantity(id: string, step: number) {
    const next = items.flatMap((item) => {
      if (item.id !== id) return [item];
      const quantity = item.quantity + step;
      return quantity > 0 ? [{ ...item, quantity: Math.min(quantity, 99) }] : [];
    });
    writeBuyerDemoCart(next);
    setItems(next);
  }

  function chooseStore(id: string) {
    const store = stores.find((entry) => entry.id === id);
    if (!store) return;
    setSelectedStore(store);
    window.localStorage.setItem(BUYER_DEMO_STORE_KEY, store.id);
    router.push("/basket-review");
  }

  function submitDemoOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const address = String(data.get("address") ?? "").trim();
    const recipient = String(data.get("recipient") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    if (!address || !recipient || !/^09\d{9}$/.test(phone)) {
      setError("نشانی، نام گیرنده و شماره همراه ۱۱ رقمی را کامل وارد کنید.");
      return;
    }
    if (!legalAccepted) {
      setError("برای ادامه، پذیرش شرایط نمونه را علامت بزنید.");
      return;
    }
    const code = `DEMO-${Date.now().toString().slice(-6)}`;
    const saved: BuyerDemoOrder = {
      code, storeId: selectedStore.id, storeName: selectedStore.name,
      address, recipient, phone, payment, items,
      total: selectedStore.price,
    };
    window.localStorage.setItem(BUYER_DEMO_ORDER_KEY, JSON.stringify(saved));
    writeBuyerDemoCart([]);
    setItems([]);
    setOrder(saved);
    setError("");
    router.push("/order-success");
  }

  if (!ready) return <div className="journey-page" dir="rtl"><JourneyHeader count={0}/><main className="journey-main"><p role="status">در حال آماده‌سازی مسیر خرید…</p></main></div>;

  const title: Record<Screen, string> = {
    basket: "اقلام سبد خرید شما", comparison: "مقایسه فروشگاه‌های نزدیک",
    review: "فاکتور و خلاصه خرید شما", checkout: "تکمیل و ثبت سفارش",
    success: "سفارش شما ثبت شد", tracking: "وضعیت سفارش",
    orders: "تاریخچه سفارش‌ها", account: "حساب کاربری",
  };

  return <div className="journey-page" dir="rtl">
    <JourneyHeader count={count}/>
    <main className="journey-main">
      <DemoNotice/>
      <h1>{title[screen]}</h1>

      {screen === "basket" && (items.length === 0 ? <section className="journey-empty"><h2>سبد خرید خالی است</h2><p>برای دیدن مسیر نمونه، از پیشنهادهای صفحهٔ اصلی کالایی به سبد اضافه کنید.</p><Link className="journey-primary" href="/#offers">رفتن به پیشنهادهای صفحه اصلی</Link></section> : <div className="journey-columns">
        <aside className="journey-card journey-summary"><h2>خلاصه سبد خرید</h2><p>تعداد اقلام: <b>{new Intl.NumberFormat("fa-IR").format(count)}</b></p><p>قیمت پایهٔ کالاها: <b>{total === null ? "پس از اتصال قیمت‌ها مشخص می‌شود" : formatBuyerDemoPrice(total)}</b></p><p className="journey-callout">در محصول نهایی، فروشگاه‌ها براساس موجودی، قیمت کل و فاصله مقایسه می‌شوند. این مقادیر در این صفحه نمونه‌اند.</p><Link className="journey-primary" href="/store-comparison">مشاهده مقایسه فروشگاه‌ها</Link></aside>
        <section className="journey-list"><h2>اقلام سبد خرید شما</h2>{items.map((item) => <article className="journey-item" key={item.id}>{item.image ? <img src={item.image} alt=""/> : <span className="journey-image-fallback">حنا</span>}<div className="journey-item-info"><h3>{item.name}</h3><p>{item.detail || (item.kind === "SERVICE" ? "خدمت" : "کالا")}</p></div><strong>{item.unitPrice === null ? "قیمت ثبت نشده" : formatBuyerDemoPrice(item.unitPrice)}</strong><div className="journey-quantity"><button type="button" onClick={() => setQuantity(item.id, 1)} aria-label={`افزودن ${item.name}`}>+</button><span>{new Intl.NumberFormat("fa-IR").format(item.quantity)}</span><button type="button" onClick={() => setQuantity(item.id, -1)} aria-label={`کم کردن ${item.name}`}>−</button></div><button className="journey-remove" type="button" onClick={() => setQuantity(item.id, -item.quantity)}>حذف کالا ×</button></article>)}</section>
      </div>)}

      {screen === "comparison" && (items.length === 0 ? <section className="journey-empty"><h2>سبد خریدی برای مقایسه ندارید</h2><Link className="journey-primary" href="/">بازگشت به صفحه اصلی</Link></section> : <>
        <p className="journey-lead">برای یک سبد یکسان، گزینه‌ها را براساس قیمت، موجودی یا فاصله مرتب کنید. مقادیر نمایش‌داده‌شده از نمونهٔ فیگما هستند.</p>
        <div className="journey-sort" role="group" aria-label="مرتب‌سازی فروشگاه‌ها">{([["cheap","ارزان‌ترین سبد"],["complete","کامل‌ترین سبد"],["near","نزدیک‌ترین"]] as const).map(([key,label])=><button key={key} type="button" aria-pressed={sort===key} onClick={()=>setSort(key)}>{label}</button>)}</div>
        <div className="journey-stores">{comparisonStores.map((store,index)=><article className="journey-store" key={store.id}><div><h2>{store.name}</h2><p>فاصله تا شما: {store.distance}</p></div><span className="journey-store-tag">{index === 0 ? "پیشنهاد نمونه" : "فروشگاه نمونه"}</span><div><strong>{formatBuyerDemoPrice(store.price)}</strong><p>هزینه ارسال در این پیش‌نمایش محاسبه نشده</p></div><p>{store.available}</p><button className="journey-primary" type="button" onClick={()=>chooseStore(store.id)}>انتخاب این فروشگاه</button></article>)}</div>
      </>)}

      {screen === "review" && <div className="journey-columns"><aside className="journey-card journey-summary"><h2>فاکتور و خلاصه خرید شما</h2><p>جمع کالاها <b>{total === null ? "قیمت نمونه" : formatBuyerDemoPrice(total)}</b></p><p>هزینه ارسال <b>در مرحله نهایی مشخص می‌شود</b></p><p><b>مبلغ نهایی: {formatBuyerDemoPrice(selectedStore.price)}</b></p><Link className="journey-primary" href="/checkout">ادامه ثبت سفارش</Link><Link className="journey-secondary" href="/store-comparison">بازگشت به مقایسه فروشگاه‌ها</Link></aside><section className="journey-card"><span className="journey-eyebrow">فروشگاه انتخابی</span><h2>{selectedStore.name}</h2><p>فاصله تا مقصد: {selectedStore.distance}</p><hr/><h2>اقلام سبد خرید شما</h2>{items.map((item)=><p className="journey-review-item" key={item.id}>{item.name} · {new Intl.NumberFormat("fa-IR").format(item.quantity)} عدد <strong>{item.unitPrice === null ? "قیمت نمونه" : formatBuyerDemoPrice(item.unitPrice * item.quantity)}</strong></p>)}</section></div>}

      {screen === "checkout" && <div className="journey-columns"><form className="journey-card journey-form" onSubmit={submitDemoOrder}><h2>۱. نوع خرید</h2><label className="journey-check"><input type="checkbox" name="business"/> خرید حقوقی و دریافت فاکتور رسمی</label><h2>۲. آدرس و موقعیت تحویل</h2><label>آدرس دقیق پستی<input name="address" placeholder="نشانی تحویل"/></label><label>نام و نام خانوادگی گیرنده<input name="recipient" placeholder="نام گیرنده"/></label><label>شماره تماس گیرنده<input name="phone" inputMode="numeric" placeholder="09xxxxxxxxx"/></label><h2>۳. روش تحویل</h2><p>تحویل از {selectedStore.name} — زمان تحویل نمونه است.</p><h2>۴. روش پرداخت</h2><label className="journey-radio"><input type="radio" name="payment" checked={payment === "online"} onChange={()=>setPayment("online")}/> پرداخت آنلاین با کارت بانکی (نمایشی)</label><label className="journey-radio"><input type="radio" name="payment" checked={payment === "cash"} onChange={()=>setPayment("cash")}/> پرداخت در محل (نمایشی)</label><label className="journey-radio"><input type="radio" name="payment" checked={payment === "credit"} onChange={()=>setPayment("credit")}/> اعتبار حمایتی (نمایشی)</label><label className="journey-check"><input type="checkbox" checked={legalAccepted} onChange={(event)=>setLegalAccepted(event.target.checked)}/> شرایط نمونه را می‌پذیرم.</label>{error && <p className="journey-error" role="alert">{error}</p>}<button className="journey-primary" type="submit">ثبت سفارش آزمایشی</button><p className="journey-small">این دکمه فقط مرحله‌های رابط کاربری را نمایش می‌دهد و درگاه یا سفارش واقعی فراخوانی نمی‌کند.</p></form><aside className="journey-card journey-summary"><h2>خلاصه سفارش</h2><p>فروشگاه <b>{selectedStore.name}</b></p><p>تعداد اقلام <b>{count}</b></p><p>مبلغ نمونه <b>{formatBuyerDemoPrice(selectedStore.price)}</b></p></aside></div>}

      {screen === "success" && <section className="journey-success"><div className="journey-success-icon">✓</div><h2>پیش‌نمایش سفارش کامل شد</h2><p>کد نمونه: <b>{order?.code ?? "پس از تکمیل فرم checkout تولید می‌شود"}</b></p><p>هیچ سفارش یا پرداخت واقعی ثبت نشده است.</p><div className="journey-actions"><Link className="journey-primary" href="/order-tracking">مشاهده وضعیت نمونه</Link><Link className="journey-secondary" href="/">بازگشت به صفحه اصلی</Link></div></section>}

      {screen === "tracking" && (order ? <div className="journey-columns"><section className="journey-card"><h2>وضعیت سفارش نمونه</h2><p>کد پیگیری: <b>{order.code}</b></p><ol className="journey-progress"><li className="is-current">ثبت سفارش</li><li>تأیید فروشگاه</li><li>آماده‌سازی</li><li>ارسال</li><li>تحویل</li></ol><p className="journey-small">این وضعیت آزمایشی است و به فروشگاه متصل نیست.</p></section><aside className="journey-card"><h2>مشخصات فروشگاه</h2><p>{order.storeName}</p><h2>نشانی تحویل نمونه</h2><p>{order.address}</p><Link className="journey-secondary" href="/orders">بازگشت به سفارش‌ها</Link></aside></div> : <section className="journey-empty"><h2>سفارش نمونه‌ای برای پیگیری وجود ندارد</h2><Link className="journey-primary" href="/">بازگشت به صفحه اصلی</Link></section>)}

      {screen === "orders" && <section className="journey-card journey-order-list"><h2>تاریخچه سفارش‌ها</h2>{order ? <article><div><strong>{order.storeName}</strong><span>{order.code} · نمونه</span></div><strong>{formatBuyerDemoPrice(order.total ?? 0)}</strong><Link className="journey-secondary" href="/order-tracking">مشاهده جزئیات سفارش</Link></article> : <p>سفارشی در این مرورگر ثبت نشده است.</p>}<Link className="journey-primary" href="/">شروع از صفحه اصلی</Link></section>}

      {screen === "account" && <section className="journey-empty"><h2>حساب کاربری حنا</h2><p>ورود و ثبت‌نام از مسیر احراز هویت موجود انجام می‌شود. صفحه‌های سفارش و نشانی به API حساب کاربری نیاز دارند.</p><div className="journey-actions"><Link className="journey-primary" href="/auth">ورود یا ثبت‌نام</Link><Link className="journey-secondary" href="/orders">سفارش‌های نمونه</Link></div></section>}
    </main>
    <JourneyFooter/>
  </div>;
}
