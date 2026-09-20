"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { FormField } from "../../components/form-field";
import { normalizeDigits } from "../../lib/normalize-digits";

export function AuthForm() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<
    "idle" | "invalid" | "loading" | "unavailable" | "limited" | "sent"
  >("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;

    const normalized = normalizeDigits(phone.trim());
    setPhone(normalized);
    if (!/^09\d{9}$/.test(normalized)) {
      setStatus("invalid");
      return;
    }

    setStatus("loading");
    try {
      // Same-origin Next route; backend URL stays server-side.
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
        cache: "no-store",
      });
      setStatus(
        response.status === 202
          ? "sent"
          : response.status === 400
            ? "invalid"
            : response.status === 429
              ? "limited"
              : "unavailable",
      );
    } catch {
      setStatus("unavailable");
    }
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
        <button className="primary-button" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "در حال بررسی…" : "دریافت کد تأیید"}
        </button>
        {status !== "idle" && status !== "loading" && (
          <p
            className={["form-status", status === "invalid" && "form-status--error"].filter(Boolean).join(" ")}
            role={status === "invalid" ? "alert" : "status"}
            aria-live="polite"
          >
            {status === "invalid"
              ? "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد."
              : status === "limited"
                ? "تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید."
                : status === "sent"
                  ? "درخواست ارسال پذیرفته شد. مرحله واردکردن کد هنوز آماده نیست."
                  : "سرویس ارسال کد تأیید در دسترس نیست؛ کدی ارسال نشد."}
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
