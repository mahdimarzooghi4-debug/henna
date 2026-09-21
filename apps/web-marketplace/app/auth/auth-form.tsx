"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { FormField } from "../../components/form-field";
import { normalizeDigits } from "../../lib/normalize-digits";
import { sellerRegistrationPath } from "../../lib/seller-return";
import {
  otpRequestTransition, type OtpRequestOutcome,
} from "../../lib/otp-request-transition";
import {
  isConfirmedWebSession, shouldRecheckVisibleWebSession,
  type WebAuthStage,
} from "../../lib/web-session-visibility";

type Stage = WebAuthStage;
type FormStatus = "idle" | "loading" | "invalid" | "limited" | "unavailable";

const challengeIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AuthForm({ returnTo }: {
  returnTo: typeof sellerRegistrationPath | null;
}) {
  const [stage, setStage] = useState<Stage>("checking");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  // A synchronous guard prevents a verify and resend racing before React
  // commits a loading render. Never issue two challenges concurrently.
  const pending = useRef(false);
  const sessionRequest = useRef<AbortController | null>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  function checkSession() {
    if (pending.current) return;
    // Rechecking a visible authenticated tab hides the old success state
    // until the SAME server-backed HttpOnly cookie is actually verified.
    sessionRequest.current?.abort();
    const controller = new AbortController();
    sessionRequest.current = controller;
    setStage("checking");
    setStatus("idle");
    setMessage("");
    void fetch("/api/auth/session", {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      if (controller.signal.aborted ||
        sessionRequest.current !== controller) return;

      if (response.status === 401) {
        // Only a server-confirmed 401 proves the prior session is gone.
        setPhone("");
        setCode("");
        setChallengeId("");
        setStage("phone");
        return;
      }
      if (response.status !== 200) {
        // 403, 429, 500, 503, malformed or unexpected 2xx must not
        // falsely turn an unverified account into a signed-out visitor.
        setStage("session-unavailable");
        return;
      }
      const body: unknown = await response.json();
      if (controller.signal.aborted ||
        sessionRequest.current !== controller) return;
      if (!isConfirmedWebSession(body)) {
        setStage("session-unavailable");
        return;
      }
      if (returnTo === sellerRegistrationPath) {
        // Only the existing compile-time allowlisted destination is valid.
        window.location.replace(sellerRegistrationPath);
        return;
      }
      setStage("authenticated");
    }).catch(() => {
      if (!controller.signal.aborted &&
        sessionRequest.current === controller)
        setStage("session-unavailable");
    });
  }

  useEffect(() => {
    checkSession();
    return () => sessionRequest.current?.abort();
  }, [returnTo]);

  useEffect(() => {
    // Focus follows the real state, including a 202 RESEND with a fresh
    // challenge but unchanged stage. No focus theft on 429/verify errors.
    if (stage === "phone") phoneInput.current?.focus();
    if (stage === "code") codeInput.current?.focus();
  }, [stage, challengeId]);

  async function requestCode(resend: boolean) {
    if (pending.current || status === "loading") return;
    if (resend && (stage !== "code" || !challengeIdPattern.test(challengeId)))
      return;
    if (!resend && stage !== "phone") return;
    const normalized = normalizeDigits(phone.trim());
    if (!/^09\d{9}$/.test(normalized)) {
      if (resend) {
        setStage("phone");
        setChallengeId("");
        setCode("");
      }
      setStatus("invalid");
      setMessage("شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.");
      return;
    }

    // Store no OTP code/challenge anywhere beyond this component's memory.
    const previous = { challengeId, code };
    setPhone(normalized);
    pending.current = true;
    setStatus("loading");
    setMessage("");
    let outcome: OtpRequestOutcome = { status: "unavailable" };
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
        cache: "no-store",
      });
      if (response.status === 202) {
        const body: unknown = await response.json();
        const id = body && typeof body === "object" && "challengeId" in body &&
          typeof body.challengeId === "string" ? body.challengeId : "";
        if (challengeIdPattern.test(id))
          outcome = { status: "accepted", challengeId: id };
      } else if (response.status === 400) {
        outcome = { status: "invalid" };
      } else if (response.status === 429) {
        outcome = { status: "limited" };
      }
    } catch {
      // An unknown send outcome is NOT permission to retain an old OTP:
      // the issuer may have consumed the old challenge before a timeout.
    } finally {
      pending.current = false;
    }

    const next = otpRequestTransition(outcome, previous, resend);
    setChallengeId(next.challengeId);
    setCode(next.code);
    setStage(next.stage);
    setStatus(next.status);
    setMessage(next.message);
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading" || pending.current ||
      stage !== "code" || !challengeIdPattern.test(challengeId)) return;
    const normalized = normalizeDigits(code.trim());
    setCode(normalized);
    if (!/^\d{6}$/.test(normalized)) {
      setStatus("invalid");
      setMessage("کد تأیید باید شش رقم باشد.");
      return;
    }
    pending.current = true;
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, challengeId, code: normalized }),
        cache: "no-store",
      });
      if (response.status === 200) {
        const body: unknown = await response.json();
        if (body && typeof body === "object" &&
          "authenticated" in body && body.authenticated === true) {
          setStage("authenticated");
          setPhone("");
          setCode("");
          setChallengeId("");
          setStatus("idle");
          if (returnTo === sellerRegistrationPath)
            window.location.replace(sellerRegistrationPath);
          return;
        }
      }
      setStatus(response.status === 400 || response.status === 401
        ? "invalid" : response.status === 429 ? "limited" : "unavailable");
      setMessage(response.status === 400 || response.status === 401
        ? "کد یا اطلاعات تأیید معتبر نیست."
        : response.status === 429
          ? "تعداد تلاش‌ها زیاد است؛ کمی بعد تلاش کنید."
          : "خدمت تأیید کد در دسترس نیست؛ ورود انجام نشد.");
    } catch {
      setStatus("unavailable");
      setMessage("خدمت تأیید کد در دسترس نیست؛ ورود انجام نشد.");
    } finally {
      pending.current = false;
    }
  }

  async function logout() {
    if (status === "loading" || pending.current) return;
    pending.current = true;
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/auth/session", {
        method: "DELETE",
        cache: "no-store",
      });
      if (response.status === 204 || response.status === 401) {
        setStage("phone");
        setStatus("idle");
        setPhone("");
        setCode("");
        setChallengeId("");
        return;
      }
    } catch {
      // Retain the UI session when revocation outcome is unknown.
    } finally {
      pending.current = false;
    }
    setStatus("unavailable");
    setMessage("خروج از حساب تأیید نشد؛ دوباره تلاش کنید.");
  }

  const busy = status === "loading";

  return (
    <section className="surface-card auth-card" aria-labelledby="auth-heading">
      <h2 id="auth-heading">ورود / ثبت‌نام</h2>
      {stage === "checking" && <p role="status">در حال بررسی وضعیت ورود…</p>}
      {stage === "session-unavailable" && (
        <div role="status">
          <p>بررسی وضعیت حساب فعلاً در دسترس نیست. لطفاً دوباره تلاش کنید.</p>
          <button type="button" className="primary-button"
            onClick={checkSession}>بررسی دوباره بدون ترک صفحه</button>
        </div>
      )}
      {stage === "phone" && (
        <form noValidate onSubmit={(event) => {
          event.preventDefault();
          void requestCode(false);
        }}>
          <FormField id="auth-phone" label="شماره موبایل" type="tel"
            autoComplete="tel-national" inputMode="numeric"
            className="field__input--phone" placeholder="09xxxxxxxxx"
            maxLength={11} value={phone} required
            inputRef={phoneInput} disabled={busy}
            aria-describedby={status === "invalid" ? "auth-feedback" : undefined}
            error={status === "invalid"}
            onChange={(event) => {
              setPhone(event.target.value);
              setStatus("idle");
              setMessage("");
            }}
          />
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "در حال بررسی…" : "دریافت کد تأیید"}
          </button>
        </form>
      )}
      {stage === "code" && (
        <form noValidate onSubmit={verifyCode}>
          <p className="auth-card__hint">
            اگر پیامک را دریافت کرده‌اید، کد آن را وارد کنید.
          </p>
          <FormField id="auth-code" label="کد تأیید" type="text"
            autoComplete="one-time-code" inputMode="numeric"
            className="field__input--phone" placeholder="کد شش‌رقمی"
            maxLength={6} value={code} required
            inputRef={codeInput} disabled={busy}
            aria-describedby={status === "invalid" ? "auth-feedback" : undefined}
            error={status === "invalid"}
            onChange={(event) => {
              setCode(event.target.value);
              setStatus("idle");
              setMessage("");
            }}
          />
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "در حال تأیید…" : "تأیید کد و ورود"}
          </button>
          <button className="auth-card__secondary" type="button" disabled={busy}
            onClick={() => {
              if (pending.current) return;
              setStage("phone");
              setCode("");
              setChallengeId("");
              setStatus("idle");
              setMessage("");
            }}>اصلاح شماره موبایل</button>
          <button className="auth-card__secondary" type="button" disabled={busy}
            onClick={() => void requestCode(true)}>
            درخواست کد جدید
          </button>
        </form>
      )}
      {stage === "authenticated" && (
        <div>
          <p className="form-status" role="status">
            ورود انجام شده است. حساب پایه شما فعال است.
          </p>
          {returnTo === sellerRegistrationPath && (
            <Link href={sellerRegistrationPath} className="auth-card__secondary">
              ادامه ثبت‌نام فروشگاه
            </Link>
          )}
          <button className="primary-button" type="button" disabled={busy}
            onClick={logout}>
            {busy ? "در حال خروج…" : "خروج از حساب"}
          </button>
        </div>
      )}
      {message && stage !== "checking" && (
        <p id="auth-feedback" className={["form-status", status === "invalid" && "form-status--error"]
          .filter(Boolean).join(" ")}
          role={status === "invalid" ? "alert" : "status"}
          aria-live="polite">{message}</p>
      )}
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
