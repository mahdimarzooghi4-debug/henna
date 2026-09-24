"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  organizationRecipientImportMaxFileBytes,
  type OrganizationRecipientImportError,
  type OrganizationRecipientImportSummary,
} from "../lib/organization-recipient-import";
import {
  organizationProgramStatusLabels,
  type OrganizationProgramSummary,
} from "../lib/organization-programs";

type Props = {
  programs: OrganizationProgramSummary[];
};

type Feedback = {
  tone: "error" | "warn" | "success";
  message: string;
} | null;

type Attempt = {
  file: File;
  programId: string;
  key: string;
};

async function readJson(
  response: Response,
): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object"
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} بایت`;
  return `${(bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0)} کیلوبایت`;
}

function extension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function parseClientErrors(
  value: unknown,
): OrganizationRecipientImportError[] {
  if (!value || typeof value !== "object") return [];
  const errors = (value as Record<string, unknown>).errors;
  if (!Array.isArray(errors)) return [];
  return errors.flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    return typeof item.row === "number" &&
      typeof item.field === "string" &&
      typeof item.code === "string" &&
      typeof item.message === "string"
      ? [{
          row: item.row,
          field: item.field,
          code: item.code as OrganizationRecipientImportError["code"],
          message: item.message,
        }]
      : [];
  });
}

function parseClientSummary(
  value: unknown,
): OrganizationRecipientImportSummary | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  return typeof data.importedCount === "number" &&
    typeof data.matchedCount === "number" &&
    typeof data.needsMatchCount === "number" &&
    data.atomic === true &&
    typeof data.importedAtUtc === "string"
    ? {
        importedCount: data.importedCount,
        matchedCount: data.matchedCount,
        needsMatchCount: data.needsMatchCount,
        atomic: true,
        importedAtUtc: data.importedAtUtc,
      }
    : null;
}

export function OrganizationRecipientBulkImportForm({ programs }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [programId, setProgramId] =
    useState(programs[0]?.id ?? "");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [errors, setErrors] =
    useState<OrganizationRecipientImportError[]>([]);
  const [summary, setSummary] =
    useState<OrganizationRecipientImportSummary | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const attempt = useRef<Attempt | null>(null);

  function resetOutcome() {
    setFeedback(null);
    setErrors([]);
    setSummary(null);
    setNeedsReload(false);
  }

  function chooseFile(next: File | null) {
    attempt.current = null;
    resetOutcome();

    if (!next) {
      setFile(null);
      return;
    }

    const ext = extension(next.name);
    if (ext !== ".csv" && ext !== ".xlsx") {
      setFile(null);
      setFeedback({
        tone: "error",
        message: "فقط فایل CSV یا XLSX قابل انتخاب است.",
      });
      return;
    }
    if (next.size <= 0 ||
      next.size > organizationRecipientImportMaxFileBytes) {
      setFile(null);
      setFeedback({
        tone: "error",
        message: "حجم فایل باید بیشتر از صفر و حداکثر ۲ مگابایت باشد.",
      });
      return;
    }

    setFile(next);
  }

  function changeProgram(next: string) {
    attempt.current = null;
    setProgramId(next);
    resetOutcome();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !file || !programId) return;

    if (!attempt.current ||
      attempt.current.file !== file ||
      attempt.current.programId !== programId) {
      attempt.current = {
        file,
        programId,
        key: crypto.randomUUID(),
      };
    }

    const body = new FormData();
    body.set("programId", programId);
    body.set("file", file, file.name);
    body.set("idempotencyKey", attempt.current.key);

    setBusy(true);
    resetOutcome();
    try {
      const response = await fetch(
        "/api/organization/recipients/import",
        { method: "POST", body },
      );
      const value = await readJson(response);

      if (response.status === 200 || response.status === 201) {
        const result = parseClientSummary(value);
        if (!result) {
          setFeedback({
            tone: "error",
            message: "پاسخ import قابل نمایش نیست؛ وضعیت را از لیست مشمولان بررسی کنید.",
          });
          return;
        }

        attempt.current = null;
        setSummary(result);
        setFeedback({
          tone: "success",
          message: response.status === 201
            ? "فایل به‌صورت کامل و یکپارچه import شد."
            : "این import قبلاً انجام شده بود؛ همان نتیجه با موفقیت بازیابی شد.",
        });
        return;
      }

      const rowErrors = parseClientErrors(value);
      if ((response.status === 422 || response.status === 409) &&
        rowErrors.length > 0) {
        setErrors(rowErrors);
        setFeedback({
          tone: response.status === 422 ? "error" : "warn",
          message: response.status === 422
            ? "فایل import نشد. خطاهای ردیفی را اصلاح کنید؛ هیچ ردیفی ثبت نشده است."
            : "به‌دلیل تعارض با داده موجود، هیچ ردیفی از فایل ثبت نشده است.",
        });
        return;
      }

      const currentStatus =
        typeof value.currentStatus === "string"
          ? value.currentStatus
          : null;
      if (response.status === 404 || currentStatus) {
        setNeedsReload(true);
        setFeedback({
          tone: "warn",
          message: response.status === 404
            ? "طرح انتخاب‌شده دیگر در دسترس نیست."
            : "وضعیت طرح انتخاب‌شده تغییر کرده و import جدید ممکن نیست.",
        });
        return;
      }

      setFeedback({
        tone: response.status === 403 ? "warn" : "error",
        message: typeof value.message === "string"
          ? value.message
          : "import مشمولان تأیید نشد؛ دوباره تلاش کنید.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "ارتباط با سرویس import برقرار نشد. تلاش مجدد همین فایل را با همان کلید امن تکرار می‌کند.",
      });
    } finally {
      setBusy(false);
    }
  }

  function resetForAnother() {
    attempt.current = null;
    setFile(null);
    resetOutcome();
  }

  return (
    <form className="org-bulk-import-form" onSubmit={submit}>
      <div className="org-form-head">
        <h2>ثبت گروهی افراد (فایل اکسل / CSV)</h2>
        <p>
          افزودن لیست مشمولان با قالب استاندارد حنا؛ import به‌صورت
          یکپارچه انجام می‌شود و وجود هر خطا مانع ثبت کل فایل است.
        </p>
      </div>
      <div className="org-divider" />

      <label
        className={
          `org-dropzone org-bulk-dropzone${dragging ? " org-bulk-dropzone--active" : ""}`
        }
        onDragEnter={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={event => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          chooseFile(event.dataTransfer.files.item(0));
        }}
      >
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={event => chooseFile(event.target.files?.[0] ?? null)}
          disabled={busy}
        />
        <img
          className="org-bulk-upload-icon"
          src="/organization-upload.png"
          width={32}
          height={32}
          alt=""
        />
        <strong>
          فایل اکسل یا CSV را به اینجا بکشید یا انتخاب کنید
        </strong>
        <span>
          قالب ستون‌ها: نام، شناسه موردنیاز، شماره همراه در صورت نیاز
        </span>
        <small>حداکثر ۲ مگابایت و ۵۰۰ ردیف داده</small>
      </label>

      {file ? (
        <div className="org-bulk-selected-file">
          <span>
            <strong>{file.name}</strong>
            <small>{formatSize(file.size)}</small>
          </span>
          <button
            type="button"
            className="org-button"
            onClick={() => chooseFile(null)}
            disabled={busy}
          >
            حذف فایل
          </button>
        </div>
      ) : null}

      <label className="org-bulk-program">
        طرح حمایتی هدف
        <select
          required
          value={programId}
          disabled={busy || programs.length === 0}
          onChange={event => changeProgram(event.target.value)}
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

      {feedback ? (
        <div
          className={`org-form-feedback org-form-feedback--${feedback.tone}`}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="org-bulk-errors" role="region" aria-label="خطاهای فایل import">
          <strong>خطاهای فایل</strong>
          <div className="org-bulk-error-list">
            {errors.map((item, index) => (
              <div className="org-bulk-error-row" key={`${item.row}-${item.field}-${item.code}-${index}`}>
                <span>{item.row > 0 ? `ردیف ${item.row}` : "فایل"}</span>
                <bdi>{item.code}</bdi>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="org-bulk-summary" role="status">
          <strong>{summary.importedCount} مشمول ثبت شد</strong>
          <span>{summary.matchedCount} حساب حنا شناسایی شد</span>
          <span>{summary.needsMatchCount} مورد نیازمند تطبیق است</span>
          <small>ثبت فایل اتمیک بوده و همه ردیف‌ها با هم commit شده‌اند.</small>
        </div>
      ) : null}

      {needsReload ? (
        <button
          className="org-button org-register-reload"
          type="button"
          onClick={() => window.location.reload()}
          disabled={busy}
        >
          بارگذاری دوباره طرح‌های مجاز
        </button>
      ) : null}

      <div className="org-actions org-bulk-actions">
        {summary ? (
          <>
            <Link className="org-button" href="/organization/people">
              مشاهده لیست مشمولان
            </Link>
            <button
              className="org-button org-button--primary"
              type="button"
              onClick={resetForAnother}
            >
              import فایل دیگر
            </button>
          </>
        ) : (
          <>
            <a
              className="org-button"
              href="/api/organization/recipients/import"
              download="hana-recipient-import-template.csv"
            >
              دانلود نمونه قالب فایل
            </a>
            <button
              className="org-button org-button--primary"
              type="submit"
              disabled={busy || !file || !programId}
            >
              {busy ? "در حال import..." : "افزودن گروهی"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
