"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Loaded = {
  trackingCode: string;
  revision: number;
  reviewerReason: string;
  amendment: null | {
    id: string;
    baseRevision: number;
    responseText: string;
    referenceUrl: string | null;
    updatedAtUtc: string;
  };
};

export function SellerAmendmentView() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [responseText, setResponseText] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [amendmentId, setAmendmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("در حال دریافت پرونده…");
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/seller/registration/amendment", {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const body: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok || !body || typeof body !== "object") {
        setError(true);
        const errorBody = body && typeof body === "object"
          ? body as Record<string, unknown>
          : null;
        setMessage(errorBody &&
          typeof errorBody.message === "string"
          ? errorBody.message
          : "پرونده تکمیلی در دسترس نیست.");
        return;
      }
      const value = body as Loaded;
      setLoaded(value);
      if (value.amendment) {
        setAmendmentId(value.amendment.id);
        setResponseText(value.amendment.responseText);
        setReferenceUrl(value.amendment.referenceUrl ?? "");
      }
      setMessage("");
    }).catch(() => {
      if (!controller.signal.aborted) {
        setError(true);
        setMessage("پرونده تکمیلی در دسترس نیست.");
      }
    });
    return () => controller.abort();
  }, []);

  async function save() {
    if (!loaded || busy) return;
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      const response = await fetch("/api/seller/registration/amendment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: loaded.revision,
          responseText,
          referenceUrl: referenceUrl.trim() || null,
        }),
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" ||
        !("amendmentId" in body) ||
        typeof body.amendmentId !== "string") {
        setError(true);
        setMessage(body && typeof body === "object" &&
          "message" in body && typeof body.message === "string"
          ? body.message
          : "ذخیره پاسخ اصلاحی تأیید نشد.");
        return;
      }
      setAmendmentId(body.amendmentId);
      setMessage("پاسخ اصلاحی ذخیره شد.");
    } catch {
      setError(true);
      setMessage("ذخیره پاسخ اصلاحی تأیید نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function resubmit() {
    if (!loaded || !amendmentId || busy) return;
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      const response = await fetch("/api/seller/registration/amendment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: loaded.revision,
          amendmentId,
        }),
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !body || typeof body !== "object" ||
        !("reviewStatus" in body) ||
        body.reviewStatus !== "UNDER_REVIEW") {
        setError(true);
        setMessage(body && typeof body === "object" &&
          "message" in body && typeof body.message === "string"
          ? body.message
          : "ارسال مجدد تأیید نشد.");
        return;
      }
      window.location.assign("/seller/register/status");
    } catch {
      setError(true);
      setMessage("ارسال مجدد تأیید نشد.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <p className={error
      ? "form-status form-status--error"
      : "form-status"} role={error ? "alert" : "status"}>
      {message}
    </p>;
  }

  return (
    <section className="seller-amendment"
      aria-labelledby="seller-amendment-title">
      <div className="seller-amendment__reason">
        <span>کد پیگیری</span>
        <strong dir="ltr">{loaded.trackingCode}</strong>
        <h2 id="seller-amendment-title">تکمیل اطلاعات درخواست</h2>
        <p>{loaded.reviewerReason}</p>
      </div>

      <label className="seller-amendment__field">
        <span>پاسخ و توضیحات اصلاحی</span>
        <textarea
          maxLength={2000}
          rows={8}
          value={responseText}
          disabled={busy}
          onChange={(event) => {
            setResponseText(event.target.value);
            setMessage("");
          }}
          placeholder="توضیح دهید چه اطلاعاتی تکمیل یا اصلاح شده است." />
      </label>

      <label className="seller-amendment__field">
        <span>لینک مرجع یا مستند آنلاین (اختیاری)</span>
        <input
          type="url"
          maxLength={500}
          value={referenceUrl}
          disabled={busy}
          onChange={(event) => {
            setReferenceUrl(event.target.value);
            setMessage("");
          }}
          placeholder="https://example.com/reference" />
      </label>

      <div className="seller-amendment__actions">
        <button type="button" className="auth-card__secondary"
          disabled={busy || !responseText.trim()}
          onClick={() => void save()}>
          {busy ? "در حال ذخیره…" : "ذخیره پاسخ"}
        </button>
        <button type="button" className="primary-button"
          disabled={busy || !amendmentId}
          onClick={() => void resubmit()}>
          {busy ? "در حال ارسال…" : "ارسال مجدد برای بررسی"}
        </button>
      </div>

      {message && (
        <p className={error
          ? "form-status form-status--error"
          : "form-status"} role={error ? "alert" : "status"}>
          {message}
        </p>
      )}

      <p className="seller-amendment__note">
        ثبت پاسخ اصلاحی، درخواست قبلی را حذف نمی‌کند؛ سابقه بررسی و
        کد پیگیری همان پرونده حفظ می‌شود.
      </p>

      <Link className="auth-card__secondary" href="/seller/register/status">
        بازگشت به وضعیت درخواست
      </Link>
    </section>
  );
}
