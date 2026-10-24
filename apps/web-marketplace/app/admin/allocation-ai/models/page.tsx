"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { parseModelArtifactInventory, type ArtifactEvidenceItem,
  type ModelArtifactInventory } from "../../../../lib/model-artifact-inventory";
import styles from "../evidence/page.module.css";
import { parseModelArtifactDossier, type ModelArtifactDossier } from "../../../../lib/model-artifact-dossier";
import { parseModelVersionTechnicalPreflight, type ModelVersionTechnicalPreflight } from "../../../../lib/model-version-technical-preflight";

const endpoint = "/api/admin/allocation-proposals/research/model-artifacts";
const errorBody = async (response: Response) => {
  const raw: unknown = await response.json().catch(() => null);
  return raw && typeof raw === "object" && "message" in raw &&
    typeof raw.message === "string" ? raw.message : "دریافت دفتر ممکن نشد.";
};
function Records({ title, rows, family, inspect }: {
  title: string; rows: ArtifactEvidenceItem[]; family: "XGBOOST" | "EBM";
  inspect: (family: "XGBOOST" | "EBM", id: string) => void;
}) {
  return <section className={styles.panel}>
    <h2>{title}</h2>
    {rows.length === 0 && <p>برای این صفحه اثری ثبت نشده است.</p>}
    <div className={styles.rows}>
      {rows.map(item => <article key={item.artifactId} className={styles.row}>
        <div className={styles.rowInfo}>
          <strong dir="ltr">{item.modelVersion}</strong>
          <small>نسخه مجموعه: {item.datasetVersion} · قالب: {item.artifactFormat}</small>
          <small>Training Run: <code dir="ltr">{item.trainingRunId}</code></small>
          <small>شناسه اثر: <code dir="ltr">{item.artifactId}</code></small>
          <small>اثر انگشت ذخیره‌شده: <code dir="ltr">{item.artifactSha256}</code></small>
          <small>ثبت: {new Date(item.recordedAtUtc).toLocaleString("fa-IR")}</small>
          <small>سوابق ارزیابی مستقل با همین اثر: {item.evaluationCount.toLocaleString("fa-IR")}</small>
          <button type="button" onClick={() => inspect(family, item.artifactId)}>
            مشاهده پرونده شواهد این نسخه
          </button>
          <small><strong>{item.artifactVerified
            ? "SHA-256 بایت‌های ذخیره‌شده مطابق است (نه تأیید مدل)"
            : "عدم تطابق یا نبود بایت اثر — فاقد تأیید یکپارچگی"}</strong></small>
        </div>
      </article>)}
    </div>
  </section>;
}
export default function ModelArtifactEvidencePage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ModelArtifactInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dossier, setDossier] = useState<ModelArtifactDossier | null>(null);
  const [dossierBusy, setDossierBusy] = useState(false);
  const [dossierError, setDossierError] = useState("");
  const dossierSequence = useRef(0);
  const technicalSequence = useRef(0);
  const [technical, setTechnical] = useState<ModelVersionTechnicalPreflight | null>(null);
  const [technicalBusy, setTechnicalBusy] = useState(false);
  const [technicalError, setTechnicalError] = useState("");
  async function inspectVersion(evaluationId: string) {
    if (!dossier || technicalBusy) return;
    const selection = {
      family: dossier.family, artifactId: dossier.artifactId, evaluationId,
    };
    const requestSeq = ++technicalSequence.current;
    setTechnical(null); setTechnicalError(""); setTechnicalBusy(true);
    try {
      const response = await fetch(
        "/api/admin/allocation-proposals/research/model-version-technical-preflight", {
          method: "POST", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selection),
        });
      if (!response.ok) throw new Error(await errorBody(response));
      const parsed = parseModelVersionTechnicalPreflight(
        await response.json(), selection);
      const matchingEvidence = dossier.evaluations.find(e => e.id === evaluationId);
      if (!parsed || !matchingEvidence ||
          parsed.evaluationFingerprint !== matchingEvidence.evaluationFingerprint ||
          parsed.trainingRunId !== dossier.trainingRunId ||
          parsed.artifactSha256 !== dossier.artifactSha256 ||
          parsed.modelVersion !== dossier.modelVersion ||
          parsed.datasetVersion !== dossier.datasetVersion)
        throw new Error("پیش‌بررسی فنی با پرونده انتخاب‌شده منطبق نیست.");
      if (requestSeq === technicalSequence.current) setTechnical(parsed);
    } catch (e) {
      if (requestSeq === technicalSequence.current)
        setTechnicalError(e instanceof Error ? e.message : "خطای پیش‌بررسی");
    } finally {
      if (requestSeq === technicalSequence.current) setTechnicalBusy(false);
    }
  }
  async function inspect(family: "XGBOOST" | "EBM", id: string) {
    const requestSequence = ++dossierSequence.current;
    ++technicalSequence.current;
    setTechnical(null); setTechnicalBusy(false); setTechnicalError("");
    setDossier(null); setDossierError(""); setDossierBusy(true);
    try {
      const res = await fetch("/api/admin/allocation-proposals/research/model-artifact-evidence?" +
        new URLSearchParams({ family, artifactId: id }), { cache: "no-store" });
      if (!res.ok) throw new Error(await errorBody(res));
      const parsed = parseModelArtifactDossier(await res.json(), family, id);
      if (!parsed) throw new Error("پرونده با اثر انتخاب‌شده مطابقت ندارد.");
      if (requestSequence === dossierSequence.current) setDossier(parsed);
    } catch (e) {
      if (requestSequence === dossierSequence.current)
        setDossierError(e instanceof Error ? e.message : "خطای بررسی پرونده");
    } finally {
      if (requestSequence === dossierSequence.current) setDossierBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    ++dossierSequence.current;
    ++technicalSequence.current;
    setTechnical(null); setTechnicalBusy(false); setTechnicalError("");
    setDossierBusy(false);
    setLoading(true); setData(null); setError(""); setDossier(null); setDossierError("");
    fetch(endpoint + "?page=" + page, { cache: "no-store", signal: controller.signal })
      .then(async res => {
        if (!res.ok) throw new Error(await errorBody(res));
        const parsed = parseModelArtifactInventory(await res.json());
        if (!parsed || parsed.page !== page) throw new Error("پاسخ دفتر قابل تأیید نیست.");
        return parsed;
      })
      .then(parsed => { if (!controller.signal.aborted) setData(parsed); })
      .catch(err => { if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : "خطای دریافت"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { ++dossierSequence.current; ++technicalSequence.current; controller.abort(); };
  }, [page]);
  return <main className={styles.page} dir="rtl">
    <nav className={styles.nav} aria-label="مسیر راهبری">
      <Link href="/admin/allocation-ai">هوش حنا</Link> /
      <span aria-current="page">آثار مدل‌های پژوهشی</span>
    </nav>
    <h1>دفتر آثار واقعی مدل‌های داخلی</h1>
    <p className={styles.lede}>این دفتر از PostgreSQL می‌خواند و انطباق
      اثرانگشت SHA-256 با بایت‌های ذخیره‌شده را بررسی می‌کند. وجود اثر یا سابقه
      ارزیابی مستقل، کیفیت مدل یا اجازه بهره‌برداری را اثبات نمی‌کند.</p>
    <div className={styles.status} role="note">
      فقط‌خواندنی · NOT ADMITTED · فاقد Model Registry پذیرفته‌شده، ثبت نسخه جدید،
      انتخاب خودکار مدل، پایلوت یا تغییر Runtime. مسیر هفت‌عاملی هنوز Dataset مصوب ندارد.
    </div>
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2>سوابق ذخیره‌شده</h2>
        <div className={styles.pager}>
          <button disabled={loading || page === 1} onClick={() => setPage(v => v - 1)}>قبلی</button>
          <span>صفحه {page.toLocaleString("fa-IR")}</span>
          <button disabled={loading || !data ||
            (!data.xgboostHasMore && !data.ebmHasMore)}
            onClick={() => setPage(v => v + 1)}>بعدی</button>
        </div>
      </div>
      {loading && <p role="status">در حال دریافت دفتر…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
    {data && <>
      <Records title="XGBoost — آثار آموزش آزمایشی" rows={data.xgboostItems} family="XGBOOST" inspect={inspect}/>
      <Records title="EBM — آثار رقیب پژوهشی" rows={data.ebmItems} family="EBM" inspect={inspect}/>
    </>}
    {dossierBusy && <p role="status">در حال خواندن پرونده…</p>}
    {dossierError && <p role="alert" className={styles.error}>{dossierError}</p>}
    {dossier && <section className={styles.panel} aria-label="پرونده شواهد مدل">
      <h2>پرونده فقط‌خواندنی {dossier.family}</h2>
      <p>نسخه: {dossier.modelVersion} · Training Run: <code dir="ltr">{dossier.trainingRunId}</code></p>
      <p>اثر: <code dir="ltr">{dossier.artifactId}</code> · تطبیق بایت‌های ذخیره‌شده: SHA-256</p>
      <p>تعداد سوابق ارزیابی مستقل: {dossier.evaluations.length.toLocaleString("fa-IR")}</p>
      {dossier.evaluations.length === 0 && <p>ارزیابی مستقلی برای این اثر ثبت نشده است.</p>}
      <div className={styles.rows}>
        {dossier.evaluations.map(entry => <article className={styles.row} key={entry.id}>
          <div className={styles.rowInfo}>
            <small>شناسه ارزیابی: <code dir="ltr">{entry.id}</code></small>
            <small>Protocol: {entry.protocolVersion}</small>
            <small>Evaluation fingerprint: <code dir="ltr">{entry.evaluationFingerprint}</code></small>
            <small>Dataset: {entry.datasetVersion} · Cutoff: {new Date(entry.cutoffUtc).toLocaleString("fa-IR")}</small>
            <button type="button" disabled={technicalBusy}
              onClick={() => void inspectVersion(entry.id)}>
              پیش‌بررسی فنی همین نسخه و ارزیابی
            </button>
          </div>
        </article>)}
      </div>
      <p><strong>{dossier.evidenceStatus}</strong> — شواهد به‌معنای پذیرش مدل نیست.</p>
    </section>}
{technicalBusy && <p role="status">در حال پیش‌بررسی فنی…</p>}
    {technicalError && <p role="alert" className={styles.error}>{technicalError}</p>}
    {technical && <section className={styles.panel} aria-label="نتیجه پیش‌بررسی فنی">
      <h2>پیش‌بررسی فنی — بدون پذیرش یا فعال‌سازی</h2>
      <p>مدل: {technical.modelVersion} · ارزیابی انتخابی: <code dir="ltr">{technical.evaluationId}</code></p>
      <p>اثر انگشت ارزیابی: <code dir="ltr">{technical.evaluationFingerprint}</code></p>
      <p>وضعیت قرارداد موجود: <strong>{technical.technicalStatus}</strong></p>
      <p>بنیاد اجرای موجود: {technical.existingExecutionFoundationVersion ?? "فقط پژوهشی؛ بدون قرارداد اجرایی Production"}</p>
      <p>هش اثر با بایت‌های ذخیره‌شده مطابق است و شناسه رکورد ارزیابی پیوند دارد؛ اما اصالت مستقل ارزیابی اثبات نشده است. ثبت نسخه، پذیرش Dataset، انتخاب مدل،
        پایلوت و فعال‌سازی Runtime همچنان ممنوع و نیازمند تصمیم انسانی و قرارداد مصوب‌اند.</p>
    </section>}
    <p className={styles.footer}>تطبیق بایت و هش فقط یک کنترل یکپارچگی است، نه
      راستی‌آزمایی اصالت اسناد، استقلال Dataset، کفایت آماری، عدالت یا تأیید Production.
      ثبت نسخه سازگار و هرگونه ارتقا نیازمند قرارداد مستقل مصوب و تصمیم انسانی است.</p>
    <Link href="/admin/allocation-model-comparison">مقایسه ارزیابی مدل‌ها ←</Link>
  </main>;
}
