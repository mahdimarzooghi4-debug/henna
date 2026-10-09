"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  parseAllocationRetentionEvents,
  parseAllocationRetentionPreview,
  parseAllocationRetentionResult,
  type AllocationRetentionEvent,
  type AllocationRetentionPreview,
} from "../../../lib/allocation-retention";
import {
  allocationRetentionDetails,
  clearAllocationRetentionIntent,
  createAllocationRetentionIntent,
  persistAllocationRetentionIntent,
  restoreAllocationRetentionIntent,
  type AllocationRetentionIntent,
} from "../../../lib/web-pending-allocation-retention";
import styles from "../allocation-proposals/page.module.css";

class RequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

async function fetchPreview(cutoffUtc: string) {
  const response = await fetch(
    "/api/admin/allocation-proposals/research/retention/preview?cutoffUtc=" +
      encodeURIComponent(cutoffUtc),
    { cache: "no-store" },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    const message = payload && typeof payload === "object" &&
      "message" in payload && typeof payload.message === "string"
      ? payload.message : "پیش‌نمایش retention ممکن نشد.";
    throw new RequestError(message, response.status);
  }
  const parsed = parseAllocationRetentionPreview(payload);
  if (!parsed)
    throw new RequestError("پاسخ پیش‌نمایش retention قابل تأیید نیست.", 503);
  return parsed;
}

async function fetchEvents(page: number) {
  const response = await fetch(
    "/api/admin/allocation-proposals/research/retention/events?page=" + page,
    { cache: "no-store" },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    const message = payload && typeof payload === "object" &&
      "message" in payload && typeof payload.message === "string"
      ? payload.message : "دریافت سابقه retention ممکن نشد.";
    throw new RequestError(message, response.status);
  }
  const parsed = parseAllocationRetentionEvents(payload);
  if (!parsed)
    throw new RequestError("پاسخ سابقه retention قابل تأیید نیست.", 503);
  return parsed;
}

async function sendPurge(intent: AllocationRetentionIntent) {
  const response = await fetch(
    "/api/admin/allocation-proposals/research/retention/purge",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": intent.key,
      },
      body: intent.body,
    },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    const message = payload && typeof payload === "object" &&
      "message" in payload && typeof payload.message === "string"
      ? payload.message : "اجرای retention ممکن نشد.";
    throw new RequestError(message, response.status);
  }
  const parsed = parseAllocationRetentionResult(payload);
  if (!parsed)
    throw new RequestError("پاسخ اجرای retention قابل تأیید نیست.", 503);
  return parsed;
}

export default function AllocationRetentionPage() {
  const [cutoff, setCutoff] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] =
    useState<AllocationRetentionPreview | null>(null);
  const [events, setEvents] = useState<AllocationRetentionEvent[]>([]);
  const [eventsPage, setEventsPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [eventsBusy, setEventsBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] =
    useState<AllocationRetentionIntent | null>(null);
  const [storageFailure, setStorageFailure] = useState<string | null>(null);

  useEffect(() => {
    try {
      const restored = restoreAllocationRetentionIntent();
      if (!restored) return;
      setPending(restored);
      setNotice(
        "نتیجه یک حذف retention قطعی نیست. همان cutoff، digest، دلیل، بدنه و کلید برای تکرار امن بازیابی شد.",
      );
    } catch {
      setStorageFailure(
        "وضعیت retry امن retention قابل اعتماد نیست. Preview جدید یا حذف جدید متوقف شد.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    setEventsBusy(true);
    fetchEvents(eventsPage)
      .then(data => {
        if (active) setEvents(data.items);
      })
      .catch(e => {
        if (active) {
          setEvents([]);
          setError(e instanceof Error
            ? e.message : "دریافت سابقه retention ممکن نشد.");
        }
      })
      .finally(() => {
        if (active) setEventsBusy(false);
      });
    return () => { active = false; };
  }, [eventsPage]);

  async function loadPreview() {
    if (pending || storageFailure) return;
    setBusy(true);
    setError("");
    setNotice("");
    setConfirmed(false);
    setPreview(null);
    try {
      const parsedDate = new Date(cutoff);
      if (!cutoff || Number.isNaN(parsedDate.getTime())) {
        setError("تاریخ و ساعت cutoff معتبر لازم است.");
        return;
      }
      const data = await fetchPreview(parsedDate.toISOString());
      setPreview(data);
      setNotice(data.selectedSnapshotCount === 0
        ? "در این cutoff هیچ رکورد پژوهشی واجد شرایط حذف نیست."
        : "پیش‌نمایش آماده است. قبل از حذف، تعدادها و digest را بررسی کنید.");
    } catch (e) {
      setError(e instanceof Error
        ? e.message : "پیش‌نمایش retention ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }

  async function performPurge(intent: AllocationRetentionIntent) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await sendPurge(intent);
      if (!clearAllocationRetentionIntent(intent.key)) {
        setStorageFailure(
          "پاسخ حذف دریافت شد، اما پاک‌سازی retry محلی تأیید نشد. عملیات جدید متوقف است.",
        );
        return;
      }
      setPending(null);
      setPreview(null);
      setConfirmed(false);
      setReason("");
      setNotice(
        "Retention اجرا و audit شد: " +
        result.deletedSnapshotCount +
        " snapshot و " +
        result.deletedOutcomeCount +
        " outcome حذف شد.",
      );
      setEventsPage(1);
      const history = await fetchEvents(1);
      setEvents(history.items);
    } catch (e) {
      if (e instanceof RequestError && e.status === 503) {
        setPending(intent);
        setNotice(
          "نتیجه retention قطعی نیست. فقط همان درخواست ذخیره‌شده را تکرار کنید؛ درخواست جدید مجاز نیست.",
        );
      } else {
        if (!clearAllocationRetentionIntent(intent.key)) {
          setStorageFailure(
            "نتیجه سرور قطعی است، اما پاک‌سازی retry retention تأیید نشد. عملیات جدید متوقف است.",
          );
          return;
        }
        setPending(null);
        setPreview(null);
        setConfirmed(false);
        setError(e instanceof Error ? e.message : "اجرای retention ممکن نشد.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function startPurge() {
    if (!preview || pending || storageFailure ||
        preview.selectedSnapshotCount < 1 || !confirmed)
      return;

    let intent: AllocationRetentionIntent;
    try {
      intent = createAllocationRetentionIntent(
        preview.cutoffUtc,
        preview.previewDigest,
        reason,
      );
      persistAllocationRetentionIntent(intent);
    } catch {
      setStorageFailure(
        "ذخیره retry امن retention تأیید نشد؛ هیچ حذف جدیدی به سرور ارسال نشد.",
      );
      return;
    }
    setPending(intent);
    await performPurge(intent);
  }

  const pendingDetails = pending
    ? allocationRetentionDetails(pending)
    : null;

  return <main className={styles.page}>
    <header>
      <Link href="/admin/allocation-training">امتیازدهی و آموزش</Link>
      <Link href="/auth">ورود</Link>
    </header>
    <h1>Retention داده‌های پژوهشی تخصیص</h1>
    <aside className={styles.note}>
      این ابزار فقط برای داده‌های منتسبِ پژوهشی است. حنا هیچ مدت نگهداری
      پیش‌فرضی تعیین نمی‌کند. snapshotهای first-party، داده‌های دارای label،
      training، proposal یا runtime lineage از این purge خارج‌اند. ابتدا
      Preview بگیرید و سپس فقط همان digest را با دلیل صریح تأیید کنید.
    </aside>

    {storageFailure &&
      <p role="alert" className={styles.error}>{storageFailure}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status">{notice}</p>}

    {pending && !storageFailure && pendingDetails &&
      <section className={styles.card}>
        <h2>درخواست حذف با نتیجه نامشخص</h2>
        <p>
          cutoff: <b dir="ltr" className={styles.version}>
            {pendingDetails.cutoffUtc}
          </b>
        </p>
        <p>
          digest: <b dir="ltr" className={styles.version}>
            {pendingDetails.previewDigest}
          </b>
        </p>
        <p>دلیل ثبت‌شده: {pendingDetails.reason}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void performPurge(pending)}
        >
          {busy ? "در حال تکرار امن…" : "تکرار امن همان حذف قبلی"}
        </button>
      </section>}

    <section className={styles.card}>
      <h2>۱. پیش‌نمایش رکوردهای واجد شرایط</h2>
      <label htmlFor="retention-cutoff">cutoff صریح</label>
      <input
        id="retention-cutoff"
        type="datetime-local"
        value={cutoff}
        disabled={busy || pending !== null || storageFailure !== null}
        onChange={e => {
          setCutoff(e.target.value);
          setPreview(null);
          setConfirmed(false);
        }}
      />
      <p>
        زمان واردشده با منطقه زمانی دستگاه شما تفسیر و به UTC تبدیل می‌شود.
        هیچ cutoff خودکاری انتخاب نمی‌شود.
      </p>
      <button
        type="button"
        disabled={busy || pending !== null ||
          storageFailure !== null || !cutoff}
        onClick={() => void loadPreview()}
      >
        {busy ? "در حال بررسی…" : "گرفتن Preview"}
      </button>
    </section>

    {preview && <section className={styles.card}>
      <h2>۲. بررسی Preview و تأیید حذف</h2>
      <dl className={styles.weights}>
        <div><dt>کل واجد شرایط</dt>
          <dd>{preview.totalEligibleSnapshotCount}</dd></div>
        <div><dt>snapshot این batch</dt>
          <dd>{preview.selectedSnapshotCount}</dd></div>
        <div><dt>outcome وابسته</dt>
          <dd>{preview.selectedOutcomeCount}</dd></div>
      </dl>
      {preview.truncated &&
        <p className={styles.error}>
          بیش از ۵۰۰۰ snapshot واجد شرایط است. این درخواست فقط batch
          نمایش‌داده‌شده را حذف می‌کند؛ برای batch بعدی باید Preview جدید
          بگیرید.
        </p>}
      <p>
        cutoff UTC: <b dir="ltr" className={styles.version}>
          {preview.cutoffUtc}
        </b>
      </p>
      <p>
        Preview digest: <b dir="ltr" className={styles.version}>
          {preview.previewDigest}
        </b>
      </p>
      <label htmlFor="retention-reason">دلیل مصوب حذف</label>
      <textarea
        id="retention-reason"
        maxLength={2000}
        rows={4}
        value={reason}
        disabled={busy || pending !== null || storageFailure !== null}
        onChange={e => setReason(e.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy || pending !== null ||
            storageFailure !== null ||
            preview.selectedSnapshotCount < 1}
          onChange={e => setConfirmed(e.target.checked)}
        />
        تعدادها، cutoff و digest بالا را بررسی کرده‌ام و حذف همین batch
        پژوهشی را تأیید می‌کنم.
      </label>
      <button
        type="button"
        disabled={busy || pending !== null || storageFailure !== null ||
          preview.selectedSnapshotCount < 1 ||
          !confirmed || !reason.trim()}
        onClick={() => void startPurge()}
      >
        {busy ? "در حال اجرای retention…" : "حذف batch پژوهشی و ثبت audit"}
      </button>
    </section>}

    <section className={styles.card}>
      <h2>سابقهٔ Audit Retention</h2>
      {eventsBusy && <p>در حال دریافت سابقه…</p>}
      {!eventsBusy && events.length === 0 &&
        <p>سابقه retention در این صفحه وجود ندارد.</p>}
      {events.length > 0 && <div className={styles.table}>
        <table>
          <thead><tr>
            <th>زمان اجرا</th>
            <th>cutoff</th>
            <th>snapshot</th>
            <th>outcome</th>
            <th>مدیر</th>
            <th>دلیل</th>
          </tr></thead>
          <tbody>{events.map(event => <tr key={event.id}>
            <td dir="ltr">{event.recordedAtUtc}</td>
            <td dir="ltr">{event.cutoffUtc}</td>
            <td>{event.deletedSnapshotCount}</td>
            <td>{event.deletedOutcomeCount}</td>
            <td dir="ltr">{event.actorAccountId}</td>
            <td>{event.reason}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <nav>
        <button
          type="button"
          disabled={eventsBusy || eventsPage === 1}
          onClick={() => setEventsPage(page => page - 1)}
        >
          قبلی
        </button>
        <span>صفحه {eventsPage}</span>
        <button
          type="button"
          disabled={eventsBusy || events.length < 20 || eventsPage >= 10000}
          onClick={() => setEventsPage(page => page + 1)}
        >
          بعدی
        </button>
      </nav>
    </section>
  </main>;
}
