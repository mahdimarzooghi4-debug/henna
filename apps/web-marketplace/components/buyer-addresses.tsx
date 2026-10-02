"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AddressMapPicker, type SelectedMapPoint } from "./address-map-picker";
import styles from "./buyer-addresses.module.css";
import { normalizeDigits } from "../lib/normalize-digits";

type FieldName = "title" | "provinceCity" | "address" | "recipient" | "phone" | "postalCode";
type FormFields = Record<FieldName, string>;

const initialFields: FormFields = {
  title: "", provinceCity: "", address: "", recipient: "", phone: "", postalCode: "",
};

const navLinks = [
  ["/account", "اطلاعات حساب"], ["/account/addresses", "آدرس‌های من"], ["/orders", "سفارش‌های من"],
  ["/account#payments", "روش‌های پرداخت"], ["/programs", "اعتبارهای من"],
  ["/programs", "طرح‌های فعال"], ["/programs", "مشارکت‌های اجتماعی"],
  ["/support", "پشتیبانی"], ["/account#settings", "تنظیمات"],
] as const;

function BuyerHeader() {
  return <>
    <div className={styles.announcement}>بازارگاه حنا؛ خرید روزمره با پشتیبانی از توسعهٔ اجتماعی</div>
    <header className={styles.header} dir="rtl">
      <Link href="/" className={styles.logo} aria-label="صفحه اصلی حنا">
        <Image src="/hana-logo.png" alt="حنا" width={150} height={84} unoptimized priority />
      </Link>
      <form action="/products" className={styles.search}>
        <input name="search" placeholder="جست‌وجوی کالاها و خدمات روزمره…" aria-label="جست‌وجو" />
        <button type="submit" aria-label="جست‌وجو">⌕</button>
      </form>
      <nav className={styles.headerActions} aria-label="دسترسی سریع">
        <Link href="/basket">سبد خرید</Link><Link href="/auth">ورود یا ثبت‌نام</Link>
        <Link href="/seller/register">ثبت‌نام فروشگاه‌ها</Link>
      </nav>
    </header>
    <nav className={styles.categoryNav} dir="rtl" aria-label="دسته‌بندی‌ها">
      <Link href="/products">همه دسته‌ها</Link><Link href="/products">کالاها و خدمات</Link>
      <Link href="/products">نیازهای روزمره</Link><Link href="/programs">طرح‌های ویژه</Link>
      <Link href="/programs">کالابرگ / اعتبارها</Link><Link href="/support">پشتیبانی</Link>
    </nav>
  </>;
}

function BuyerFooter() {
  return <footer className={styles.footer} dir="rtl">
    <div className={styles.footerGrid}>
      <div><h2>دسترسی سریع</h2><Link href="/faq">سوالات متداول</Link><Link href="/terms">قوانین و مقررات</Link><Link href="/about">درباره حنا</Link><Link href="/support">تماس با پشتیبانی</Link></div>
      <div><h2>همکاری با حنا</h2><Link href="/seller/register">ثبت فروشگاه جدید</Link><Link href="/seller">پنل فروشندگان</Link><Link href="/seller-guide">شرایط همکاری</Link></div>
      <div><h2>طرح‌های حمایتی</h2><Link href="/programs">اعتبارات سازمانی</Link><Link href="/programs">طرح‌های فعال</Link></div>
      <div className={styles.footerBrand}><Link href="/"><Image src="/hana-logo.png" alt="حنا" width={140} height={79} unoptimized /></Link><p>بازارگاه حنا برای خریدهای روزمره با رویکرد توسعهٔ عادلانه و حمایت اجتماعی.</p></div>
    </div>
    <p className={styles.copyright}>حنا با هدف برقراری عدالت اجتماعی توسعه داده شده است. کلیه حقوق برای حنا محفوظ است.</p>
  </footer>;
}

function validate(fields: FormFields) {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!fields.title.trim()) errors.title = "برای این نشانی یک عنوان بنویسید.";
  if (!fields.provinceCity.trim()) errors.provinceCity = "استان و شهر را وارد کنید.";
  if (!fields.address.trim()) errors.address = "نشانی دقیق را وارد کنید.";
  if (!fields.recipient.trim()) errors.recipient = "نام گیرنده را وارد کنید.";
  if (!/^09\d{9}$/.test(normalizeDigits(fields.phone).replace(/[\s-]/g, ""))) errors.phone = "شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.";
  if (fields.postalCode && !/^\d{10}$/.test(normalizeDigits(fields.postalCode).replace(/[\s-]/g, ""))) errors.postalCode = "کد پستی باید ۱۰ رقم باشد.";
  return errors;
}

export function BuyerAddresses() {
  const [fields, setFields] = useState<FormFields>(initialFields);
  const [point, setPoint] = useState<SelectedMapPoint | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formNotice, setFormNotice] = useState("");
  const [showForm, setShowForm] = useState(true);

  function updateField(name: FieldName, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFormNotice("");
  }

  function validateForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    setFormNotice(Object.keys(nextErrors).length
      ? "اطلاعات مشخص‌شده را بررسی کنید."
      : "فرم کامل است. ذخیرهٔ نشانی پس از اتصال API حساب کاربری فعال می‌شود.");
  }

  const field = (name: FieldName, label: string, placeholder: string, required = false, inputMode: "text" | "numeric" | "tel" = "text") => (
    <label className={styles.field} key={name}>
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      <input
        name={name}
        value={fields[name]}
        onChange={(event) => updateField(name, event.target.value)}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        dir={name === "phone" || name === "postalCode" ? "ltr" : "rtl"}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        maxLength={name === "phone" ? 11 : name === "postalCode" ? 10 : undefined}
      />
      {errors[name] && <small id={`${name}-error`} className={styles.fieldError}>{errors[name]}</small>}
    </label>
  );

  return <div className={styles.page} dir="rtl">
    <BuyerHeader />
    <main className={styles.layout}>
      <section className={styles.content} aria-labelledby="addresses-title">
        <div className={styles.titleRow}>
          <div><h1 id="addresses-title">مدیریت آدرس‌های من</h1><p>نشانی‌های تحویل را ثبت کنید تا هنگام خرید سریع‌تر انتخاب شوند.</p></div>
          <button type="button" className={styles.addButton} onClick={() => { setShowForm((open) => !open); setFormNotice(""); }}>
            {showForm ? "بستن فرم" : "+ افزودن آدرس جدید"}
          </button>
        </div>
        <section className={styles.savedAddresses} aria-labelledby="saved-title">
          <h2 id="saved-title">آدرس‌های ذخیره‌شده</h2>
          <p className={styles.emptyState}>هنوز نشانی‌ای به حساب شما اضافه نشده است.</p>
        </section>
        {showForm && <form className={styles.formCard} onSubmit={validateForm} noValidate>
          <h2>ثبت آدرس جدید</h2>
          <p className={styles.formIntro}>محل تحویل را روی نقشه مشخص کنید و اطلاعات گیرنده را وارد کنید.</p>
          <AddressMapPicker value={point} onChange={setPoint} />
          {point && <p className={styles.pointNotice} role="status">موقعیت انتخاب‌شده: {point.latitude.toFixed(5)}، {point.longitude.toFixed(5)}</p>}
          <div className={styles.formGrid}>
            {field("title", "عنوان آدرس", "مثلاً خانه یا محل کار", true)}
            {field("provinceCity", "استان و شهر", "استان، شهر", true)}
            <div className={styles.fullWidth}>{field("address", "آدرس دقیق پستی", "خیابان، کوچه، پلاک و واحد", true)}</div>
            {field("recipient", "نام و نام خانوادگی گیرنده", "نام گیرنده", true)}
            {field("phone", "شماره تماس گیرنده", "09xxxxxxxxx", true, "tel")}
            {field("postalCode", "کد پستی (اختیاری)", "۱۰ رقم", false, "numeric")}
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton}>بررسی اطلاعات آدرس</button>
            <button type="button" className={styles.secondaryButton} onClick={() => { setFields(initialFields); setPoint(null); setErrors({}); setFormNotice(""); }}>پاک‌کردن فرم</button>
            {formNotice && <p className={styles.formNotice} role="status">{formNotice}</p>}
          </div>
          <p className={styles.disclaimer}>این مرحله فقط رابط و اعتبارسنجی فرم را آماده می‌کند؛ تا اتصال ذخیره‌سازی حساب کاربری، آدرسی ثبت یا برای سفارش استفاده نمی‌شود.</p>
        </form>}
      </section>
      <aside className={styles.accountNav} aria-label="منوی حساب کاربری">
        <h2>اطلاعات حساب</h2>
        {navLinks.map(([href, label]) => <Link key={label} href={href} aria-current={href === "/account/addresses" ? "page" : undefined} className={href === "/account/addresses" ? styles.activeNav : undefined}>{label}</Link>)}
      </aside>
    </main>
    <BuyerFooter />
  </div>;
}
