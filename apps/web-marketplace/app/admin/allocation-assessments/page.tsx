"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseAssessmentInput } from "../../../lib/allocation-assessment";
import styles from "../allocation-proposals/page.module.css";
const fields: Record<string,string> = { health: "سلامت و درمان", hardship: "فشار معیشتی", age: "سن و وابستگی", size: "اندازه خانوار", care: "مراقبت و حمایت", education: "تحصیلات" };
export default function AllocationAssessmentsPage() {
  const [snapshotId,setSnapshotId] = useState("");
  const [householdKey,setHouseholdKey] = useState(""), [datasetVersion,setDataset] = useState("");
  const [sourceInstructionReference,setSource] = useState(""), [evidenceReference,setEvidence] = useState("");
  const [geographicFactor,setGeography] = useState(""), [allocatedRial,setAmount] = useState("");
  const [date,setDate] = useState(""), [scores,setScores] = useState<Record<string,string>>({});
  const [confirmed,setConfirmed] = useState(false), [busy,setBusy] = useState(false), [saved,setSaved] = useState(false);
  const [error,setError] = useState("");
  useEffect(() => { setSnapshotId(crypto.randomUUID()); }, []);
  async function submit() {
    setError("");
    const assessed = new Date(date);
    const input = parseAssessmentInput({ snapshotId, householdKey: householdKey.trim(), datasetVersion, sourceInstructionReference,
      evidenceReference, geographicFactor: geographicFactor === "" ? null : Number(geographicFactor),
      allocatedRial: allocatedRial === "" ? null : Number(allocatedRial), assessedAtUtc: Number.isFinite(assessed.getTime()) ? assessed.toISOString() : "",
      scores: Object.fromEntries(Object.keys(fields).map(key => [key, scores[key] === undefined || scores[key] === "" ? null : Number(scores[key])])) });
    if (!input || !confirmed) { setError("تمام اطلاعات و تأیید مستندات لازم است."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/allocation-proposals/research/assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "ثبت ارزیابی ممکن نشد.");
      if (data.id !== snapshotId || data.active !== false) throw new Error("پاسخ ثبت قابل تأیید نیست.");
      setSaved(true);
    } catch(e) { setError(e instanceof Error ? e.message : "ثبت ارزیابی ممکن نشد."); }
    finally { setBusy(false); }
  }
  function reset() {
    setSnapshotId(crypto.randomUUID()); setHouseholdKey(""); setEvidence(""); setGeography(""); setAmount(""); setDate(""); setScores({}); setConfirmed(false); setSaved(false); setError("");
  }
  return <main className={styles.page}>
    <header><Link href="/admin/allocation-training">امتیازدهی و آموزش</Link><Link href="/auth">ورود</Link></header>
    <h1>ثبت ارزیابی مستند خانوار</h1>
    <aside className={styles.note}>اطلاعات را از ارزیابی تأییدشده وارد کنید. شناسه خانوار باید همان شناسه ثابت پرونده باشد؛ کد ملی و نام خانوار وارد نکنید. ثبت این فرم اعتبار کیف پول را تغییر نمی‌دهد.</aside>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {saved && <section role="status"><p>ارزیابی ثبت شد و در صفحه آموزش قابل انتخاب است.</p><Link href="/admin/allocation-training">ادامه به ثبت امتیاز نیاز</Link><button onClick={reset}>ثبت ارزیابی بعدی</button></section>}
    <section className={styles.card}>
      <p>شناسه ثبت: <b dir="ltr" className={styles.version}>{snapshotId}</b></p>
      <p>در صورت قطع ارتباط، تکرار همین شناسه رکورد قبلی را بازنویسی نمی‌کند.</p>
      <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <fieldset disabled={busy || saved} style={{ border:0, padding:0, minWidth:0 }}>
          <label htmlFor="household">شناسه ثابت خانوار (UUID)</label><input id="household" dir="ltr" required value={householdKey} onChange={e => setHouseholdKey(e.target.value)}/>
          <label htmlFor="dataset">نسخه مجموعه ارزیابی</label><input id="dataset" required maxLength={120} value={datasetVersion} onChange={e => setDataset(e.target.value)}/>
          <label htmlFor="source">مرجع دستور تأمین مالی</label><input id="source" required maxLength={120} value={sourceInstructionReference} onChange={e => setSource(e.target.value)}/>
          <label htmlFor="evidence">مرجع سند ارزیابی</label><input id="evidence" required maxLength={240} value={evidenceReference} onChange={e => setEvidence(e.target.value)}/>
          <p>مرجع سند را وارد کنید؛ اطلاعات پزشکی یا هویتی را در این فیلد ننویسید.</p>
          <label htmlFor="assessed">تاریخ و ساعت ارزیابی</label><input id="assessed" type="datetime-local" required value={date} onChange={e => setDate(e.target.value)}/>
          <p>زمان بر اساس منطقه زمانی دستگاه شما ثبت و در سرور به UTC ذخیره می‌شود.</p>
          <label htmlFor="geography">ضریب جغرافیایی مصوب</label><input id="geography" type="number" min="0.000001" step="any" required value={geographicFactor} onChange={e => setGeography(e.target.value)}/>
          <label htmlFor="amount">مبلغ تخصیص ثبت‌شده به ریال</label><input id="amount" type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" required value={allocatedRial} onChange={e => setAmount(e.target.value)}/>
          <div className={styles.weights}>{Object.entries(fields).map(([key,name]) => <div key={key}>
            <label htmlFor={`score-${key}`}>{name}</label><select id={`score-${key}`} required value={scores[key] ?? ""} onChange={e => setScores(s => ({...s,[key]:e.target.value}))}>
              <option value="">انتخاب امتیاز</option>{[0,1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
            </select></div>)}</div>
          <label><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>این داده‌ها با سند ارزیابی و نگاشت امتیاز مصوب تطبیق داده شده‌اند.</label>
          <button disabled={!snapshotId || !confirmed}>{busy ? "در حال ثبت…" : "ثبت ارزیابی مستند"}</button>
        </fieldset>
      </form>
    </section>
  </main>;
}
