"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
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
const keys = Object.keys(emptyFields) as (keyof SellerFields)[];

export function RegistrationForm() {
  const [fields, setFields] = useState<SellerFields>(emptyFields);
  const [invalidField, setInvalidField] = useState<keyof SellerFields | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [access, setAccess] = useState<"checking" | "signedIn" | "signedOut" | "unavailable">("checking");
  const touched = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/seller/registration", {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        setAccess("signedOut");
        return;
      }
      if (response.status !== 200 && response.status !== 404) {
        setAccess("unavailable");
        return;
      }
      setAccess("signedIn");
      if (response.status === 404 || touched.current) return;
      const draft: unknown = await response.json();
      if (!draft || typeof draft !== "object" ||
        !("status" in draft) || draft.status !== "DRAFT") return;
      const values = draft as Record<string, unknown>;
      if (keys.every((key) => typeof values[key] === "string")) {
        setFields(Object.fromEntries(keys.map((key) =>
          [key, values[key]])) as SellerFields);
        setSaved(true);
        setMessage("پیش‌نویس اطلاعات اولیه شما بازیابی شد؛ می‌توانید آن را ویرایش کنید.");
      }
    }).catch(() => {
      // An unavailable service is not proof that the user's draft is absent.
      if (!controller.signal.aborted) setAccess("unavailable");
    });
    return () => controller.abort();
  }, []);

  function update(field: keyof SellerFields, value: string) {
    touched.current = true;
    setSaved(false);
    setFields((current) => ({ ...current, [field]: value }));
    setInvalidField(null);
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || access === "signedOut" || access === "checking") return;
    const phone = normalizeDigits(fields.phone.trim());
    const postalCode = normalizeDigits(fields.postalCode.trim());
    const next = { ...fields, phone, postalCode };
    setFields(next);
    const missing = keys.find((key) => !next[key].trim());
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
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/seller/registration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
        cache: "no-store",
      });
      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "DRAFT") {
          setSaved(true);
          setAccess("signedIn");
          setMessage("اطلاعات اولیه به‌عنوان پیش‌نویس ذخیره شد. ثبت‌نام و فعال‌سازی فروشگاه هنوز تکمیل نشده است.");
          return;
        }
      }
      setSaved(false);
      if (response.status === 401) setAccess("signedOut");
      setMessage(response.status === 401
        ? "برای ذخیره اطلاعات ابتدا از مسیر «ورود / ثبت‌نام» وارد حساب شوید."
        : response.status === 400
          ? "اطلاعات یا شماره مسئول فروشگاه معتبر نیست. شماره باید همان شماره تأییدشده حساب باشد."
          : response.status === 409
            ? "پیش‌نویس فعلی دیگر قابل ویرایش نیست."
            : "ذخیره اطلاعات تأیید نشد؛ لطفاً دوباره تلاش کنید.");
    } catch {
      setSaved(false);
      setMessage("ذخیره اطلاعات تأیید نشد؛ لطفاً دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card seller-card" aria-labelledby="seller-form-heading">
      <h2 id="seller-form-heading">اطلاعات اولیه فروشگاه</h2>
      {access === "checking" && (
        <p className="form-status" role="status">در حال بررسی وضعیت حساب و پیش‌نویس…</p>
      )}
      {access === "signedOut" && (
        <p className="form-status" role="status">
          برای ذخیره پیش‌نویس ابتدا <Link href="/auth">وارد حساب حنا شوید</Link>.
          اطلاعات واردشده تا زمان ورود در سرور ذخیره نمی‌شود.
        </p>
      )}
      {access === "unavailable" && (
        <p className="form-status form-status--error" role="status">
          وضعیت پیش‌نویس فعلاً قابل بررسی نیست؛ ذخیره را تنها پس از پاسخ موفق سرور معتبر بدانید.
        </p>
      )}
      <form noValidate onSubmit={handleSubmit}>
        <div className="seller-fields">
          <FormField id="store-name" label="نام فروشگاه" placeholder="مثلاً سوپرمارکت بهار"
            maxLength={120} value={fields.storeName} error={invalidField === "storeName"} required
            onChange={(e) => update("storeName", e.target.value)} />
          <FormField id="owner-name" label="نام و نام خانوادگی مسئول" placeholder="نام مسئول فروشگاه"
            maxLength={120} autoComplete="name" value={fields.ownerName} error={invalidField === "ownerName"} required
            onChange={(e) => update("ownerName", e.target.value)} />
          <FormField id="seller-phone" label="شماره موبایل" placeholder="09xxxxxxxxx"
            type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11}
            className="field__input--phone" value={fields.phone} error={invalidField === "phone"} required
            onChange={(e) => update("phone", e.target.value)} />
          <FormField id="city" label="شهر / منطقه" placeholder="شهر و محدوده فعالیت"
            maxLength={120} value={fields.city} error={invalidField === "city"} required
            onChange={(e) => update("city", e.target.value)} />
          <FormField id="store-address" label="آدرس فروشگاه" placeholder="نشانی کامل فروشگاه"
            maxLength={500} autoComplete="street-address" value={fields.address} error={invalidField === "address"} required
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
        <button className="primary-button" type="submit"
          disabled={busy || access === "signedOut" || access === "checking"}>
          {busy ? "در حال ذخیره…" : saved ? "ذخیره تغییرات پیش‌نویس" : "ثبت اطلاعات و ادامه"}
        </button>
        {message && (
          <p className={["form-status", (invalidField || (!saved && !busy)) &&
            "form-status--error"].filter(Boolean).join(" ")}
            role={invalidField || (!saved && !busy) ? "alert" : "status"}
            aria-live="polite">{message}</p>
        )}
      </form>
    </section>
  );
}
