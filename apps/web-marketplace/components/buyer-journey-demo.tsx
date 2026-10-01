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
  return <p className="journey-demo-notice">دموی مسیر فیگما — تصاویر، نام فروشگاه‌ها، قیمت‌ها و وضعیت سفارش نمونه هستند؛ پرداخت یا سفارش واقعی انجام نمی‌شود.</p>;
}

function JourneyHeader({ count }: { count: number }) {
  return <>
    <div className="journey-announcement">بازارگاه حنا؛ کالاها و خدمات در یک تجربه یکپارچه</div>
    <header className="journey-header" dir="rtl">
      <Link href="/" className="journey-logo" aria-label="صفحه اصلی حنا"><img src="/hana-logo.png" alt="حنا" /></Link>
      <form action="/products" className="journey-search"><input name="search" placeholder="جست‌وجوی کالاها، خدمات و نیازهای روزمره..." aria-label="جست‌وجو"/><button type="submit" aria-label="جست‌وجو">⌕</button></form>
      <div className="journey-header-actions"><Link href="/basket" className="journey-cart">سبد خرید <span>{new Intl.NumberFormat("fa-IR").format(count)}</span></Link><Link href="/auth">ورود یا ثبت‌نام</Link><Link href="/seller/register" className="journey-seller-link">ثبت‌نام فروشگاه‌ها</Link></div>
      <nav className="journey-nav"><Link href="/products">نیازهای روزمره</Link><Link href="/seller">فروشندگان / ارائه‌دهندگان</Link><Link href="/products">کالاها و خدمات</Link><Link href="/products">همه دسته‌ها</Link><Link href="/products">دسته‌بندی‌های منتخب</Link><Link href="/programs">طرح‌های ویژه</Link><Link href="/programs">کالابرگ / اعتبارها</Link><Link href="/#offers">پیشنهادها</Link></nav>
    </header>
  </>;
}

function JourneyFooter() {
  return <footer className="journey-footer" dir="rtl">
    <div className="journey-footer-grid">
      <div><h2>طرح‌های حمایتی</h2><Link href="/programs">ثبت‌نام کالابرگ</Link><Link href="/programs">اعتبارات سازمانی</Link><Link href="/programs">کارت‌های معیشتی</Link><Link href="/programs">گزارش شفافیت مالی</Link></div>
      <div><h2>همکاری با حنا</h2><Link href="/seller/register">ثبت فروشگاه جدید</Link><Link href="/seller">پنل فروشندگان</Link><Link href="/seller-guide">شرایط همکاری پیک‌ها</Link><Link href="/support">فرصت‌های شغلی</Link></div>
      <div><h2>دسترسی سریع</h2><Link href="/faq">سوالات متداول</Link><Link href="/terms">قوانین و مقررات</Link><Link href="/about">درباره حنا</Link><Link href="/support">تماس با پشتیبانی</Link></div>
      <div className="journey-footer-brand"><Link href="/"><img src="/hana-logo.png" alt="حنا" /></Link><p>حنا بازارگاه هوشمند اجتماعی برای خریدهای روزمره در ایران است که اولویت خود را بر توسعه عادلانه و حمایت اجتماعی قرار داده است.</p></div>
    </div>
    <div className="journey-footer-bottom"><span>◎　♥　in</span><p>حنا با هدف برقراری عدالت اجتماعی توسعه داده شده است.<br/>کلیه حقوق برای حنا محفوظ است.</p></div>
  </footer>;
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
  const [orderFilter, setOrderFilter] = useState("current");
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

      {screen === "checkout" && <div className="journey-columns journey-checkout-layout"><form className="journey-card journey-form" onSubmit={submitDemoOrder}>
        <section className="journey-checkout-section"><h2>۱. نوع خرید</h2><label className="journey-check"><input type="checkbox" name="business"/> خرید حقوقی و دریافت فاکتور رسمی</label><p className="journey-small">این گزینه برای دریافت فاکتور رسمی شرکت‌ها استفاده می‌شود.</p></section>
        <section className="journey-checkout-section"><h2>۲. آدرس و موقعیت تحویل</h2><div className="journey-map" aria-label="نقشه نمونه موقعیت تحویل"><span>📍</span><b>تعیین موقعیت روی نقشه</b></div><label>آدرس دقیق پستی<input name="address" placeholder="نشانی تحویل"/></label><div className="journey-form-row"><label>نام و نام خانوادگی گیرنده<input name="recipient" placeholder="نام گیرنده"/></label><label>شماره تماس گیرنده<input name="phone" inputMode="numeric" placeholder="09xxxxxxxxx"/></label></div></section>
        <section className="journey-checkout-section"><h2>۳. روش تحویل</h2><p>زمان تحویل پس از تأیید فروشگاه مشخص می‌شود.</p><label className="journey-option-row"><input type="radio" name="delivery" defaultChecked/> تحویل از {selectedStore.name}</label></section>
        <section className="journey-checkout-section"><h2>۴. روش پرداخت</h2><label className="journey-radio"><input type="radio" name="payment" checked={payment === "cash"} onChange={()=>setPayment("cash")}/> پرداخت در محل (نمایشی)</label><label className="journey-radio"><input type="radio" name="payment" checked={payment === "online"} onChange={()=>setPayment("online")}/> پرداخت آنلاین با کارت بانکی (نمایشی)</label><label className="journey-radio"><input type="radio" name="payment" checked={payment === "credit"} onChange={()=>setPayment("credit")}/> اعتبار حمایتی (نمایشی)</label></section>
        <label className="journey-check"><input type="checkbox" checked={legalAccepted} onChange={(event)=>setLegalAccepted(event.target.checked)}/> شرایط نمونه را می‌پذیرم.</label>{error && <p className="journey-error" role="alert">{error}</p>}<button className="journey-primary" type="submit">تکمیل و ثبت سفارش آزمایشی</button><p className="journey-small">این دکمه فقط مرحله‌های رابط کاربری را نمایش می‌دهد و درگاه یا سفارش واقعی فراخوانی نمی‌کند.</p>
      </form><div className="journey-checkout-side"><aside className="journey-card journey-summary"><h2>خلاصه سفارش</h2><p>جمع کالاها <b>قیمت نمونه</b></p><p>فروشگاه <b>{selectedStore.name}</b></p><p>هزینه ارسال <b>رایگان نمونه</b></p><hr/><p>مبلغ قابل پرداخت <b>{formatBuyerDemoPrice(selectedStore.price)}</b></p><button className="journey-primary" type="button" onClick={()=>document.querySelector<HTMLFormElement>(".journey-form")?.requestSubmit()}>ثبت سفارش نمونه</button></aside><aside className="journey-card journey-info-card"><strong>خرید حقوقی و دریافت فاکتور رسمی</strong><p>در صورت انتخاب این گزینه، اطلاعات شرکت برای صدور فاکتور رسمی دریافت می‌شود.</p></aside></div></div>}

      {screen === "success" && <section className="journey-success"><div className="journey-success-icon">✓</div><h2>پیش‌نمایش سفارش کامل شد</h2><p>کد نمونه: <b>{order?.code ?? "پس از تکمیل فرم checkout تولید می‌شود"}</b></p><p>هیچ سفارش یا پرداخت واقعی ثبت نشده است.</p><div className="journey-actions"><Link className="journey-primary" href="/order-tracking">مشاهده وضعیت نمونه</Link><Link className="journey-secondary" href="/">بازگشت به صفحه اصلی</Link></div></section>}

      {screen === "tracking" && (order ? <div className="journey-columns"><section className="journey-card"><h2>وضعیت سفارش نمونه</h2><p>کد پیگیری: <b>{order.code}</b></p><ol className="journey-progress"><li className="is-current">ثبت سفارش</li><li>تأیید فروشگاه</li><li>آماده‌سازی</li><li>ارسال</li><li>تحویل</li></ol><p className="journey-small">این وضعیت آزمایشی است و به فروشگاه متصل نیست.</p></section><aside className="journey-card"><h2>مشخصات فروشگاه</h2><p>{order.storeName}</p><h2>نشانی تحویل نمونه</h2><p>{order.address}</p><Link className="journey-secondary" href="/orders">بازگشت به سفارش‌ها</Link></aside></div> : <section className="journey-empty"><h2>سفارش نمونه‌ای برای پیگیری وجود ندارد</h2><Link className="journey-primary" href="/">بازگشت به صفحه اصلی</Link></section>)}

      {screen === "orders" && <section className="journey-order-list"><div className="journey-order-filters" role="group" aria-label="فیلتر سفارش‌ها">{([ ["all","همه سفارش‌ها"],["current","جاری"],["delivered","تحویل‌شده"],["cancelled","لغوشده"] ] as const).map(([key,label])=><button key={key} type="button" aria-pressed={orderFilter===key} onClick={()=>setOrderFilter(key)}>{label}</button>)}</div>{order && (orderFilter === "all" || orderFilter === "current") ? <article className="journey-card"><div className="journey-order-main"><strong>{order.storeName}</strong><span>کد سفارش: {order.code} · نمونه</span><span>خرید حقوقی · در حال آماده‌سازی</span></div><strong>{formatBuyerDemoPrice(order.total ?? 0)}</strong><Link className="journey-secondary" href="/order-tracking">مشاهده جزئیات سفارش</Link></article> : <section className="journey-card"><p>{order ? "سفارشی در این وضعیت وجود ندارد." : "سفارشی در این مرورگر ثبت نشده است."}</p><Link className="journey-primary" href="/">شروع از صفحه اصلی</Link></section>}</section>}

      {screen === "account" && <div className="journey-account-layout"><aside className="journey-card journey-account-nav"><Link href="/account#profile" className="is-active">اطلاعات حساب</Link><Link href="/account#addresses">آدرس‌های من</Link><Link href="/orders">سفارش‌های من</Link><Link href="/account#payments">روش‌های پرداخت</Link><Link href="/programs">اعتبارهای من</Link><Link href="/programs">طرح‌های فعال</Link><Link href="/programs">مشارکت‌های اجتماعی</Link><Link href="/support">پشتیبانی</Link><Link href="/auth">تنظیمات حساب</Link></aside><div className="journey-account-content"><section className="journey-card"><h2>خرید حقوقی</h2><p>برای خرید به نام شرکت و دریافت فاکتور رسمی، اطلاعات شرکت را ثبت کنید.</p><div className="journey-info-card"><strong>اطلاعات شرکت ثبت شده نیست</strong><p>این اطلاعات به حساب کاربری حقوقی متصل است و برای خریدهای شرکتی استفاده می‌شود.</p></div><div className="journey-actions"><Link className="journey-secondary" href="/auth">مشاهده اطلاعات</Link><Link className="journey-primary" href="/auth">ویرایش اطلاعات</Link></div></section><section className="journey-card" id="payments"><h2>حساب من</h2><p>سفارش‌ها، نشانی‌ها، روش‌های پرداخت و اعتبارهای حساب در این بخش جمع‌آوری می‌شوند.</p></section><section className="journey-card" id="addresses"><h2 id="profile">اطلاعات حساب</h2><label>نام و نام خانوادگی<input readOnly value="کاربر نمونه"/></label><div className="journey-form-row"><label>ایمیل<input readOnly value="ایمیل نمونه"/></label><label>شماره تلفن همراه<input readOnly value="شماره تماس نمونه"/></label></div><Link className="journey-primary" href="/auth">ویرایش اطلاعات حساب</Link></section></div></div>}
    </main>
    <JourneyFooter/>
  </div>;
}
