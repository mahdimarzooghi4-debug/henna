"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseModelArtifactInventory, type ArtifactEvidenceItem,
  type ModelArtifactInventory } from "../../../../lib/model-artifact-inventory";
import styles from "../evidence/page.module.css";
import { parseModelArtifactDossier, type ModelArtifactDossier } from "../../../../lib/model-artifact-dossier";

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
  async function inspect(family: "XGBOOST" | "EBM", id: string) {
    setDossier(null); setDossierError(""); setDossierBusy(true);
    try {
      const res = await fetch("/api/admin/allocation-proposals/research/model-artifact-evidence?" +
        new URLSearchParams({ family, artifactId: id }), { cache: "no-store" });
      if (!res.ok) throw new Error(await errorBody(res));
      const parsed = parseModelArtifactDossier(await res.json(), family, id);
      if (!parsed) throw new Error("پرونده با اثر انتخاب‌شده مطابقت ندارد.");
      setDossier(parsed);
    } catch (e) {
      setDossierError(e instanceof Error ? e.message : "خطای بررسی پرونده");
    } finally { setDossierBusy(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
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
    return () => controller.abort();
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
          </div>
        </article>)}
      </div>
      <p><strong>{dossier.evidenceStatus}</strong> — شواهد به‌معنای پذیرش مدل نیست.</p>
    </section>}
    <p className={styles.footer}>تطبیق بایت و هش فقط یک کنترل یکپارچگی است، نه
      راستی‌آزمایی اصالت اسناد، استقلال Dataset، کفایت آماری، عدالت یا تأیید Production.
      ثبت نسخه سازگار و هرگونه ارتقا نیازمند قرارداد مستقل مصوب و تصمیم انسانی است.</p>
    <Link href="/admin/allocation-model-comparison">مقایسه ارزیابی مدل‌ها ←</Link>
  </main>;
}
