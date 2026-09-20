"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { FormField } from "../../components/form-field";
import { normalizeDigits } from "../../lib/normalize-digits";

export function AuthForm() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "invalid" | "unavailable">("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeDigits(phone.trim());
    setPhone(normalized);
    if (!/^09\d{9}$/.test(normalized)) {
      setStatus("invalid");
      return;
    }
    // No simulated OTP, fake success, or call to an unimplemented endpoint.
    setStatus("unavailable");
  }

  return (
    <section className="surface-card auth-card" aria-labelledby="auth-heading">
      <h2 id="auth-heading">ورود / ثبت‌نام</h2>
      <form noValidate onSubmit={handleSubmit}>
        <FormField
          id="auth-phone"
          label="شماره موبایل"
          type="tel"
          autoComplete="tel-national"
          inputMode="numeric"
          className="field__input--phone"
          placeholder="09xxxxxxxxx"
          maxLength={11}
          value={phone}
          required
          error={status === "invalid"}
          onChange={(event) => {
            setPhone(event.target.value);
            setStatus("idle");
          }}
        />
        <button className="primary-button" type="submit">
          دریافت کد تأیید
        </button>
        {status !== "idle" && (
          <p
            className={["form-status", status === "invalid" && "form-status--error"].filter(Boolean).join(" ")}
            role={status === "invalid" ? "alert" : "status"}
            aria-live="polite"
          >
            {status === "invalid"
              ? "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد."
              : "ارسال کد تأیید هنوز به سرویس پیامک و احراز هویت متصل نشده است؛ هیچ کدی ارسال نشد."}
          </p>
        )}
      </form>
      <aside className="account-note">
        <strong>یک حساب برای خرید، مشارکت و اعتبار</strong>
        <p>نوع حساب فقط حقیقی یا حقوقی است. در صورت فعال شدن حمایت، اعتبار به همین حساب اضافه می‌شود.</p>
      </aside>
      <div className="auth-card__footer">
        <p>فروشگاه دارید؟</p>
        <Link href="/seller/register">ثبت‌نام فروشگاه در حنا</Link>
      </div>
    </section>
  );
}
