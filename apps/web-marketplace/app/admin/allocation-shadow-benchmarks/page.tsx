"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  parseAllocationShadowBenchmarks,
  type AllocationShadowBenchmark,
} from "../../../lib/allocation-shadow-benchmarks";
import styles from "../allocation-proposals/page.module.css";

async function load(page: number, fingerprint: string) {
  const query = new URLSearchParams({ page: String(page) });
  if (fingerprint) query.set("evaluationFingerprint", fingerprint);
  const response = await fetch(
    `/api/admin/allocation-proposals/research/shadow-benchmarks?${query}`,
    { cache: "no-store" },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" &&
      "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "دریافت benchmark ممکن نشد.";
    throw new Error(message);
  }
  const parsed = parseAllocationShadowBenchmarks(payload);
  if (!parsed) throw new Error("پاسخ benchmark قابل تأیید نیست.");
  return parsed.items;
}

const mse = (value: number) =>
  value.toLocaleString("fa-IR", { maximumFractionDigits: 10 });

export default function AllocationShadowBenchmarksPage() {
  const [items, setItems] = useState<AllocationShadowBenchmark[]>([]);
  const [selected, setSelected] = useState<AllocationShadowBenchmark | null>(null);
  const [page, setPage] = useState(1);
  const [filterInput, setFilterInput] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    setSelected(null);
    load(page, fingerprint)
      .then(rows => { if (active) setItems(rows); })
      .catch(e => {
        if (active)
          setError(e instanceof Error ? e.message : "دریافت benchmark ممکن نشد.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, fingerprint, refresh]);

  function applyFilter() {
    const value = filterInput.trim().toLowerCase();
    if (value && !/^[0-9a-f]{64}$/.test(value)) {
      setError("Evaluation fingerprint باید دقیقاً ۶۴ نویسه hexadecimal باشد.");
      return;
    }
    setError("");
    setPage(1);
    setFingerprint(value);
  }

  return <main className={styles.page}>
    <header>
      <Link href="/admin/allocation-training-runs">سوابق آموزش</Link>
      <Link href="/admin/allocation-training">آموزش آزمایشی</Link>
    </header>
    <h1>Evidence ارزیابی مستقل XGBoost Shadow</h1>
    <aside className={styles.note}>
      این صفحه فقط evidence ثبت‌شده ADR-051 را نمایش می‌دهد. Baseline MSE،
      Shadow MSE و اختلاف آن‌ها نتیجه اندازه‌گیری‌اند، نه انتخاب برنده یا
      مجوز Production. این نما هیچ Proposal، Approval، Pilot یا Runtime
      Activation ایجاد نمی‌کند.
    </aside>

    {error && <p role="alert" className={styles.error}>{error}</p>}

    <section className={styles.card}>
      <h2>جست‌وجوی evidence</h2>
      <label htmlFor="shadow-fingerprint">Evaluation fingerprint — اختیاری</label>
      <input
        id="shadow-fingerprint"
        dir="ltr"
        maxLength={64}
        value={filterInput}
        disabled={loading}
        onChange={e => setFilterInput(e.target.value)}
      />
      <button type="button" disabled={loading} onClick={applyFilter}>
        اعمال فیلتر
      </button>
      {fingerprint &&
        <button type="button" disabled={loading} onClick={() => {
          setFilterInput("");
          setFingerprint("");
          setPage(1);
        }}>پاک‌کردن فیلتر</button>}
      <button
        type="button"
        disabled={loading}
        onClick={() => setRefresh(value => value + 1)}
      >به‌روزرسانی</button>
    </section>

    <div className={styles.grid}>
      <section className={styles.card}>
        <h2>Benchmarkهای ثبت‌شده</h2>
        {loading && <p role="status">در حال دریافت…</p>}
        {!loading && !items.length && !error &&
          <p>Benchmark ثبت‌شده‌ای در این صفحه وجود ندارد.</p>}
        <ul>{items.map(item =>
          <li key={item.id}>
            <button
              type="button"
              className={selected?.id === item.id ? styles.selected : ""}
              onClick={() => setSelected(item)}
            >
              <b>{item.modelVersion}</b>
              <span>{new Date(item.recordedAtUtc).toLocaleString("fa-IR")}</span>
              <small>
                Baseline {mse(item.metrics.baselineMse)} · Shadow{" "}
                {mse(item.metrics.shadowMse)}
              </small>
            </button>
          </li>)}</ul>
        <nav>
          <button
            type="button"
            disabled={loading || page === 1}
            onClick={() => setPage(value => value - 1)}
          >قبلی</button>
          <span>صفحه {page}</span>
          <button
            type="button"
            disabled={loading || items.length < 20 || page >= 10000}
            onClick={() => setPage(value => value + 1)}
          >بعدی</button>
        </nav>
      </section>

      <section className={styles.card}>
        <h2>بررسی Evidence</h2>
        {!selected ? <p>یک benchmark را انتخاب کنید.</p> : <>
          <p>Benchmark ID: <b dir="ltr" className={styles.version}>
            {selected.id}
          </b></p>
          <p>Training Run: <span dir="ltr">{selected.trainingRunId}</span></p>
          <p>Protocol: {selected.protocolVersion}</p>
          <p>Model: {selected.modelVersion}</p>
          <p>Artifact SHA-256: <span dir="ltr">{selected.artifactSha256}</span></p>
          <p>Baseline: {selected.baselineVersion}</p>
          <p>Dataset: {selected.datasetVersion}</p>
          <p>Funding instruction: {selected.sourceInstructionReference}</p>
          <p>Rubric: {selected.metrics.rubricVersion}</p>
          <p>Evaluation households:{" "}
            {selected.metrics.evaluationCount.toLocaleString("fa-IR")}</p>
          <p>Baseline MSE: {mse(selected.metrics.baselineMse)}</p>
          <p>Shadow XGBoost MSE: {mse(selected.metrics.shadowMse)}</p>
          <p>Shadow − Baseline MSE:{" "}
            {mse(selected.metrics.shadowMinusBaselineMse)}</p>
          <p>Evaluation fingerprint:{" "}
            <span dir="ltr">{selected.evaluationFingerprint}</span></p>
          <p>Cutoff: {new Date(selected.cutoffUtc).toLocaleString("fa-IR")}</p>
          <p>Recorded:{" "}
            {new Date(selected.recordedAtUtc).toLocaleString("fa-IR")}</p>
          <p>Runtime lineage: {selected.runtimeProposalId
            ? `proposal ${selected.runtimeProposalId}`
            : "baseline بدون proposal"}
            {" · "}sequence {selected.runtimeProfileSequence ?? "—"}
          </p>
          <p>
            Winner: ندارد · Approved: خیر · Runtime applied: خیر
          </p>
        </>}
      </section>
    </div>
  </main>;
}
