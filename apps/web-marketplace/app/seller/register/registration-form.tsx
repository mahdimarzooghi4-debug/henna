"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { FormField } from "../../../components/form-field";
import { normalizeDigits } from "../../../lib/normalize-digits";
import {
  emptySellerFields, loadSellerDraft, sellerFieldKeys,
  type SellerFields,
} from "../../../lib/seller-draft-preflight";
import { sellerLoginHref } from "../../../lib/seller-return";
import { sellerFieldDifferences } from "../../../lib/seller-conflict";


type SellerConflict =
  | { status: "loading" | "unavailable" }
  | { status: "ready"; fields: SellerFields; revision: number };

export function RegistrationForm() {
  const [fields, setFields] = useState<SellerFields>(emptySellerFields);
  const [invalidField, setInvalidField] = useState<keyof SellerFields | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  const [conflict, setConflict] = useState<SellerConflict | null>(null);
  const conflictHeading = useRef<HTMLHeadingElement>(null);
  const [access, setAccess] = useState<"checking" | "signedIn" | "signedOut" | "unavailable">("checking");


  useEffect(() => {
    const controller = new AbortController();
    void loadSellerDraft(fetch, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === "signedOut") {
        setAccess("signedOut");
        return;
      }
      if (result.status === "unavailable") {
        setAccess("unavailable");
        return;
      }
      if (result.status === "new") {
        setRevision(0);
        setAccess("signedIn");
        return;
      }
      // Release the form only AFTER a complete draft and its matching
      // revision have both arrived. Never merge preflight data over edits.
      setFields(result.fields);
      setSaved(true);
      setRevision(result.revision);
      setMessage("پیش‌نویس اطلاعات اولیه شما بازیابی شد؛ می‌توانید آن را ویرایش کنید.");
      setAccess("signedIn");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (conflict?.status === "ready") conflictHeading.current?.focus();
  }, [conflict]);

  function update(field: keyof SellerFields, value: string) {
    if (access !== "signedIn" || busy || conflict) return;
    setSaved(false);
    setFields((current) => ({ ...current, [field]: value }));
    setInvalidField(null);
    setMessage("");
  }

  async function retrieveCurrentDraft() {
    // A 409 is NEVER permission to resubmit at an assumed revision 0.
    // Recheck the authenticated server draft without discarding local edits.
    setConflict({ status: "loading" });
    const current = await loadSellerDraft(fetch);
    if (current.status === "signedOut") {
      setAccess("signedOut");
      setConflict(null);
      setMessage("نشست شما پایان یافته است. اطلاعات این فرم ذخیره نشد؛ پیش از رفتن به ورود، متن واردشده را نگه دارید.");
    } else if (current.status === "restored") {
      setConflict({
        status: "ready", fields: current.fields,
        revision: current.revision,
      });
      setMessage("این پیش‌نویس جای دیگری تغییر کرده است. دو نسخه را مقایسه کنید و صریحاً انتخاب کنید؛ اطلاعات این پنجره پاک نشده است.");
    } else {
      // A 404 after 409 could mean the draft was removed. Never overwrite
      // using revision zero or claim the server copy is safely available.
      setConflict({ status: "unavailable" });
      setMessage("پس از تعارض، نسخهٔ فعلی پیش‌نویس تأیید نشد؛ اطلاعات این پنجره حفظ شده اما ذخیرهٔ مجدد تا بازیابی نسخهٔ سرور قفل است.");
    }
  }

  async function retryConflict() {
    if (busy || access !== "signedIn" || conflict) return;
    setBusy(true);
    try {
      await retrieveCurrentDraft();
    } finally {
      setBusy(false);
    }
  }

  function chooseServerCopy() {
    if (busy || conflict?.status !== "ready") return;
    // Only an explicit click can discard this tab's unsaved text.
    setFields(conflict.fields);
    setRevision(conflict.revision);
    setSaved(true);
    setInvalidField(null);
    setConflict(null);
    setMessage("آخرین نسخهٔ ذخیره‌شدهٔ سرور بارگذاری شد؛ تغییرات ذخیره‌نشدهٔ این پنجره کنار گذاشته شدند.");
  }

  function chooseMyCopy() {
    if (busy || conflict?.status !== "ready") return;
    // Keep this tab's exact fields, update ONLY the expected revision.
    // Never automatically save over another tab's newer draft.
    setRevision(conflict.revision);
    setSaved(false);
    setInvalidField(null);
    setConflict(null);
    setMessage("متن این پنجره نگه داشته شد. هنوز ذخیره نشده است؛ آن را بررسی کنید و برای ذخیرهٔ صریح دکمهٔ فرم را بزنید.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || access !== "signedIn" || conflict) return;
    const phone = normalizeDigits(fields.phone.trim());
    const postalCode = normalizeDigits(fields.postalCode.trim());
    const next = { ...fields, phone, postalCode };
    setFields(next);
    const missing = sellerFieldKeys.find((key) => !next[key].trim());
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
        body: JSON.stringify({ ...next, revision }),
        cache: "no-store",
      });
      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "DRAFT" &&
          "revision" in result && typeof result.revision === "number" &&
          result.revision === revision + 1) {
          setSaved(true);
          setRevision(result.revision);
          setAccess("signedIn");
          setMessage("اطلاعات اولیه به‌عنوان پیش‌نویس ذخیره شد. ثبت‌نام و فعال‌سازی فروشگاه هنوز تکمیل نشده است.");
          return;
        }
      }
      setSaved(false);
      if (response.status === 409) {
        await retrieveCurrentDraft();
        return;
      }
      if (response.status === 401) setAccess("signedOut");
      setMessage(response.status === 401
        ? "نشست شما پایان یافته است. اطلاعات این فرم ذخیره نشد؛ پیش از رفتن به ورود، متن واردشده را نگه دارید."
        : response.status === 400
          ? "اطلاعات یا شماره مسئول فروشگاه معتبر نیست. شماره باید همان شماره تأییدشده حساب باشد."
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
          برای ذخیره پیش‌نویس ابتدا <Link href={sellerLoginHref}>وارد حساب حنا شوید</Link>.
          پس از ورود به همین فرم برمی‌گردید. اگر متنی را پیش از پایان نشست وارد کرده‌اید، قبل از ترک صفحه آن را کپی کنید؛ ذخیره نشده است.
        </p>
      )}
      {access === "unavailable" && (
        <p className="form-status form-status--error" role="status">
          وضعیت پیش‌نویس فعلاً قابل بررسی نیست. برای جلوگیری از بازنویسی نسخه موجود، فرم تا بررسی موفق غیرفعال است. <button type="button" className="auth-card__secondary" onClick={() => window.location.reload()}>تلاش دوباره</button>
        </p>
      )}
      <form noValidate onSubmit={handleSubmit}>
        <div className="seller-fields">
          <FormField id="store-name" label="نام فروشگاه" placeholder="مثلاً سوپرمارکت بهار"
            maxLength={120} value={fields.storeName} error={invalidField === "storeName"} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("storeName", e.target.value)} />
          <FormField id="owner-name" label="نام و نام خانوادگی مسئول" placeholder="نام مسئول فروشگاه"
            maxLength={120} autoComplete="name" value={fields.ownerName} error={invalidField === "ownerName"} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("ownerName", e.target.value)} />
          <FormField id="seller-phone" label="شماره موبایل" placeholder="09xxxxxxxxx"
            type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11}
            className="field__input--phone" value={fields.phone} error={invalidField === "phone"} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("phone", e.target.value)} />
          <FormField id="city" label="شهر / منطقه" placeholder="شهر و محدوده فعالیت"
            maxLength={120} value={fields.city} error={invalidField === "city"} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("city", e.target.value)} />
          <FormField id="store-address" label="آدرس فروشگاه" placeholder="نشانی کامل فروشگاه"
            maxLength={500} autoComplete="street-address" value={fields.address} error={invalidField === "address"} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("address", e.target.value)} />
          <FormField id="postal-code" label="کدپستی" placeholder="کدپستی ۱۰ رقمی"
            inputMode="numeric" autoComplete="postal-code" maxLength={10}
            className="field__input--phone" value={fields.postalCode}
            error={invalidField === "postalCode"} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("postalCode", e.target.value)} />
        </div>
        <aside className="account-note">
          <p>پس از ثبت اطلاعات، احراز هویت و مدارک صنفی در مرحله بعد تکمیل می‌شود.</p>
        </aside>
        <button className="primary-button" type="submit"
          disabled={busy || access !== "signedIn" || conflict !== null}>
          {busy ? "در حال ذخیره…" : saved ? "ذخیره تغییرات پیش‌نویس" : "ثبت اطلاعات و ادامه"}
        </button>
        {conflict && access === "signedIn" && (
          <section className="seller-conflict"
            aria-labelledby="seller-conflict-heading">
            <h3 id="seller-conflict-heading" ref={conflictHeading}
              tabIndex={-1}>تعارض نسخهٔ پیش‌نویس</h3>
            {conflict.status === "loading" ? (
              <p role="status">در حال دریافت آخرین نسخهٔ ذخیره‌شده…</p>
            ) : conflict.status === "unavailable" ? (
              <>
                <p role="alert">
                  نسخهٔ سرور هنوز قابل اعتماد نیست. متن شما در همین فرم
                  باقی مانده و برای جلوگیری از بازنویسی، ویرایش و ذخیره
                  موقتاً متوقف شده‌اند.
                </p>
                <button type="button" className="auth-card__secondary"
                  disabled={busy} onClick={() => void retryConflict()}>
                  تلاش دوباره برای دریافت نسخهٔ سرور
                </button>
              </>
            ) : (
              <>
                <p>آخرین نسخهٔ سرور با نسخهٔ این پنجره مقایسه شد.
                  انتخاب نسخهٔ سرور، تغییرات ذخیره‌نشدهٔ این پنجره
                  را کنار می‌گذارد؛ نگه‌داشتن متن من، آن را خودکار ذخیره نمی‌کند.</p>
                {sellerFieldDifferences(fields, conflict.fields).length === 0
                  ? <p>متن هر شش فیلد یکسان است؛ فقط شمارهٔ نسخه تغییر کرده است.</p>
                  : (
                    <div className="seller-conflict__differences">
                      {sellerFieldDifferences(fields, conflict.fields)
                        .map((item) => (
                          <div className="seller-conflict__field" key={item.key}>
                            <h4>{item.label}</h4>
                            <div className="seller-conflict__versions">
                              <p><strong>متن این پنجره</strong>
                                <bdi dir="auto">{item.mine || "—"}</bdi></p>
                              <p><strong>نسخهٔ ذخیره‌شده</strong>
                                <bdi dir="auto">{item.onServer || "—"}</bdi></p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                <div className="seller-conflict__actions">
                  <button type="button" className="seller-conflict__use-server"
                    disabled={busy} onClick={chooseServerCopy}>
                    بارگذاری نسخهٔ سرور
                  </button>
                  <button type="button" className="seller-conflict__keep-mine"
                    disabled={busy} onClick={chooseMyCopy}>
                    نگه‌داشتن متن من؛ ذخیره بعد از بررسی
                  </button>
                </div>
              </>
            )}
          </section>
        )}
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
