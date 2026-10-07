"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  parseAllocationOutcomeResult,
  parseAllocationOutcomes,
  parseOutcomeAssessmentOptions,
  type AllocationOutcomeAssessmentOption,
  type AllocationOutcomeRecord,
} from "../../../lib/allocation-outcomes";
import {
  allocationOutcomeDetails,
  clearAllocationOutcomeIntent,
  createAllocationOutcomeIntent,
  persistAllocationOutcomeIntent,
  restoreAllocationOutcomeIntent,
  type AllocationOutcomeIntent,
} from "../../../lib/web-pending-allocation-outcome";
import styles from "../allocation-proposals/page.module.css";

class RequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

const barrierText = (value: boolean | null) =>
  value === null ? "نامشخص" : value ? "مشاهده شد" : "مشاهده نشد";
const evidenceText = (value: number) =>
  value === 1 ? "داده اداری" :
  value === 2 ? "گزارش خانوار" : "بازبینی انسانی";

async function fetchAssessments(page: number) {
  const response = await fetch(
    "/api/admin/allocation-proposals/research/assessments?page=" + page,
    { cache: "no-store" },
  );
  const payload = await readJson(response);
  if (!response.ok)
    throw new RequestError("دریافت snapshotها ممکن نشد.", response.status);
  const parsed = parseOutcomeAssessmentOptions(payload);
  if (!parsed)
    throw new RequestError("پاسخ snapshotها قابل تأیید نیست.", 503);
  return parsed;
}

async function fetchOutcomes(page: number) {
  const response = await fetch(
    "/api/admin/allocation-proposals/research/outcomes?page=" + page,
    { cache: "no-store" },
  );
  const payload = await readJson(response);
  if (!response.ok)
    throw new RequestError("دریافت outcomeها ممکن نشد.", response.status);
  const parsed = parseAllocationOutcomes(payload);
  if (!parsed)
    throw new RequestError("پاسخ outcomeها قابل تأیید نیست.", 503);
  return parsed;
}

async function sendOutcome(intent: AllocationOutcomeIntent) {
  const response = await fetch(
    "/api/admin/allocation-proposals/research/outcomes",
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: intent.body,
    },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    const message = payload && typeof payload === "object" &&
      "message" in payload && typeof payload.message === "string"
      ? payload.message : "ثبت outcome ممکن نشد.";
    throw new RequestError(message, response.status);
  }
  const parsed = parseAllocationOutcomeResult(payload);
  if (!parsed)
    throw new RequestError("پاسخ ثبت outcome قابل تأیید نیست.", 503);
  return parsed;
}

export default function AllocationOutcomesPage() {
  const [assessments, setAssessments] =
    useState<AllocationOutcomeAssessmentOption[]>([]);
  const [assessmentPage, setAssessmentPage] = useState(1);
  const [outcomes, setOutcomes] = useState<AllocationOutcomeRecord[]>([]);
  const [outcomePage, setOutcomePage] = useState(1);
  const [snapshotId, setSnapshotId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [coverage, setCoverage] = useState("");
  const [stock, setStock] = useState("");
  const [delivery, setDelivery] = useState("");
  const [access, setAccess] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] =
    useState<AllocationOutcomeIntent | null>(null);
  const [storageFailure, setStorageFailure] = useState<string | null>(null);

  useEffect(() => {
    try {
      const restored = restoreAllocationOutcomeIntent();
      if (!restored) return;
      setPending(restored);
      setNotice(
        "نتیجه ثبت یک outcome قطعی نیست. فقط همان EventId و همان بدنه برای تکرار امن بازیابی شده است.",
      );
    } catch {
      setStorageFailure(
        "وضعیت retry امن outcome قابل اعتماد نیست. ثبت جدید متوقف شد.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAssessments(assessmentPage)
      .then(result => {
        if (active) setAssessments(result.items);
      })
      .catch(e => {
        if (active) {
          setAssessments([]);
          setError(e instanceof Error ? e.message :
            "دریافت snapshotها ممکن نشد.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [assessmentPage]);

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    fetchOutcomes(outcomePage)
      .then(result => {
        if (active) setOutcomes(result.items);
      })
      .catch(e => {
        if (active) {
          setOutcomes([]);
          setError(e instanceof Error ? e.message :
            "دریافت outcomeها ممکن نشد.");
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => { active = false; };
  }, [outcomePage]);

  async function perform(intent: AllocationOutcomeIntent) {
    const details = allocationOutcomeDetails(intent);
    if (!details) {
      setStorageFailure("درخواست outcome ذخیره‌شده معتبر نیست.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await sendOutcome(intent);
      if (!clearAllocationOutcomeIntent(details.eventId)) {
        setStorageFailure(
          "پاسخ outcome دریافت شد، اما پاک‌سازی retry محلی تأیید نشد. ثبت جدید متوقف است.",
        );
        return;
      }
      setPending(null);
      setSnapshotId("");
      setPeriodStart("");
      setPeriodEnd("");
      setCoverage("");
      setStock("");
      setDelivery("");
      setAccess("");
      setEvidenceReference("");
      setNotice(result.replayed
        ? "همان outcome قبلی با همان EventId تأیید شد؛ رکورد جدیدی ساخته نشد."
        : "Outcome بازبینی‌شده ثبت شد. این مشاهده به‌تنهایی label یا تصمیم تخصیص ایجاد نمی‌کند.");
      setOutcomePage(1);
      const history = await fetchOutcomes(1);
      setOutcomes(history.items);
    } catch (e) {
      if (e instanceof RequestError && e.status === 503) {
        setPending(intent);
        setNotice(
          "نتیجه ثبت outcome قطعی نیست. درخواست جدید نسازید؛ فقط همین EventId و بدنه را تکرار کنید.",
        );
      } else {
        if (!clearAllocationOutcomeIntent(details.eventId)) {
          setStorageFailure(
            "نتیجه سرور قطعی است، اما پاک‌سازی retry محلی تأیید نشد. ثبت جدید متوقف است.",
          );
          return;
        }
        setPending(null);
        setError(e instanceof Error ? e.message : "ثبت outcome ممکن نشد.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (pending || storageFailure) return;
    const assessment = assessments.find(x => x.id === snapshotId);
    if (!assessment || !assessment.trainingEligible) {
      setError("فقط snapshot first-party با lineage معتبر قابل انتخاب است.");
      return;
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    if (!periodStart || !periodEnd ||
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime()) ||
        startDate.getTime() < Date.parse(assessment.assessedAtUtc)) {
      setError("بازه مشاهده باید معتبر و پس از زمان assessment باشد.");
      return;
    }

    const booleanValue = (value: string): boolean | null =>
      value === "" ? null : value === "true";

    let intent: AllocationOutcomeIntent;
    try {
      intent = createAllocationOutcomeIntent({
        snapshotId,
        periodStartUtc: startDate.toISOString(),
        periodEndUtc: endDate.toISOString(),
        essentialNeedsCoverage:
          coverage === "" ? null : Number(coverage),
        stockBarrier: booleanValue(stock),
        deliveryBarrier: booleanValue(delivery),
        accessBarrier: booleanValue(access),
        evidenceReference,
      });
      persistAllocationOutcomeIntent(intent);
    } catch {
      setError(
        "حداقل یک outcome صریح، بازه تکمیل‌شده و مرجع evidence معتبر لازم است.",
      );
      return;
    }
    setPending(intent);
    await perform(intent);
  }

  const pendingDetails = pending ? allocationOutcomeDetails(pending) : null;

  return <main className={styles.page}>
    <header>
      <Link href="/admin/allocation-training">امتیازدهی و آموزش</Link>
      <Link href="/auth">ورود</Link>
    </header>
    <h1>Outcomeهای غیرمالی تخصیص</h1>
    <aside className={styles.note}>
      این صفحه فقط مشاهده‌های بازبینی‌شده و مستند را ثبت می‌کند.
      مقدار نامشخص باید نامشخص بماند؛ صفر یا false به‌صورت پیش‌فرض ساخته
      نمی‌شود. ثبت Outcome به‌تنهایی Need Label، eligibility، تغییر وزن یا
      فعال‌سازی مدل ایجاد نمی‌کند.
    </aside>

    {storageFailure &&
      <p role="alert" className={styles.error}>{storageFailure}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status">{notice}</p>}

    {pending && pendingDetails && !storageFailure &&
      <section className={styles.card}>
        <h2>درخواست با نتیجه نامشخص</h2>
        <p>EventId: <b dir="ltr" className={styles.version}>
          {pendingDetails.eventId}
        </b></p>
        <p>Evidence: {pendingDetails.evidenceReference}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void perform(pending)}
        >
          {busy ? "در حال تکرار امن…" : "تکرار امن همان Outcome"}
        </button>
      </section>}

    <section className={styles.card}>
      <h2>ثبت مشاهده بازبینی‌شده</h2>
      <label htmlFor="outcome-snapshot">snapshot تخصیص</label>
      <select
        id="outcome-snapshot"
        value={snapshotId}
        disabled={busy || pending !== null || storageFailure !== null}
        onChange={e => setSnapshotId(e.target.value)}
      >
        <option value="">انتخاب کنید</option>
        {assessments.map((item, index) =>
          <option
            key={item.id}
            value={item.id}
            disabled={!item.trainingEligible}
          >
            ردیف {index + 1} · {item.datasetVersion} ·
            {" "}{item.trainingEligible
              ? "first-party / lineage معتبر"
              : "غیرمجاز برای outcome رسمی"}
          </option>)}
      </select>
      {loading && <p role="status">در حال دریافت snapshotها…</p>}
      <nav>
        <button
          type="button"
          disabled={loading || assessmentPage === 1}
          onClick={() => setAssessmentPage(p => p - 1)}
        >قبلی</button>
        <span>صفحه {assessmentPage}</span>
        <button
          type="button"
          disabled={loading || assessments.length < 20 ||
            assessmentPage >= 10000}
          onClick={() => setAssessmentPage(p => p + 1)}
        >بعدی</button>
      </nav>

      <label htmlFor="outcome-start">شروع بازه مشاهده</label>
      <input
        id="outcome-start"
        type="datetime-local"
        value={periodStart}
        disabled={busy || pending !== null || storageFailure !== null}
        onChange={e => setPeriodStart(e.target.value)}
      />
      <label htmlFor="outcome-end">پایان بازه مشاهده</label>
      <input
        id="outcome-end"
        type="datetime-local"
        value={periodEnd}
        disabled={busy || pending !== null || storageFailure !== null}
        onChange={e => setPeriodEnd(e.target.value)}
      />

      <label htmlFor="outcome-coverage">
        پوشش نیازهای ضروری، صفر تا یک — اختیاری
      </label>
      <input
        id="outcome-coverage"
        type="number"
        min="0"
        max="1"
        step="0.001"
        value={coverage}
        disabled={busy || pending !== null || storageFailure !== null}
        onChange={e => setCoverage(e.target.value)}
      />

      {[
        ["stock", "مانع موجودی", stock, setStock],
        ["delivery", "مانع تحویل", delivery, setDelivery],
        ["access", "مانع دسترسی", access, setAccess],
      ].map(([id, label, value, setter]) =>
        <div key={String(id)}>
          <label htmlFor={"outcome-" + id}>{String(label)}</label>
          <select
            id={"outcome-" + id}
            value={String(value)}
            disabled={busy || pending !== null || storageFailure !== null}
            onChange={e =>
              (setter as React.Dispatch<React.SetStateAction<string>>)(
                e.target.value,
              )}
          >
            <option value="">نامشخص</option>
            <option value="true">مشاهده شد</option>
            <option value="false">مشاهده نشد</option>
          </select>
        </div>)}

      <label htmlFor="outcome-evidence">مرجع evidence بازبینی‌شده</label>
      <textarea
        id="outcome-evidence"
        maxLength={240}
        rows={3}
        value={evidenceReference}
        disabled={busy || pending !== null || storageFailure !== null}
        onChange={e => setEvidenceReference(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || pending !== null || storageFailure !== null ||
          !snapshotId || !periodStart || !periodEnd ||
          !evidenceReference.trim() ||
          (coverage === "" && stock === "" &&
           delivery === "" && access === "")}
        onClick={() => void start()}
      >
        {busy ? "در حال ثبت…" : "ثبت Outcome مستند"}
      </button>
    </section>

    <section className={styles.card}>
      <h2>سابقه Outcomeها</h2>
      {historyLoading && <p role="status">در حال دریافت سابقه…</p>}
      {!historyLoading && outcomes.length === 0 &&
        <p>Outcome ثبت‌شده‌ای در این صفحه وجود ندارد.</p>}
      {outcomes.length > 0 && <div className={styles.table}>
        <table>
          <thead><tr>
            <th>پایان بازه</th>
            <th>نوع evidence</th>
            <th>مصرف اعتبار</th>
            <th>پوشش ضروری</th>
            <th>موجودی</th>
            <th>تحویل</th>
            <th>دسترسی</th>
            <th>مرجع</th>
          </tr></thead>
          <tbody>{outcomes.map(item => <tr key={item.id}>
            <td dir="ltr">{item.periodEndUtc}</td>
            <td>{evidenceText(item.evidence)}</td>
            <td>{item.creditUsedRial === null
              ? "—" : item.creditUsedRial.toLocaleString("fa-IR")}</td>
            <td>{item.essentialNeedsCoverage === null
              ? "—" : item.essentialNeedsCoverage.toLocaleString(
                "fa-IR", { maximumFractionDigits: 3 })}</td>
            <td>{barrierText(item.stockBarrier)}</td>
            <td>{barrierText(item.deliveryBarrier)}</td>
            <td>{barrierText(item.accessBarrier)}</td>
            <td>{item.evidenceReference ?? "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <nav>
        <button
          type="button"
          disabled={historyLoading || outcomePage === 1}
          onClick={() => setOutcomePage(p => p - 1)}
        >قبلی</button>
        <span>صفحه {outcomePage}</span>
        <button
          type="button"
          disabled={historyLoading || outcomes.length < 20 ||
            outcomePage >= 10000}
          onClick={() => setOutcomePage(p => p + 1)}
        >بعدی</button>
      </nav>
    </section>
  </main>;
}
