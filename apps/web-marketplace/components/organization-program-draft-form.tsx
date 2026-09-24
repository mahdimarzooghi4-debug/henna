"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationProgramDetail } from "../lib/organization-programs";

type DraftFields = {
  name: string;
  kind: string;
  beneficiarySource: "MANUAL" | "API" | "API_OR_MANUAL";
  description: string;
};

type Props =
  | { mode: "create"; defaultAllocationMethod: string }
  | {
      mode: "edit";
      defaultAllocationMethod: string;
      program: OrganizationProgramDetail;
    };

type Feedback =
  | { tone: "error" | "success" | "warn"; message: string }
  | null;

const sourceLabels = {
  MANUAL: "ورود دستی",
  API: "API / منبع داده سازمان",
  API_OR_MANUAL: "API / ورود دستی",
} as const;

function initialFields(props: Props): DraftFields {
  return props.mode === "edit"
    ? {
        name: props.program.name,
        kind: props.program.kind,
        beneficiarySource:
          props.program.beneficiarySource as DraftFields["beneficiarySource"],
        description: props.program.description ?? "",
      }
    : {
        name: "",
        kind: "",
        beneficiarySource: "API_OR_MANUAL",
        description: "",
      };
}

function valid(fields: DraftFields) {
  const control = /[\u0000-\u001f\u007f]/;
  return fields.name.trim().length > 0 &&
    fields.name.length <= 200 &&
    fields.kind.trim().length > 0 &&
    fields.kind.length <= 120 &&
    fields.description.length <= 2000 &&
    !control.test(fields.name) &&
    !control.test(fields.kind) &&
    !control.test(fields.description);
}

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

export function OrganizationProgramDraftForm(props: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<DraftFields>(() => initialFields(props));
  const [revision, setRevision] = useState(
    props.mode === "edit" ? props.program.revision : 0,
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const createAttempt = useRef<{ signature: string; key: string } | null>(null);

  function patch<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setFields(current => ({ ...current, [key]: value }));
    setFeedback(null);
    setConflictRevision(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!valid(fields)) {
      setFeedback({
        tone: "error",
        message: "نام، نوع طرح و توضیحات را با مقادیر معتبر تکمیل کنید.",
      });
      return;
    }

    const payload = {
      name: fields.name.trim(),
      kind: fields.kind.trim(),
      beneficiarySource: fields.beneficiarySource,
      description: fields.description.trim() || null,
    };
    setBusy(true);
    setFeedback(null);
    setConflictRevision(null);

    try {
      if (props.mode === "create") {
        const signature = JSON.stringify(payload);
        if (!createAttempt.current ||
          createAttempt.current.signature !== signature) {
          createAttempt.current = {
            signature,
            key: crypto.randomUUID(),
          };
        }

        const response = await fetch("/api/organization/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            idempotencyKey: createAttempt.current.key,
          }),
        });
        const body = await jsonBody(response);

        if (response.ok && typeof body.id === "string") {
          createAttempt.current = null;
          router.push("/organization/programs/" + body.id);
          router.refresh();
          return;
        }

        setFeedback({
          tone: response.status === 403 ? "warn" : "error",
          message: typeof body.message === "string"
            ? body.message
            : "ثبت پیش‌نویس تأیید نشد؛ دوباره تلاش کنید.",
        });
        return;
      }

      const response = await fetch(
        "/api/organization/programs/" + props.program.id,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, revision }),
        },
      );
      const body = await jsonBody(response);

      if (response.ok &&
        typeof body.revision === "number" &&
        Number.isSafeInteger(body.revision)) {
        setRevision(body.revision);
        setFeedback({
          tone: "success",
          message: "پیش‌نویس با موفقیت ذخیره شد.",
        });
        router.refresh();
        return;
      }

      if (response.status === 409) {
        const currentRevision =
          typeof body.currentRevision === "number" &&
          Number.isSafeInteger(body.currentRevision)
            ? body.currentRevision
            : null;
        setConflictRevision(currentRevision);
        setFeedback({
          tone: "warn",
          message: currentRevision
            ? `نسخه جدیدتری از طرح وجود دارد (نسخه ${currentRevision}). برای جلوگیری از بازنویسی تغییرات دیگران، نسخه جدید را بارگذاری کنید.`
            : "طرح دیگر با این نسخه قابل ویرایش نیست؛ نسخه جدید را بارگذاری کنید.",
        });
        return;
      }

      setFeedback({
        tone: response.status === 403 ? "warn" : "error",
        message: typeof body.message === "string"
          ? body.message
          : "ذخیره پیش‌نویس تأیید نشد؛ دوباره تلاش کنید.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "ارتباط با سرویس ثبت طرح برقرار نشد؛ دوباره تلاش کنید.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="org-draft-form" onSubmit={submit}>
      <div className="org-form-grid">
        <label>
          نوع اعتبار / برنامه
          <input
            name="kind"
            value={fields.kind}
            maxLength={120}
            required
            disabled={busy}
            onChange={event => patch("kind", event.target.value)}
            placeholder="مثال: برنامه رفاهی کارکنان"
          />
        </label>
        <label>
          نام طرح حمایتی
          <input
            name="name"
            value={fields.name}
            maxLength={200}
            required
            disabled={busy}
            onChange={event => patch("name", event.target.value)}
            placeholder="نام طرح سازمانی"
          />
        </label>
        <label>
          منبع افراد و مشمولان
          <select
            name="beneficiarySource"
            value={fields.beneficiarySource}
            disabled={busy}
            onChange={event => patch(
              "beneficiarySource",
              event.target.value as DraftFields["beneficiarySource"],
            )}
          >
            {Object.entries(sourceLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          روش تخصیص طرح
          <input
            value={props.defaultAllocationMethod}
            readOnly
            aria-readonly="true"
          />
        </label>
        <label className="org-span-2">
          توضیحات و اهداف طرح
          <textarea
            name="description"
            value={fields.description}
            maxLength={2000}
            disabled={busy}
            onChange={event => patch("description", event.target.value)}
            placeholder="شرح اهداف و اطلاعات تکمیلی طرح..."
          />
        </label>
      </div>

      {props.mode === "edit" ? (
        <div className="org-form-revision">
          نسخه فعلی فرم: <bdi>{revision}</bdi>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`org-form-feedback org-form-feedback--${feedback.tone}`}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="org-actions">
        <button
          className="org-button org-button--primary"
          type="submit"
          disabled={busy}
        >
          {busy
            ? "در حال ذخیره..."
            : props.mode === "create"
              ? "ثبت پیش‌نویس طرح"
              : "ذخیره تغییرات پیش‌نویس"}
        </button>
        {props.mode === "edit" && conflictRevision !== null ? (
          <button
            className="org-button"
            type="button"
            disabled={busy}
            onClick={() => {
              // A hard reload intentionally discards the stale local draft
              // only after the user explicitly chooses to load the server copy.
              window.location.reload();
            }}
          >
            بارگذاری نسخه جدید
          </button>
        ) : null}
      </div>
    </form>
  );
}
