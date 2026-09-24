"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  programId: string;
  revision: number;
};

type Feedback =
  | { tone: "error" | "warn"; message: string }
  | null;

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object"
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function OrganizationProgramRegisterAction({
  programId,
  revision,
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [conflictRevision, setConflictRevision] =
    useState<number | "unknown" | null>(null);
  const attempt = useRef<{ revision: number; key: string } | null>(null);

  async function register() {
    if (busy) return;
    if (!attempt.current || attempt.current.revision !== revision) {
      attempt.current = {
        revision,
        key: crypto.randomUUID(),
      };
    }

    setBusy(true);
    setFeedback(null);
    setConflictRevision(null);
    try {
      const response = await fetch(
        `/api/organization/programs/${programId}/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision,
            idempotencyKey: attempt.current.key,
          }),
        },
      );
      const body = await jsonBody(response);

      if (response.ok &&
        body.status === "REGISTERED" &&
        typeof body.revision === "number" &&
        body.revision === revision + 1) {
        attempt.current = null;
        router.refresh();
        return;
      }

      if (response.status === 409) {
        const currentRevision =
          typeof body.currentRevision === "number" &&
          Number.isSafeInteger(body.currentRevision)
            ? body.currentRevision
            : null;
        setConflictRevision(currentRevision ?? "unknown");
        setFeedback({
          tone: "warn",
          message: currentRevision
            ? `طرح از نسخه ${revision} به نسخه ${currentRevision} تغییر کرده است. قبل از ثبت نهایی نسخه جدید را بررسی کنید.`
            : "وضعیت یا نسخه طرح تغییر کرده است. قبل از ثبت نهایی نسخه جدید را بررسی کنید.",
        });
        return;
      }

      setFeedback({
        tone: response.status === 403 ? "warn" : "error",
        message: typeof body.message === "string"
          ? body.message
          : "ثبت نهایی طرح تأیید نشد؛ دوباره تلاش کنید.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "ارتباط با سرویس ثبت نهایی برقرار نشد. تلاش مجدد همین درخواست را با همان کلید امن تکرار می‌کند.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="org-register-action">
      {!confirming ? (
        <button
          className="org-button org-button--primary"
          type="button"
          disabled={busy}
          onClick={() => {
            setFeedback(null);
            setConfirming(true);
          }}
        >
          ثبت نهایی طرح
        </button>
      ) : (
        <div className="org-register-confirm" role="group" aria-label="تأیید ثبت نهایی طرح">
          <strong>ثبت نهایی این پیش‌نویس؟</strong>
          <p>
            وضعیت طرح از «پیش‌نویس» به «ثبت‌شده» تغییر می‌کند و پس از آن
            ویرایش Draft در قرارداد فعلی بسته است. این اقدام فعال‌سازی یا
            تخصیص اعتبار انجام نمی‌دهد.
          </p>
          <div className="org-actions">
            <button
              className="org-button org-button--primary"
              type="button"
              disabled={busy}
              onClick={register}
            >
              {busy ? "در حال ثبت..." : "تأیید و ثبت نهایی"}
            </button>
            <button
              className="org-button"
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setFeedback(null);
              }}
            >
              انصراف
            </button>
          </div>
        </div>
      )}

      {feedback ? (
        <div
          className={`org-form-feedback org-form-feedback--${feedback.tone}`}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      ) : null}

      {conflictRevision !== null ? (
        <button
          className="org-button org-register-reload"
          type="button"
          disabled={busy}
          onClick={() => window.location.reload()}
        >
          بارگذاری نسخه جدید
        </button>
      ) : null}
    </div>
  );
}
