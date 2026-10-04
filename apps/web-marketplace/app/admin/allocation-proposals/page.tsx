"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseProposalDetail, parseProposalList, type ProposalDetail, type ProposalItem } from "../../../lib/allocation-proposals";
import styles from "./page.module.css";

const labels: Record<string, string> = { PENDING_REVIEW: "در انتظار بررسی", APPROVED: "تأییدشده", REJECTED: "ردشده" };
const fields: Record<string, string> = { Health: "سلامت و درمان", Hardship: "فشار معیشتی", Age: "سن و وابستگی", Size: "اندازه خانوار", Care: "مراقبت و حمایت", Education: "تحصیلات" };
const number = (n: number, maximumFractionDigits = 2) => n.toLocaleString("fa-IR", { maximumFractionDigits });
class AccessError extends Error { constructor(message: string, public status: number) { super(message); } }
async function read(response: Response) {
  const json: unknown = await response.json();
  if (!response.ok) throw new AccessError(json && typeof json === "object" && "message" in json ? String(json.message) : "دریافت اطلاعات ممکن نشد.", response.status);
  return json;
}

export default function AllocationProposalsPage() {
  const [items, setItems] = useState<ProposalItem[]>([]), [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProposalDetail | null>(null), [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(true), [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(""), [reason, setReason] = useState(""), [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0), [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setListLoading(true); setError("");
    fetch(`/api/admin/allocation-proposals?page=${page}`, { cache: "no-store", signal: controller.signal })
      .then(read).then(raw => { const parsed = parseProposalList(raw); if (!parsed) throw new Error("پاسخ معتبر نیست."); setItems(parsed); })
      .catch((e: Error) => { if (!controller.signal.aborted) { setError(e.message); setItems([]); setDetail(null); setSelected(null); } })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [page, refresh]);
  useEffect(() => {
    if (!selected) { setDetail(null); setDetailLoading(false); return; }
    const controller = new AbortController(); setDetail(null); setDetailLoading(true); setReason("");
    fetch(`/api/admin/allocation-proposals/${selected}`, { cache: "no-store", signal: controller.signal })
      .then(read).then(raw => { const parsed = parseProposalDetail(raw); if (!parsed) throw new Error("پاسخ معتبر نیست."); setDetail(parsed); })
      .catch((e: Error) => { if (!controller.signal.aborted) { setError(e.message); if (e instanceof AccessError && [401, 403].includes(e.status)) setItems([]); } })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selected, refresh]);
  async function review(decision: "APPROVED" | "REJECTED") {
    if (!detail || busy || !reason.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await read(await fetch(`/api/admin/allocation-proposals/${detail.id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, reason: reason.trim() }) }));
      setNotice("تصمیم ثبت شد. ضرایب روی تخصیص واقعی فعال نشده‌اند."); setRefresh(r => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت تصمیم ممکن نشد.");
      if (e instanceof AccessError && [401, 403].includes(e.status)) { setItems([]); setDetail(null); setSelected(null); }
      if (e instanceof AccessError && e.status === 409) { setDetail(null); setSelected(null); }
    } finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <header><Link href="/">حنا</Link><Link href="/auth">ورود به حنا</Link></header>
    <h1>بررسی پیشنهادهای تخصیص</h1>
    <Link href="/admin/allocation-training">ثبت امتیاز نیاز و آموزش آزمایشی</Link>
    <p className={styles.intro}>گزارش پیشنهاد و نتیجه آموزش را بررسی کنید و دلیل تصمیم خود را ثبت کنید.</p>
    <aside className={styles.note}>این بخش آزمایشی است. تأیید پیشنهاد به معنی فعال‌شدن آن روی اعتبار خانوارها نیست.</aside>
    {error && <div role="alert" className={styles.error}>{error}<button onClick={() => setRefresh(r => r + 1)} disabled={busy}>تلاش دوباره</button></div>}
    {notice && <p role="status">{notice}</p>}
    <div className={styles.grid}>
      <section className={styles.card} aria-label="فهرست پیشنهادها">
        <h2>پیشنهادها</h2>
        {listLoading ? <p role="status">در حال دریافت…</p> : items.length === 0 && !error ? <p>هنوز پیشنهادی ثبت نشده است.</p> : null}
        <ul>{items.map(item => <li key={item.id}><button className={selected === item.id ? styles.selected : ""}
          disabled={busy} onClick={() => { setSelected(item.id); setError(""); setNotice(""); }}>
          <b dir="ltr">{item.candidateVersion}</b><span>{labels[item.decision ?? "PENDING_REVIEW"]}</span>
          <small>{new Date(item.createdAtUtc).toLocaleDateString("fa-IR")}</small>
        </button></li>)}</ul>
        <nav aria-label="صفحه‌بندی"><button disabled={page === 1 || listLoading || busy} onClick={() => { setSelected(null); setPage(p => p - 1); }}>قبلی</button>
          <span>صفحه {number(page)}</span><button disabled={items.length < 20 || listLoading || busy || page >= 10000} onClick={() => { setSelected(null); setPage(p => p + 1); }}>بعدی</button></nav>
      </section>
      <section className={styles.card} aria-label="گزارش پیشنهاد">
        {detailLoading ? <p role="status">در حال دریافت گزارش…</p> : !detail ? <p>یک پیشنهاد را برای بررسی انتخاب کنید.</p> : <>
          <h2>گزارش پیشنهاد <span className={styles.badge}>{labels[detail.status]}</span></h2>
          <p dir="ltr" className={styles.version}>{detail.candidateVersion}</p><p>{detail.rationale}</p>
          <h3>ضرایب پیشنهادی</h3><dl className={styles.weights}>{Object.entries(fields).map(([key, name]) => <div key={key}><dt>{name}</dt><dd>{number(detail.weights[key] * 100)}٪</dd></div>)}</dl>
          {detail.metrics && <section><h3>نتیجه ارزیابی آموزش</h3><p>آموزش: {number(detail.metrics.TrainingCount)} خانوار · ارزیابی: {number(detail.metrics.ValidationCount)} خانوار</p>
            <p>خطای قبل: {number(detail.metrics.BaselineValidationMse, 8)} · خطای پیشنهاد: {number(detail.metrics.CandidateValidationMse, 8)}</p></section>}
          <h3>مقایسه سهم‌ها در شبیه‌سازی</h3><p>مبلغ‌ها به ریال و پیش از گردکردن هستند.</p>
          <div className={styles.table}><table><thead><tr><th>ردیف خانوار</th><th>فرمول فعلی</th><th>پیشنهاد</th><th>تغییر</th></tr></thead><tbody>
            {detail.rows.map((row, i) => <tr key={row.HouseholdKey ?? i}><td>{number(i + 1)}</td><td>{number(row.BaselineAmountRial)}</td><td>{number(row.ProposedAmountRial)}</td><td dir="ltr">{number(row.ProposedAmountRial - row.BaselineAmountRial)}</td></tr>)}
          </tbody></table></div>
          {detail.status === "PENDING_REVIEW" ? <form onSubmit={e => e.preventDefault()}>
            <label htmlFor="review-reason">دلیل تصمیم</label><textarea id="review-reason" value={reason} onChange={e => setReason(e.target.value)} required maxLength={2000} disabled={busy} rows={4}/>
            <p>بررسی باید توسط مدیری غیر از پیشنهاددهنده انجام شود.</p>
            <div className={styles.actions}><button type="button" disabled={busy || !reason.trim()} onClick={() => review("APPROVED")}>{busy ? "در حال ثبت…" : "تأیید پیشنهاد"}</button>
              <button type="button" disabled={busy || !reason.trim()} onClick={() => review("REJECTED")}>رد پیشنهاد</button></div>
          </form> : <p>دلیل تصمیم ثبت‌شده: {detail.reviewReason}</p>}
        </>}
      </section>
    </div>
  </main>;
}
