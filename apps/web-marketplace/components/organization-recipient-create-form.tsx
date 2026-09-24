"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  organizationRecipientMatchLabels,
  parseOrganizationRecipient,
  type OrganizationRecipient,
} from "../lib/organization-recipients";
import {
  organizationProgramStatusLabels,
  type OrganizationProgramSummary,
} from "../lib/organization-programs";

type Props = {
  programs: OrganizationProgramSummary[];
};

type Fields = {
  displayName: string;
  externalReference: string;
  phone: string;
  programId: string;
};

type Feedback = {
  tone: "error" | "warn" | "success";
  message: string;
} | null;

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

function signature(fields: Fields) {
  return JSON.stringify({
    displayName: fields.displayName.trim(),
    externalReference: fields.externalReference.trim(),
    phone: fields.phone.trim() || null,
    programId: fields.programId,
  });
}

export function OrganizationRecipientCreateForm({ programs }: Props) {
  const [fields, setFields] = useState<Fields>({
    displayName: "",
    externalReference: "",
    phone: "",
    programId: programs[0]?.id ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [created, setCreated] = useState<OrganizationRecipient | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields(previous => ({ ...previous, [key]: value }));
    setCreated(null);
    setFeedback(null);
    setNeedsReload(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || programs.length === 0) return;

    const currentSignature = signature(fields);
    if (!attempt.current || attempt.current.signature !== currentSignature) {
      attempt.current = {
        signature: currentSignature,
        key: crypto.randomUUID(),
      };
    }

    setBusy(true);
    setFeedback(null);
    setNeedsReload(false);
    try {
      const response = await fetch("/api/organization/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: fields.displayName,
          externalReference: fields.externalReference,
          phone: fields.phone.trim() || null,
          programId: fields.programId,
          idempotencyKey: attempt.current.key,
        }),
      });
      const body = await jsonBody(response);

      const recipient = parseOrganizationRecipient(body);
      if ((response.status === 200 || response.status === 201) &&
        recipient) {
        attempt.current = null;
        setCreated(recipient);
        setFeedback({
          tone: "success",
          message: response.status === 201
            ? "مشمول با موفقیت ثبت شد."
            : "این درخواست قبلاً ثبت شده بود؛ همان رکورد با موفقیت بازیابی شد.",
        });
        return;
      }

      if (response.status === 404) {
        setNeedsReload(true);
        setFeedback({
          tone: "warn",
          message: "طرح انتخاب‌شده دیگر در دسترس نیست. فهرست طرح‌های مجاز را دوباره بارگذاری کنید.",
        });
        return;
      }

      if (response.status === 409) {
        const duplicate = typeof body.existingRecipientId === "string";
        const currentStatus =
          typeof body.currentStatus === "string"
            ? body.currentStatus
            : null;
        setNeedsReload(Boolean(currentStatus));
        setFeedback({
          tone: "warn",
          message: duplicate
            ? "این شناسه قبلاً برای همین طرح ثبت شده است؛ رکورد جدیدی ساخته نشد."
            : currentStatus
              ? "وضعیت طرح انتخاب‌شده تغییر کرده است. فهرست طرح‌های مجاز را دوباره بارگذاری کنید."
              : "درخواست با وضعیت فعلی سازگار نیست. در صورت تلاش مجدد، همان درخواست با همان کلید امن تکرار می‌شود.",
        });
        return;
      }

      setFeedback({
        tone: response.status === 403 ? "warn" : "error",
        message: typeof body.message === "string"
          ? body.message
          : "افزودن مشمول تأیید نشد؛ دوباره تلاش کنید.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "ارتباط با سرویس افزودن مشمول برقرار نشد. تلاش مجدد همین درخواست را با همان کلید امن تکرار می‌کند.",
      });
    } finally {
      setBusy(false);
    }
  }

  function resetForAnother() {
    attempt.current = null;
    setFields({
      displayName: "",
      externalReference: "",
      phone: "",
      programId: programs[0]?.id ?? "",
    });
    setCreated(null);
    setFeedback(null);
    setNeedsReload(false);
  }

  return (
    <form className="org-recipient-create-form" onSubmit={submit}>
      <div className="org-form-head">
        <h2>افزودن انفرادی مشمول جدید</h2>
        <p>مشخصات هویتی و ارتباطی پایه فرد را ثبت نمایید</p>
      </div>
      <div className="org-divider" />
      <div className="org-form-grid org-form-grid--single">
        <label>
          نام و عنوان نمایشی
          <input
            required
            maxLength={200}
            autoComplete="name"
            value={fields.displayName}
            onChange={event => update("displayName", event.target.value)}
            placeholder="مثال: محمد امینی"
            disabled={busy}
          />
        </label>
        <label>
          شناسه موردنیاز
          <input
            required
            maxLength={80}
            autoComplete="off"
            value={fields.externalReference}
            onChange={event => update(
              "externalReference",
              event.target.value,
            )}
            placeholder="شناسه موردنیاز سازمان"
            disabled={busy}
          />
        </label>
        <label>
          شماره تلفن همراه (جهت تطبیق حساب کاربری)
          <input
            inputMode="tel"
            autoComplete="tel"
            maxLength={32}
            value={fields.phone}
            onChange={event => update("phone", event.target.value)}
            placeholder="۰۹۱۲******"
            disabled={busy}
          />
          <small className="org-field-help">
            اختیاری؛ شماره فقط برای تطبیق حساب تأییدشده حنا استفاده می‌شود و
            در رکورد سازمانی مشمول ذخیره نمی‌شود.
          </small>
        </label>
        <label>
          انتخاب طرح حمایتی هدف
          <select
            required
            value={fields.programId}
            onChange={event => update("programId", event.target.value)}
            disabled={busy || programs.length === 0}
          >
            {programs.length === 0
              ? <option value="">طرح ثبت‌شده یا فعال در دسترس نیست</option>
              : programs.map(program => (
                <option key={program.id} value={program.id}>
                  {program.name} — {organizationProgramStatusLabels[program.status]}
                </option>
              ))}
          </select>
        </label>
      </div>

      {feedback ? (
        <div
          className={`org-form-feedback org-form-feedback--${feedback.tone}`}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      ) : null}

      {created ? (
        <div className="org-recipient-created" role="status">
          <strong>{created.displayName}</strong>
          <span>شناسه ثبت‌شده: <bdi>{created.referenceMasked}</bdi></span>
          <span>
            وضعیت تطبیق: {organizationRecipientMatchLabels[created.matchStatus]}
          </span>
          <span>طرح: {created.program.name}</span>
        </div>
      ) : null}

      {needsReload ? (
        <button
          className="org-button org-register-reload"
          type="button"
          disabled={busy}
          onClick={() => window.location.reload()}
        >
          بارگذاری دوباره طرح‌های مجاز
        </button>
      ) : null}

      <div className="org-divider" />
      <div className="org-actions org-recipient-create-actions">
        {created ? (
          <>
            <Link className="org-button" href="/organization/people">
              بازگشت به لیست
            </Link>
            <button
              className="org-button org-button--primary"
              type="button"
              onClick={resetForAnother}
            >
              افزودن فرد دیگر
            </button>
          </>
        ) : (
          <>
            <Link className="org-button" href="/organization/people">
              انصراف
            </Link>
            <button
              className="org-button org-button--primary"
              type="submit"
              disabled={busy || programs.length === 0}
            >
              {busy ? "در حال افزودن..." : "افزودن فرد"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
