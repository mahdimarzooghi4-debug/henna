"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "../../../components/form-field";
import { normalizeDigits } from "../../../lib/normalize-digits";

type SellerFields = {
  storeName: string;
  ownerName: string;
  phone: string;
  city: string;
  address: string;
  postalCode: string;
};

const emptyFields: SellerFields = {
  storeName: "", ownerName: "", phone: "", city: "", address: "", postalCode: "",
};

export function RegistrationForm() {
  const [fields, setFields] = useState<SellerFields>(emptyFields);
  const [invalidField, setInvalidField] = useState<keyof SellerFields | null>(null);
  const [message, setMessage] = useState("");

  function update(field: keyof SellerFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setInvalidField(null);
    setMessage("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = normalizeDigits(fields.phone.trim());
    const postalCode = normalizeDigits(fields.postalCode.trim());
    const next = { ...fields, phone, postalCode };
    setFields(next);
    const missing = (Object.keys(next) as (keyof SellerFields)[])
      .find((key) => !next[key].trim());
    if (missing) {
      setInvalidField(missing);
      setMessage("لطفاً همه اطلاعات اولیه فروشگاه را تکمیل کنید.");
      return;
    }
    if (!/^09\d{9}$/.test(phone)) {
      setInvalidField("phone");
      setMessage("شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.");
      return;
    }
    if (!/^\d{10}$/.test(postalCode)) {
      setInvalidField("postalCode");
      setMessage("کدپستی باید دقیقاً ۱۰ رقم داشته باشد.");
      return;
    }
    setInvalidField(null);
    // Local form preview only: do not retain PII or claim to register a shop.
    setMessage("مرحله ارسال اطلاعات و احراز فروشگاه هنوز به بک‌اند متصل نشده است؛ اطلاعاتی ثبت یا ارسال نشد.");
  }

  return (
    <section className="surface-card seller-card" aria-labelledby="seller-form-heading">
      <h2 id="seller-form-heading">اطلاعات اولیه فروشگاه</h2>
      <form noValidate onSubmit={handleSubmit}>
        <div className="seller-fields">
          <FormField id="store-name" label="نام فروشگاه" placeholder="مثلاً سوپرمارکت بهار"
            value={fields.storeName} error={invalidField === "storeName"} required
            onChange={(e) => update("storeName", e.target.value)} />
          <FormField id="owner-name" label="نام و نام خانوادگی مسئول" placeholder="نام مسئول فروشگاه"
            autoComplete="name" value={fields.ownerName} error={invalidField === "ownerName"} required
            onChange={(e) => update("ownerName", e.target.value)} />
          <FormField id="seller-phone" label="شماره موبایل" placeholder="09xxxxxxxxx"
            type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11}
            className="field__input--phone" value={fields.phone} error={invalidField === "phone"} required
            onChange={(e) => update("phone", e.target.value)} />
          <FormField id="city" label="شهر / منطقه" placeholder="شهر و محدوده فعالیت"
            value={fields.city} error={invalidField === "city"} required
            onChange={(e) => update("city", e.target.value)} />
          <FormField id="store-address" label="آدرس فروشگاه" placeholder="نشانی کامل فروشگاه"
            autoComplete="street-address" value={fields.address} error={invalidField === "address"} required
            onChange={(e) => update("address", e.target.value)} />
          <FormField id="postal-code" label="کدپستی" placeholder="کدپستی ۱۰ رقمی"
            inputMode="numeric" autoComplete="postal-code" maxLength={10}
            className="field__input--phone" value={fields.postalCode}
            error={invalidField === "postalCode"} required
            onChange={(e) => update("postalCode", e.target.value)} />
        </div>
        <aside className="account-note">
          <p>پس از ثبت اطلاعات، احراز هویت و مدارک صنفی در مرحله بعد تکمیل می‌شود.</p>
        </aside>
        <button className="primary-button" type="submit">ثبت اطلاعات و ادامه</button>
        {message && (
          <p className={["form-status", invalidField && "form-status--error"].filter(Boolean).join(" ")}
            role={invalidField ? "alert" : "status"} aria-live="polite">{message}</p>
        )}
      </form>
    </section>
  );
}
