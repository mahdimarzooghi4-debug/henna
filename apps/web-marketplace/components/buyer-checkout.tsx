"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AddressMapPicker, type SelectedMapPoint } from "./address-map-picker";
import styles from "./buyer-checkout.module.css";
import { normalizeDigits } from "../lib/normalize-digits";
import { parsePurchaseDraft, type PurchaseDraft } from "../lib/buyer-cart";

type DraftState = { status: "loading" | "signed-out" | "unavailable" } | { status: "ready"; draft: PurchaseDraft };

type CheckoutFields = { address: string; recipient: string; phone: string };

const links = [
  ["پیشنهادها", "/products"], ["کالابرگ / اعتبارها", "/programs"],
  ["طرح‌های ویژه", "/programs"], ["دسته‌بندی‌های منتخب", "/products"],
  ["همه دسته‌ها", "/products"], ["کالاها و خدمات", "/products"],
  ["فروشندگان / ارائه‌دهندگان", "/products"], ["نیازهای روزمره", "/products"],
] as const;

function Header() {
  return <>
    <div className={styles.announcement}>بازارگاه حنا؛ کالاها و خدمات در یک تجربه یکپارچه</div>
    <header className={styles.header}>
      <nav className={styles.headerActions} aria-label="دسترسی سریع">
        <Link className={styles.cartButton} href="/buyer/cart">سبد خرید</Link>
        <Link className={styles.loginButton} href="/auth">ورود یا ثبت‌نام</Link>
        <Link className={styles.sellerLink} href="/seller/register">ثبت‌نام فروشگاه‌ها</Link>
      </nav>
      <form className={styles.search} action="/products">
        <input name="search" placeholder="جست‌وجوی کالاها، خدمات و نیازهای روزمره..." aria-label="جست‌وجو" />
        <button type="submit" aria-label="جست‌وجو">⌕</button>
      </form>
      <Link href="/" className={styles.logo} aria-label="صفحه اصلی حنا">
        <Image src="/hana-logo.png" alt="حنا" width={147} height={58} priority />
      </Link>
    </header>
    <nav className={styles.categoryNav} aria-label="دسته‌بندی‌ها">
      {links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
    </nav>
  </>;
}

function Footer() {
  return <footer className={styles.footer}>
    <div className={styles.footerGrid}>
      <div><h2>طرح‌های حمایتی</h2><Link href="/programs">ثبت‌نام کالابرگ</Link><Link href="/programs">اعتبارات سازمانی</Link><Link href="/programs">کارت‌های معیشتی</Link></div>
      <div><h2>همکاری با حنا</h2><Link href="/seller/register">ثبت فروشگاه جدید</Link><Link href="/seller">پنل فروشندگان</Link><Link href="/seller-guide">شرایط همکاری</Link></div>
      <div><h2>دسترسی سریع</h2><Link href="/faq">سوالات متداول</Link><Link href="/terms">قوانین و مقررات</Link><Link href="/about">درباره حنا</Link><Link href="/support">تماس با پشتیبانی</Link></div>
      <div className={styles.footerBrand}><Link href="/"><Image src="/hana-logo.png" alt="حنا" width={140} height={56} /></Link><p>حنا بازارگاه هوشمند اجتماعی برای خریدهای روزمره در بستر اقتصاد عادلانه و حمایت اجتماعی قرار دارد.</p></div>
    </div>
    <div className={styles.copyright}>حنا با هدف برقراری عدالت اجتماعی توسعه داده شده است. کلیه حقوق برای حنا محفوظ است.</div>
  </footer>;
}

function normalizePhone(phone: string) {
  return normalizeDigits(phone).replace(/[\s-]/g, "");
}

export function BuyerCheckout() {
  const [draftState, setDraftState] = useState<DraftState>({ status: "loading" });
  const [fields, setFields] = useState<CheckoutFields>({ address: "", recipient: "", phone: "" });
  const [point, setPoint] = useState<SelectedMapPoint | null>(null);
  const [legal, setLegal] = useState(false);
  const [validated, setValidated] = useState(false);
  const [payment, setPayment] = useState("online");
  const errors = {
    address: !fields.address.trim(), recipient: !fields.recipient.trim(),
    phone: !/^09\d{9}$/.test(normalizePhone(fields.phone)),
  };

  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/buyer/cart/purchase-draft", { cache: "no-store", credentials: "same-origin", redirect: "error", headers: { Accept: "application/json", "Cache-Control": "no-store" }, signal: abort.signal })
      .then(async response => {
        if (response.status === 401) throw Object.assign(new Error("signed-out"), { status: 401 });
        if (response.status !== 200) throw Error("unavailable");
        const draft = parsePurchaseDraft(await response.json() as unknown);
        if (!draft) throw Error("unavailable");
        if (!abort.signal.aborted) setDraftState({ status: "ready", draft });
      })
      .catch(error => {
        if (abort.signal.aborted) return;
        setDraftState(error && typeof error === "object" && "status" in error && error.status === 401
          ? { status: "signed-out" } : { status: "unavailable" });
      });
    return () => abort.abort();
  }, []);

  const draft = draftState.status === "ready" ? draftState.draft : null;
  const selectedDraft = draft?.sellerPublicId ? draft : null;
  const needsReview = Boolean(selectedDraft?.lines.some(line => line.priceChanged || !line.offerAvailable || !line.coversRequestedQuantity));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidated(true);
  }

  const field = (name: keyof CheckoutFields, label: string, placeholder: string) => (
    <label className={styles.field} key={name}>
      <span>{label} <b aria-hidden="true">*</b></span>
      <input value={fields[name]} onChange={event => setFields(current => ({ ...current, [name]: event.target.value }))}
        placeholder={placeholder} dir={name === "phone" ? "ltr" : "rtl"}
        inputMode={name === "phone" ? "tel" : "text"} maxLength={name === "phone" ? 11 : undefined}
        aria-invalid={validated && errors[name]} />
      {validated && errors[name] && <small>این مورد را کامل کنید.</small>}
    </label>
  );

  return <div className={styles.page} dir="rtl">
    <Header />
    <main className={styles.main}>
      {(draftState.status === "loading" || !selectedDraft || needsReview) && <div className={styles.draftNotice} role="status">
        {draftState.status === "loading" ? "در حال بررسی انتخاب ذخیره‌شده در سبد…" : draftState.status === "signed-out" ? "برای مشاهدهٔ انتخاب فروشنده وارد حساب شوید." : draftState.status === "unavailable" ? "وضعیت انتخاب ذخیره‌شده دریافت نشد؛ دوباره از سبد تلاش کنید." : !selectedDraft ? "هنوز انتخاب فروشنده‌ای ذخیره نشده است. برای شروع، یک فروشنده را در سبد انتخاب کنید." : "قیمت یا پوشش تعدادی بعضی اقلام تغییر کرده است. پیش از ادامه، انتخاب را در سبد دوباره بررسی کنید."}
        {draftState.status !== "unavailable" && <Link href={draftState.status === "signed-out" ? "/auth" : "/buyer/cart"}>{draftState.status === "signed-out" ? "ورود به حساب" : "بازگشت به سبد"}</Link>}
      </div>}
      <aside className={styles.summaryColumn}>
        <section className={styles.summaryCard} aria-labelledby="summary-title">
          <h1 id="summary-title">خلاصه سفارش</h1>
          <div className={styles.separator} />
          <dl className={styles.summaryRows}>
            <div><dt>اقلام انتخاب‌شده:</dt><dd>{draftState.status === "ready" && selectedDraft ? `${new Intl.NumberFormat("fa-IR").format(selectedDraft.lines.length)} قلم` : "ثبت نشده"}</dd></div>
            <div><dt>کد تخفیف:</dt><dd>—</dd></div>
            <div><dt>هزینه ارسال:</dt><dd>پس از اعلام فروشگاه</dd></div>
            <div><dt>اعتبار حمایتی:</dt><dd>در این مرحله محاسبه نمی‌شود</dd></div>
            <div><dt>اعتبار شخصی:</dt><dd>در این مرحله محاسبه نمی‌شود</dd></div>
          </dl>
          <div className={styles.separator} />
          <div className={styles.total}><strong>مبلغ قابل پرداخت:</strong><b>پس از دریافت پیش‌فاکتور</b></div>
          <button className={styles.submitButton} type="button" disabled aria-describedby="checkout-blocked">ثبت سفارش</button>
          <p id="checkout-blocked" className={styles.blocked}>ثبت سفارش تا آماده‌شدن API سفارش و اتصال درگاه پرداخت فعال نیست.</p>
        </section>
        <aside className={styles.guidance}>
          <span aria-hidden="true">ⓘ</span><h2>خرید حقوقی و دریافت فاکتور رسمی</h2>
          <p>این گزینه اختیاری است. با فعال‌کردن آن، اطلاعات حقوقی باید پیش از ثبت سفارش بررسی شود.</p>
        </aside>
      </aside>

      <section className={styles.checkoutColumn} aria-labelledby="checkout-title">
        <h1 id="checkout-title">تکمیل و ثبت سفارش</h1>
        {selectedDraft && <section className={styles.selectedItems} aria-label="پیش‌نویس انتخاب خریدار">
          <h2>انتخاب ذخیره‌شده در سبد</h2>
          <p>این انتخاب فقط پیش‌نویس است؛ قیمت‌ها قطعی نیستند و سفارشی ایجاد نمی‌شود.</p>
          {selectedDraft.lines.map((line, index) => <div key={line.offerId}>
            <span>قلم {new Intl.NumberFormat("fa-IR").format(index + 1)} · {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: line.quantityScale }).format(line.quantity)} {line.unitName}</span>
            <b>{new Intl.NumberFormat("fa-IR").format(line.expectedPriceRials)} ریال · قیمت دیده‌شده</b>
          </div>)}
        </section>}
        <form onSubmit={submit} noValidate>
          <section className={styles.card} aria-labelledby="purchase-type-title">
            <h2 id="purchase-type-title">۱. نوع خرید</h2>
            <label className={styles.legalToggle}>
              <input type="checkbox" checked={legal} onChange={event => setLegal(event.target.checked)} />
              <span>خرید حقوقی و دریافت فاکتور رسمی</span><span className={styles.info} aria-hidden="true">ⓘ</span>
            </label>
            <p className={styles.helper}>این گزینه اختیاری است و در حالت پیش‌فرض غیرفعال است. در حال حاضر اطلاعات خرید در سرور ثبت نمی‌شود.</p>
            {legal && <p className={styles.notice}>فرم اطلاعات حقوقی پس از تعریف قرارداد فاکتور رسمی در دسترس خواهد بود.</p>}
          </section>

          <section className={styles.card} aria-labelledby="address-title">
            <h2 id="address-title">۲. آدرس و موقعیت تحویل</h2>
            <AddressMapPicker value={point} onChange={setPoint} />
            {point && <p className={styles.point} role="status">موقعیت انتخاب‌شده: {point.latitude.toFixed(5)}، {point.longitude.toFixed(5)}</p>}
            <div className={styles.fields}>
              <label className={`${styles.field} ${styles.fullWidth}`}><span>آدرس دقیق پستی <b aria-hidden="true">*</b></span><input value={fields.address} onChange={event => setFields(current => ({ ...current, address: event.target.value }))} placeholder="نشانی دقیق پستی" aria-invalid={validated && errors.address} />{validated && errors.address && <small>نشانی دقیق را وارد کنید.</small>}</label>
              {field("recipient", "نام و نام خانوادگی گیرنده", "نام گیرنده")}
              {field("phone", "شماره تماس گیرنده", "09xxxxxxxxx")}
            </div>
            <button type="button" className={styles.validateButton} onClick={() => setValidated(true)}>بررسی اطلاعات نشانی</button>
            <p className={styles.helper}>نشانی در این پیش‌نمایش فقط در همین صفحه می‌ماند و ذخیره یا برای فروشگاه ارسال نمی‌شود.</p>
          </section>

          <section className={styles.card} aria-labelledby="delivery-title">
            <h2 id="delivery-title">۳. روش تحویل</h2>
            <p className={styles.helper}>روش و زمان تحویل بعد از دریافت تأیید فروشگاه و مشخص‌شدن تعرفه نمایش داده می‌شود.</p>
            <div className={styles.delivery}>تحویل از فروشگاه انتخاب‌شده <span>پس از تأیید فروشگاه</span></div>
          </section>

          <section className={styles.card} aria-labelledby="payment-title">
            <h2 id="payment-title">۴. روش پرداخت</h2>
            <label className={`${styles.paymentOption} ${payment === "online" ? styles.paymentSelected : ""}`}>
              <input type="radio" name="payment" value="online" checked={payment === "online"} onChange={() => setPayment("online")} disabled />
              <span>پرداخت آنلاین با کارت بانکی</span><small>پس از اتصال درگاه فعال می‌شود</small>
            </label>
            <p className={styles.paymentNote}>پرداخت در محل در حنا پشتیبانی نمی‌شود. پرداخت آنلاین تا اتصال درگاه غیرفعال است.</p>
          </section>
          {validated && Object.values(errors).some(Boolean) && <p className={styles.validationMessage} role="alert">نشانی و اطلاعات گیرنده را بررسی کنید.</p>}
        </form>
        <Link href="/buyer/cart" className={styles.backLink}>بازگشت به سبد خرید</Link>
      </section>
    </main>
    <Footer />
  </div>;
}
