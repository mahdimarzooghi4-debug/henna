"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FormField } from "../../components/form-field";
import { normalizeDigits, toPersianDigits } from "../../lib/normalize-digits";

// UI preview only. No OTP request, verification, session, account, storage,
// or protected redirect. The real AuthForm and backend remain unchanged.
export function AuthPreviewForm() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const phoneInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "phone") phoneInput.current?.focus();
    else codeInput.current?.focus();
  }, [step]);

  return (
    <section className="surface-card auth-card" aria-labelledby="auth-preview-heading" data-testid="auth-ui-preview">
      <h2 id="auth-preview-heading">ورود یا ثبت‌نام در حنا</h2>
      <p className="form-status">مسیر آزمایشی — پیامک غیرفعال است؛ هیچ حساب یا نشست واقعی ایجاد نمی‌شود.</p>
      {step === "phone" ? (
        <form noValidate onSubmit={(event) => {
          event.preventDefault();
          const normalized = normalizeDigits(phone.trim());
          if (!/^09\d{9}$/.test(normalized)) {
            setError("شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.");
            return;
          }
          setPhone(normalized);
          setError("");
          setStep("code");
        }}>
          <FormField id="auth-phone" label="شماره موبایل" type="tel"
            autoComplete="off" inputMode="numeric" maxLength={11}
            className="field__input--phone" placeholder="۰۹xxxxxxxxx"
            value={toPersianDigits(phone)} required inputRef={phoneInput} error={!!error}
            aria-describedby={error ? "auth-preview-error" : undefined}
            onChange={(event) => { setPhone(normalizeDigits(event.target.value)); setError(""); }} />
          <button className="primary-button" type="submit">دریافت کد تأیید</button>
          {error && <p id="auth-preview-error" role="alert" className="form-status form-status--error">{error}</p>}
        </form>
      ) : (
        <div>
          <p className="auth-card__hint">مرحله ورود کد نمایشی است. هیچ پیامکی ارسال نشده است.</p>
          <FormField id="auth-code" label="کد نمونه (اختیاری)" type="text"
            autoComplete="off" inputMode="numeric" maxLength={6}
            className="field__input--phone auth-card__code-input"
            placeholder="شش رقم نمونه" value={toPersianDigits(code)} inputRef={codeInput}
            onChange={(event) => setCode(normalizeDigits(event.target.value).replace(/\D/g, "").slice(0, 6))} />
          <Link className="primary-button" href="/buyer/profile?mode=preview">ادامه نمایشی به تکمیل پروفایل</Link>
          <button className="auth-card__secondary" type="button" onClick={() => {
            setCode(""); setError(""); setStep("phone");
          }}>ویرایش شماره</button>
        </div>
      )}
      <Link className="auth-card__secondary" href="/auth?mode=live">ورود واقعی با پیامک</Link>
    </section>
  );
}
