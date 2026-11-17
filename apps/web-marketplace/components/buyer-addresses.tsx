"use client";

import { useState, type FormEvent } from "react";
import { AddressMapPicker, type SelectedMapPoint } from "./address-map-picker";
import styles from "./buyer-addresses.module.css";
import accountStyles from "./figma-buyer-account.module.css";
import { normalizeDigits, toPersianDigits } from "../lib/normalize-digits";

type FieldName = "title" | "provinceCity" | "address" | "recipient" | "phone" | "postalCode";
type FormFields = Record<FieldName, string>;

const initialFields: FormFields = {
  title: "", provinceCity: "", address: "", recipient: "", phone: "", postalCode: "",
};

import { BuyerAccountNav } from "./buyer-account-nav";

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
        value={name === "phone" || name === "postalCode" ? toPersianDigits(fields[name]) : fields[name]}
        onChange={(event) => updateField(name, name === "phone" || name === "postalCode" ? normalizeDigits(event.target.value) : event.target.value)}
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

  return <main className={accountStyles.page} dir="rtl" data-testid="preview-addresses"><div className={accountStyles.layout}>
      <BuyerAccountNav active="addresses" />
      <section className={styles.content} aria-labelledby="addresses-title">
        <div className={styles.titleRow}>
          <div><h1 id="addresses-title">مدیریت آدرس‌های من</h1><p>آدرس‌های تحویل خود را ثبت و ویرایش کنید تا برای مقایسه فروشگاه‌های اطراف و محاسبه زمان تحویل استفاده شوند.</p></div>
          <button type="button" className={styles.addButton} onClick={() => { setShowForm(true); setFormNotice(""); document.getElementById("new-address-form")?.scrollIntoView({ behavior: "smooth" }); }}>
            افزودن آدرس جدید
          </button>
        </div>
        <section className={styles.savedAddresses} aria-labelledby="saved-title">
          <h2 id="saved-title">آدرس‌های ثبت‌شده</h2>
          <div className={styles.addressList}>
            <article className={styles.addressCard + " " + styles.defaultAddress}>
              <div className={styles.addressCardHeader}>
                <div className={styles.addressActions}><button type="button" aria-label="حذف آدرس نمونه اول">حذف</button><span aria-hidden="true">│</span><button type="button" onClick={() => document.getElementById("new-address-form")?.scrollIntoView({ behavior: "smooth" })}>ویرایش</button></div>
                <div className={styles.addressTitle}><span className={styles.defaultBadge}>آدرس پیش‌فرض</span><h3>آدرس نمونه اول (خانه)</h3></div>
              </div>
              <p className={styles.addressText}>تهران، محله امیرآباد، خیابان کارگر شمالی، کوچه دهم، پلاک ۱۲، واحد ۳</p>
              <div className={styles.addressMeta}><span><b>کد پستی:</b> ۱۴۳۹۶-۱۲۳۴۵</span><span><b>گیرنده:</b> کاربر نمونه</span><span><b>شماره تماس:</b> ۰۹۱۲۳۴۵۶۷۸۹</span></div>
            </article>
            <article className={styles.addressCard}>
              <div className={styles.addressCardHeader}>
                <div className={styles.addressActions}><button type="button" aria-label="حذف آدرس نمونه دوم">حذف</button><span aria-hidden="true">│</span><button type="button" onClick={() => document.getElementById("new-address-form")?.scrollIntoView({ behavior: "smooth" })}>ویرایش</button></div>
                <div className={styles.addressTitle}><h3>آدرس نمونه دوم (محل کار)</h3></div>
              </div>
              <p className={styles.addressText}>تهران، بلوار کشاورز، تقاطع فلسطین، ساختمان آفتاب، طبقه ۴، واحد ۸</p>
              <div className={styles.addressMeta}><span><b>کد پستی:</b> ۱۴۱۵۶-۹۸۷۶۵</span><span><b>گیرنده:</b> شرکت توسعه فناوری محلی (امور اداری)</span><span><b>شماره تماس:</b> ۰۲۱-۸۸۹۹۰۰۱۱</span></div>
            </article>
          </div>
        </section>
        {showForm && <form id="new-address-form" className={styles.formCard} onSubmit={validateForm} noValidate>
          <h2>ثبت آدرس جدید</h2>
          <p className={styles.formIntro}>محل تحویل را روی نقشه مشخص کنید و اطلاعات گیرنده را وارد کنید.</p>
          <AddressMapPicker value={point} onChange={setPoint} />
          {point && <p className={styles.pointNotice} role="status">موقعیت انتخاب‌شده: {toPersianDigits(point.latitude.toFixed(5))}، {toPersianDigits(point.longitude.toFixed(5))}</p>}
          <div className={styles.formGrid}>
            {field("title", "عنوان آدرس", "مثلاً خانه یا محل کار", true)}
            {field("provinceCity", "استان و شهر", "استان، شهر", true)}
            <div className={styles.fullWidth}>{field("address", "آدرس دقیق پستی", "خیابان، کوچه، پلاک و واحد", true)}</div>
            {field("recipient", "نام و نام خانوادگی گیرنده", "نام گیرنده", true)}
            {field("phone", "شماره تماس گیرنده", "۰۹xxxxxxxxx", true, "tel")}
            {field("postalCode", "کد پستی (اختیاری)", "۱۰ رقم", false, "numeric")}
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton}>ثبت آدرس و تایید موقعیت</button>
            <button type="button" className={styles.secondaryButton} onClick={() => { setFields(initialFields); setPoint(null); setErrors({}); setFormNotice(""); }}>پاک‌کردن فرم</button>
            {formNotice && <p className={styles.formNotice} role="status">{formNotice}</p>}
          </div>
          <p className={styles.disclaimer}>این مرحله فقط رابط و اعتبارسنجی فرم را آماده می‌کند؛ تا اتصال ذخیره‌سازی حساب کاربری، آدرسی ثبت یا برای سفارش استفاده نمی‌شود.</p>
        </form>}
      </section>
      
    </div>
  </main>;
}
