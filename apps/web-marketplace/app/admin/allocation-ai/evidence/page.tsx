"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  parseSevenFactorInventory, parseSevenFactorPreview,
  type SevenFactorEvidenceInventory, type SevenFactorEvidencePreview,
} from "../../../lib/seven-factor-evidence";
import styles from "./page.module.css";

const endpoint = "/api/admin/allocation-proposals/research/seven-factor/review-inventory";
const errorText = async (res: Response) => {
  const x: unknown = await res.json().catch(() => null);
  return x && typeof x === "object" && "message" in x &&
    typeof x.message === "string" ? x.message : "دریافت شواهد ممکن نشد.";
};
export default function SevenFactorEvidencePage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SevenFactorEvidenceInventory | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [cutoff, setCutoff] = useState("");
  const [preview, setPreview] = useState<SevenFactorEvidencePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setData(null); setChosen([]); setPreview(null); setError("");
    try {
      const res = await fetch(endpoint + "?page=" + page, { cache: "no-store", signal });
      if (!res.ok) throw new Error(await errorText(res));
      const parsed = parseSevenFactorInventory(await res.json());
      if (!parsed) throw new Error("ساختار دفتر شواهد قابل تأیید نیست.");
      if (!signal.aborted) setData(parsed);
    } catch (e) {
      if (!signal.aborted) setError(e instanceof Error ? e.message : "خطای دریافت شواهد");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const select = (id: string, checked: boolean) => {
    setPreview(null);
    setChosen(old => checked ? [...old, id] : old.filter(x => x !== id));
  };

  async function checkEvidence() {
    if (!data || chosen.length === 0 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(cutoff) ||
      Number.isNaN(Date.parse(cutoff)) || Date.parse(cutoff) > Date.now()) {
      setError("حداقل یک شواهد و زمان دقیق معتبر UTC انتخاب شود.");
      return;
    }
    setBusy(true); setPreview(null); setError("");
    try {
      const res = await fetch(endpoint + "/preview", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewIds: chosen, cutoffUtc: cutoff }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      const result = parseSevenFactorPreview(await res.json());
      if (!result || result.reviewedHouseholdCount !== chosen.length || result.cutoffUtc !== cutoff)
        throw new Error("شواهد انتخاب‌شده با پیش‌نمایش معتبر هم‌خوان نیستند.");
      setPreview(result);
    } catch (e) { setError(e instanceof Error ? e.message : "پیش‌نمایش ناموفق"); }
    finally { setBusy(false); }
  }

  return (
    <main className={styles.page} dir="rtl">
      <nav className={styles.nav} aria-label="مسیر راهبری">
        <Link href="/admin/allocation-ai">فضای کاری هوش حنا</Link>
        <span aria-hidden="true"> / </span><span aria-current="page">شواهد هفت‌عاملی</span>
      </nav>
      <h1>دفتر شواهد هفت‌عاملی v1.1</h1>
      <p className={styles.lede}>این صفحه داده‌های ثبت‌شده واقعی و بازبینی انسانی را از بک‌اند مجاز می‌خواند.
        انتخاب چند شواهد صرفاً یک <strong>پیش‌نمایش فقط‌خواندنی</strong> و اثرانگشت نسخه‌دار ایجاد می‌کند.
        نتیجه مجوز آموزش، Dataset، انتخاب مدل یا تخصیص اعتبار نیست.</p>
      <div className={styles.status} role="note">
        وضعیت: <strong>REVIEW ONLY — NOT ADMITTED</strong> ·
        شش‌عاملی و هفت‌عاملی در یک مجموعه آموزشی ادغام نمی‌شوند.
        وجود مرجع سند به‌تنهایی اصالت سند را اثبات نمی‌کند.
      </div>
      <section className={styles.panel} aria-labelledby="records-title">
        <div className={styles.header}>
          <h2 id="records-title">بازبینی‌های ثبت‌شده</h2>
          <div className={styles.pager}>
            <button disabled={page === 1 || loading || busy} onClick={() => setPage(p => p - 1)}>قبلی</button>
            <span>صفحه {page.toLocaleString("fa-IR")}</span>
            <button disabled={!data?.hasMore || loading || busy} onClick={() => setPage(p => p + 1)}>بعدی</button>
          </div>
        </div>
        {loading && <p role="status">در حال دریافت شواهد…</p>}
        {!loading && data?.items.length === 0 && <p>در این صفحه هیچ بازبینی ثبت‌شده‌ای وجود ندارد. این به معنی نبود داده در صفحات دیگر یا تأیید داده نیست.</p>}
        {data && <div className={styles.rows}>
          {data.items.map(item => (
            <label key={item.id} className={styles.row}>
              <input type="checkbox" checked={chosen.includes(item.id)}
                onChange={e => select(item.id, e.target.checked)} disabled={busy}/>
              <span className={styles.rowInfo}><span dir="ltr">{item.id}</span>
                <small>بازبینی: {new Date(item.reviewedAtUtc).toLocaleString("fa-IR")}</small>
              </span>
              <span className={styles.label}>{item.hasQualitativeReview ? "قضاوت کیفی ثبت شده" : "قضاوت کیفی ثبت نشده"}</span>
            </label>
          ))}
        </div>}
      </section>
      <section className={styles.panel} aria-labelledby="manifest-title">
        <h2 id="manifest-title">پیش‌نمایش شواهد انتخاب‌شده</h2>
        <p>انتخاب‌های این صفحه: {chosen.length.toLocaleString("fa-IR")} مورد. شواهد ناسازگار، تکراری یا فاقد نسب‌نامه معتبر در بک‌اند رد می‌شوند.</p>
        <label htmlFor="cutoff" className={styles.fieldLabel}>زمان برش UTC (نمونه: 2026-10-09T12:00:00.000Z)</label>
        <div className={styles.actions}>
          <input id="cutoff" dir="ltr" value={cutoff}
            onChange={e => { setCutoff(e.target.value); setPreview(null); }} placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"/>
          <button type="button" disabled={busy} onClick={() => { setCutoff(new Date().toISOString()); setPreview(null); }}>
            تنظیم برش روی اکنون UTC
          </button>
          <button type="button" disabled={busy || loading || !data || chosen.length === 0} onClick={() => void checkEvidence()}>
            {busy ? "در حال بررسی…" : "بررسی نسب‌نامه و ساخت اثرانگشت"}
          </button>
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {preview && <div className={styles.result} role="status">
          <h3>پیش‌نمایش معتبر شواهد — بدون پذیرش Dataset</h3>
          <p>تعداد خانوار بررسی‌شده: {preview.reviewedHouseholdCount.toLocaleString("fa-IR")}</p>
          <p>نسخه مبنا: {preview.sourceFormulaVersion} · مجموعه: {preview.sourceDatasetVersion}</p>
          <p>دستور تأمین مالی: {preview.sourceInstructionReference}</p>
          <p>اثر انگشت SHA-256:</p>
          <code dir="ltr">{preview.sha256}</code>
          <p><strong>{preview.admissionStatus}</strong></p>
        </div>}
      </section>
      <p className={styles.footer}>گام بعدی نیازمند تأیید قرارداد کامل Rubric، اصالت شواهد، قواعد اصلاح/اختلاف،
        کفایت داده، عدالت، تفکیک مستقل آموزش/اعتبارسنجی/ارزیابی و تصمیم انسانی است.
        این صفحه هیچ فرمانی برای آموزش یا فعال‌سازی Production ندارد.</p>
      <Link href="/admin/allocation-model-comparison">مقایسه فقط‌خواندنی XGBoost، EBM و مدل پایه ←</Link>
    </main>
  );
}
