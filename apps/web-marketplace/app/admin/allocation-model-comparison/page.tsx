"use client";

import Link from "next/link";
import { useState } from "react";
import {
  parseAllocationModelComparisonSources,
  type AllocationComparisonEvidence,
  type AllocationModelComparison,
  type RegressionDiagnostics,
} from "../../lib/allocation-model-comparison";
import styles from "../admin/allocation-proposals/page.module.css";

const number = (value: number) =>
  value.toLocaleString("fa-IR", { maximumFractionDigits: 10 });

const family = (value: AllocationComparisonEvidence["kind"]) =>
  value === "PROFILE" ? "Profile Candidate" :
  value === "XGBOOST" ? "XGBoost Shadow" : "EBM Challenger";

const calibration = (metrics: RegressionDiagnostics | null) => {
  if (!metrics) return "در این protocol ثبت نشده";
  if (metrics.calibrationSlope === null || metrics.calibrationIntercept === null)
    return "تعریف‌نشده؛ variance پیش‌بینی صفر است";
  return `slope ${number(metrics.calibrationSlope)} · intercept ${number(metrics.calibrationIntercept)}`;
};

export default function AllocationModelComparisonPage() {
  const [input, setInput] = useState("");
  const [comparison, setComparison] = useState<AllocationModelComparison | null>(null);
  const [selected, setSelected] = useState<AllocationComparisonEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const fingerprint = input.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(fingerprint)) {
      setError("Evaluation fingerprint باید دقیقاً ۶۴ نویسه hexadecimal باشد.");
      setComparison(null);
      setSelected(null);
      return;
    }

    setLoading(true);
    setError("");
    setComparison(null);
    setSelected(null);
    try {
      const response = await fetch(
        `/api/admin/allocation-proposals/research/model-comparison?evaluationFingerprint=${encodeURIComponent(fingerprint)}`,
        { cache: "no-store" },
      );
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" &&
          "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "دریافت evidence مقایسه ممکن نشد.";
        throw new Error(message);
      }
      const parsed = parseAllocationModelComparisonSources(payload, fingerprint);
      if (!parsed) throw new Error("Evidence مقایسه قابل تأیید نیست.");
      setComparison(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت evidence مقایسه ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }

  const counts = comparison
    ? {
        profile: comparison.items.filter(x => x.kind === "PROFILE").length,
        xgboost: comparison.items.filter(x => x.kind === "XGBOOST").length,
        ebm: comparison.items.filter(x => x.kind === "EBM").length,
      }
    : null;

  return <main className={styles.page}>
    <header>
      <Link href="/admin/allocation-training-runs">سوابق آموزش</Link>
      <Link href="/admin/allocation-shadow-benchmarks">XGBoost Evidence</Link>
    </header>

    <h1>مقایسه Evidence مدل‌های تخصیص</h1>
    <aside className={styles.note}>
      این صفحه فقط evidence ثبت‌شده روی یک Evaluation fingerprint مشترک را کنار هم نشان می‌دهد.
      ترتیب نمایش زمانی است، نه رتبه‌بندی. هیچ Winner، Approval، Threshold، Pilot یا Runtime
      Activation در این صفحه ساخته نمی‌شود.
    </aside>

    <section className={styles.card}>
      <h2>Evaluation Set</h2>
      <label htmlFor="comparison-fingerprint">Evaluation fingerprint</label>
      <input
        id="comparison-fingerprint"
        dir="ltr"
        maxLength={64}
        value={input}
        disabled={loading}
        onChange={e => setInput(e.target.value)}
      />
      <button type="button" onClick={load} disabled={loading}>
        {loading ? "در حال دریافت…" : "نمایش مقایسه"}
      </button>
    </section>

    {error && <p role="alert" className={styles.error}>{error}</p>}

    {comparison && <>
      <section className={styles.card}>
        <h2>کنترل قابلیت مقایسه</h2>
        <p>
          Fingerprint: <span dir="ltr" className={styles.version}>
            {comparison.evaluationFingerprint}
          </span>
        </p>
        <p>
          Lineage: <b>{comparison.lineageAligned
            ? "هم‌راستا"
            : "ناهم‌راستا — evidenceها را مقایسه مستقیم تلقی نکنید"}</b>
        </p>
        {comparison.truncated &&
          <p className={styles.error}>
            حداقل یک خانواده بیش از ۲۰ رکورد دارد؛ این نما فقط ۲۰ رکورد اخیر آن خانواده را نشان می‌دهد.
          </p>}
        <p>
          Profile: {counts?.profile.toLocaleString("fa-IR")} · XGBoost:{" "}
          {counts?.xgboost.toLocaleString("fa-IR")} · EBM:{" "}
          {counts?.ebm.toLocaleString("fa-IR")}
        </p>
        <p>Winner: ندارد · Approved: خیر · Runtime applied: خیر</p>
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Evidence ثبت‌شده</h2>
          {!comparison.items.length
            ? <p>برای این Evaluation fingerprint هنوز evidence ثبت نشده است.</p>
            : <ul>{comparison.items.map(item =>
                <li key={`${item.kind}-${item.id}`}>
                  <button
                    type="button"
                    className={selected?.id === item.id && selected.kind === item.kind
                      ? styles.selected : ""}
                    onClick={() => setSelected(item)}
                  >
                    <b>{family(item.kind)}</b>
                    <span>{item.modelVersion}</span>
                    <small>{new Date(item.recordedAtUtc).toLocaleString("fa-IR")}</small>
                    <small>
                      Baseline MSE {number(item.baselineMse)} · Model MSE {number(item.modelMse)}
                    </small>
                  </button>
                </li>)}</ul>}
        </section>

        <section className={styles.card}>
          <h2>جزئیات Evidence</h2>
          {!selected ? <p>یک evidence را انتخاب کنید.</p> : <>
            <p>Family: <b>{family(selected.kind)}</b></p>
            <p>Evidence ID: <span dir="ltr">{selected.id}</span></p>
            <p>Protocol: {selected.protocolVersion}</p>
            <p>Model: {selected.modelVersion}</p>
            {selected.candidateVersion &&
              <p>Candidate: {selected.candidateVersion}</p>}
            {selected.artifactSha256 &&
              <p>Artifact SHA-256: <span dir="ltr">{selected.artifactSha256}</span></p>}
            <p>Baseline: {selected.baselineVersion}</p>
            <p>Dataset: {selected.datasetVersion}</p>
            <p>Funding instruction: {selected.sourceInstructionReference}</p>
            <p>Rubric: {selected.rubricVersion}</p>
            <p>Evaluation households: {selected.evaluationCount.toLocaleString("fa-IR")}</p>
            <p>Baseline MSE: {number(selected.baselineMse)}</p>
            <p>Model MSE: {number(selected.modelMse)}</p>
            <p>Model − Baseline MSE: {number(selected.modelMinusBaselineMse)}</p>
            {selected.modelDiagnostics ? <>
              <p>RMSE: {number(selected.modelDiagnostics.rmse)}</p>
              <p>MAE: {number(selected.modelDiagnostics.mae)}</p>
              <p>Mean residual: {number(selected.modelDiagnostics.meanResidual)}</p>
              <p>Mean prediction: {number(selected.modelDiagnostics.meanPrediction)}</p>
              <p>Mean observed: {number(selected.modelDiagnostics.meanObserved)}</p>
              <p>Calibration: {calibration(selected.modelDiagnostics)}</p>
            </> : <p>Diagnostics تکمیلی در این protocol تاریخی ثبت نشده است.</p>}
            <p>
              Runtime lineage: {selected.runtimeProposalId
                ? `proposal ${selected.runtimeProposalId}`
                : "baseline بدون proposal"}
              {" · "}sequence {selected.runtimeProfileSequence ?? "—"}
            </p>
            <p>Cutoff: {new Date(selected.cutoffUtc).toLocaleString("fa-IR")}</p>
            <p>Recorded: {new Date(selected.recordedAtUtc).toLocaleString("fa-IR")}</p>
          </>}
        </section>
      </div>
    </>}
  </main>;
}
