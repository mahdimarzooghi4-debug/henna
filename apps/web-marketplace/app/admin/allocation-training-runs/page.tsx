"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseTrainingRuns, parseTrainingRunDetail, type TrainingRun, type TrainingRunDetail } from "../../../lib/allocation-training-runs";
import styles from "../allocation-proposals/page.module.css";
const status = (value: string) => value === "PROPOSED" ? "پیشنهاد ثبت‌شده" : "بدون بهبود کافی";
async function read(response: Response) {
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? "دریافت سابقه ممکن نشد.");
  return json;
}
export default function TrainingRunsPage() {
  const [items,setItems] = useState<TrainingRun[]>([]), [detail,setDetail] = useState<TrainingRunDetail | null>(null);
  const [page,setPage] = useState(1), [selected,setSelected] = useState<string | null>(null), [refresh,setRefresh] = useState(0);
  const [loading,setLoading] = useState(true), [detailLoading,setDetailLoading] = useState(false), [error,setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setItems([]);
    fetch(`/api/admin/allocation-proposals/research/runs?page=${page}`, { cache:"no-store",signal:controller.signal })
      .then(read).then(raw => { const result = parseTrainingRuns(raw); if (!result) throw new Error("گزارش معتبر نیست."); setItems(result); })
      .catch(e => { if (!controller.signal.aborted) { setError(e.message); setDetail(null); setSelected(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[page,refresh]);
  useEffect(() => {
    setDetail(null);
    if (!selected) { setDetailLoading(false); return; }
    const controller = new AbortController(); setDetailLoading(true); setError("");
    fetch(`/api/admin/allocation-proposals/research/runs/${selected}`, { cache:"no-store",signal:controller.signal })
      .then(read).then(raw => { const result = parseTrainingRunDetail(raw); if (!result) throw new Error("گزارش معتبر نیست."); setDetail(result); })
      .catch(e => { if (!controller.signal.aborted) { setError(e.message); setItems([]); } })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  },[selected,refresh]);
  return <main className={styles.page}>
    <header><Link href="/admin/allocation-training">آموزش آزمایشی</Link><Link href="/admin/allocation-proposals">بررسی پیشنهادها</Link></header>
    <h1>سوابق آموزش تخصیص</h1>
    <aside className={styles.note}>این فهرست اجراهای تکمیل‌شده را نشان می‌دهد. در صورت قطع ارتباط، پیش از تکرار آموزش نتیجه را اینجا بررسی کنید. نبودن سابقه به‌تنهایی ثابت نمی‌کند درخواست قبلی اجرا نشده است.</aside>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <button onClick={() => setRefresh(x=>x+1)} disabled={loading || detailLoading}>به‌روزرسانی سوابق</button>
    <div className={styles.grid}>
      <section className={styles.card}><h2>اجراهای تکمیل‌شده</h2>
        {loading ? <p role="status">در حال دریافت…</p> : !items.length && !error ? <p>هنوز اجرای تکمیل‌شده‌ای ثبت نشده است.</p> : null}
        <ul>{items.map(item => <li key={item.id}><button onClick={()=>setSelected(item.id)} className={selected === item.id ? styles.selected : ""}>
          <b>{status(item.status)}</b><span>{item.datasetVersion}</span><small>{new Date(item.recordedAtUtc).toLocaleString("fa-IR")}</small>
        </button></li>)}</ul>
        <nav><button disabled={page===1 || loading} onClick={()=>{setSelected(null);setPage(x=>x-1);}}>قبلی</button><span>صفحه {page}</span><button disabled={items.length<20 || loading || page>=10000} onClick={()=>{setSelected(null);setPage(x=>x+1);}}>بعدی</button></nav>
      </section>
      <section className={styles.card}><h2>گزارش اجرا</h2>
        {detailLoading ? <p role="status">در حال دریافت گزارش…</p> : !detail ? <p>یک اجرا را انتخاب کنید.</p> : <>
          <h3>{status(detail.status)}</h3><p className={styles.version} dir="ltr">{detail.id}</p>
          <p>مجموعه: {detail.datasetVersion}</p><p>مدل: {detail.modelVersion}</p><p>معیار: {detail.rubricVersion}</p><p>مرجع تأمین مالی: {detail.sourceInstructionReference}</p>
          <p>مبلغ شبیه‌سازی: {detail.poolRial.toLocaleString("fa-IR")} ریال</p>
          <p>آموزش: {detail.trainingCount.toLocaleString("fa-IR")} خانوار · ارزیابی: {detail.validationCount.toLocaleString("fa-IR")} خانوار</p>
          <p>آخرین زمان مجاز داده: {new Date(detail.cutoffUtc).toLocaleString("fa-IR")}</p>
          {detail.learningMetrics ? <p>خطای قبل: {detail.learningMetrics.BaselineValidationMse.toLocaleString("fa-IR",{maximumFractionDigits:8})} · خطای پیشنهاد: {detail.learningMetrics.CandidateValidationMse.toLocaleString("fa-IR",{maximumFractionDigits:8})}</p> : <p>بهبود کافی برای ساخت پیشنهاد مشاهده نشد؛ ضرایب تغییر نکرده‌اند.</p>}
          {detail.proposalId && <Link href={`/admin/allocation-proposals?proposal=${detail.proposalId}`}>بررسی پیشنهاد این اجرا</Link>}
        </>}
      </section>
    </div>
  </main>;
}
