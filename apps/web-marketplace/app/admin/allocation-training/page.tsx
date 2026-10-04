"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../allocation-proposals/page.module.css";
type Assessment = { id: string; datasetVersion: string; sourceInstructionReference: string; health: number; hardship: number; age: number; size: number; care: number; education: number; evidenceReference?: string | null };
type Label = { id: string; snapshotId: string; needScore: number; partition: number };
class RequestError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request(path: string, body?: unknown) {
  const response = await fetch(`/api/admin/allocation-proposals/research/${path}`, { cache: "no-store",
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.message ?? "دریافت اطلاعات ممکن نشد.", response.status);
  return data;
}
export default function AllocationTrainingPage() {
  const [rows, setRows] = useState<Assessment[]>([]), [labels, setLabels] = useState<Label[]>([]);
  const [page, setPage] = useState(1), [rubric, setRubric] = useState(""), [loadedRubric, setLoadedRubric] = useState("");
  const [snapshot, setSnapshot] = useState(""), [score, setScore] = useState(""), [partition, setPartition] = useState(1);
  const [selected, setSelected] = useState<string[]>([]), [pool, setPool] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<string | null>(null), [truncated, setTruncated] = useState(false);
  useEffect(() => {
    let current = true; setRows([]); setSnapshot("");
    request(`assessments?page=${page}`).then(data => { if (current) setRows(data.items); })
      .catch(e => { if (current) { setError(e.message); setLabels([]); setSelected([]); } });
    return () => { current = false; };
  }, [page]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice(""); setProposal(null);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "اجرای درخواست ممکن نشد."); if (e instanceof RequestError && [401,403].includes(e.status)) { setRows([]); setLabels([]); setSelected([]); } }
    finally { setBusy(false); }
  }
  async function loadLabels() {
    const value = rubric.trim(); const data = await request(`labels?rubricVersion=${encodeURIComponent(value)}`);
    setLabels(data.items); setSelected([]); setLoadedRubric(value); setTruncated(data.truncated === true);
  }
  const chosen = labels.filter(x => selected.includes(x.id));
  const training = chosen.filter(x => x.partition === 1).length, validation = chosen.filter(x => x.partition === 2).length;
  return <main className={styles.page}>
    <header><Link href="/admin/allocation-proposals">بررسی پیشنهادها</Link><Link href="/auth">ورود</Link></header>
    <h1>آموزش آزمایشی تخصیص</h1>
    <Link href="/admin/allocation-training-runs">پیگیری سوابق و نتیجه آموزش</Link>
    <Link href="/admin/allocation-assessments">ثبت ارزیابی مستند خانوار</Link>
    <aside className={styles.note}>امتیاز نیاز را طبق معیار مصوب، مستقل از مبلغ خرید ثبت کنید. حداقل ۳۰ خانوار برای آموزش و ۱۰ خانوار متفاوت برای ارزیابی لازم است. ضرایب پس از آموزش فعال نمی‌شوند.</aside>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
    {proposal && <Link href="/admin/allocation-proposals">مشاهده پیشنهاد ثبت‌شده در فهرست بررسی</Link>}
    <section className={styles.card}>
      <h2>ثبت امتیاز نیاز</h2>
      <label htmlFor="rubric">نسخه معیار ارزیابی</label><input id="rubric" required maxLength={120} value={rubric} disabled={busy} onChange={e => { setRubric(e.target.value); setLabels([]); setSelected([]); setLoadedRubric(""); }}/>
      <p>ارزیابی‌های ذخیره‌شده؛ ترتیب فیلدها: سلامت، معیشت، سن، اندازه، مراقبت، تحصیلات.</p>
      {!rows.length && <p>ارزیابی ذخیره‌شده‌ای در این صفحه وجود ندارد.</p>}
      <label htmlFor="snapshot">ارزیابی خانوار</label><select id="snapshot" value={snapshot} disabled={busy} onChange={e => setSnapshot(e.target.value)}>
        <option value="">انتخاب کنید</option>{rows.map((x,i) => <option key={x.id} value={x.id}>ردیف {i+1} · {x.datasetVersion} · {x.sourceInstructionReference} · {x.evidenceReference ?? "ثبت داخلی"} · {[x.health,x.hardship,x.age,x.size,x.care,x.education].join(" / ")}</option>)}
      </select>
      <nav><button disabled={busy || page === 1} onClick={() => setPage(p => p-1)}>قبلی</button><span>صفحه {page}</span><button disabled={busy || rows.length < 20 || page >= 10000} onClick={() => setPage(p => p+1)}>بعدی</button></nav>
      <form onSubmit={e => { e.preventDefault(); void perform(async () => {
        await request("labels", { snapshotId: snapshot, needScore: Number(score), rubricVersion: rubric.trim(), partition });
        setNotice("امتیاز ثبت شد و قابل بازنویسی نیست."); setScore(""); await loadLabels();
      }); }}>
        <label htmlFor="score">امتیاز نیاز از صفر تا یک</label><input id="score" type="number" min="0" max="1" step="0.001" required value={score} disabled={busy} onChange={e => setScore(e.target.value)}/>
        <label htmlFor="partition">کاربرد این خانوار</label><select id="partition" value={partition} disabled={busy} onChange={e => setPartition(Number(e.target.value))}><option value={1}>آموزش</option><option value={2}>ارزیابی مستقل</option></select>
        <button disabled={busy || !snapshot || !rubric.trim() || score === ""}>ثبت امتیاز</button>
      </form>
    </section>
    <section className={styles.card}>
      <h2>انتخاب داده و اجرای آموزش</h2>
      <button disabled={busy || !rubric.trim()} onClick={() => void perform(loadLabels)}>دریافت امتیازهای این معیار</button>
      {loadedRubric && <p>معیار: {loadedRubric} · {labels.length} امتیاز</p>}
      {truncated && <p>بیش از ۵۰۰ امتیاز وجود دارد؛ فقط ۵۰۰ مورد اخیر نمایش داده می‌شود.</p>}
      <button disabled={busy || !labels.length} onClick={() => setSelected(labels.map(x => x.id))}>انتخاب همه موارد نمایش‌داده‌شده</button>
      <button disabled={busy || !selected.length} onClick={() => setSelected([])}>پاک‌کردن انتخاب</button>
      <ul>{labels.map((x,i) => <li key={x.id}><label><input type="checkbox" checked={selected.includes(x.id)} disabled={busy} onChange={e => setSelected(ids => e.target.checked ? [...ids,x.id] : ids.filter(id => id !== x.id))}/>ردیف {i+1} · امتیاز {x.needScore} · {x.partition === 1 ? "آموزش" : "ارزیابی"}</label></li>)}</ul>
      <p>انتخاب‌شده: {training} آموزش، {validation} ارزیابی. تمام موارد باید از یک مجموعه و دستور تأمین مالی باشند؛ همپوشانی خانوار پذیرفته نمی‌شود.</p>
      <form onSubmit={e => { e.preventDefault(); void perform(async () => {
        const data = await request("train", { labelIds: selected, poolRial: Number(pool) });
        setNotice(data.status === "PROPOSED" ? "آموزش انجام شد؛ پیشنهاد برای بررسی انسانی ثبت شد." : "بهبود کافی در ارزیابی مشاهده نشد؛ فقط سابقه اجرا ثبت شد.");
        setProposal(data.proposalId ?? null);
      }); }}>
        <label htmlFor="pool">مبلغ شبیه‌سازی به ریال</label><input id="pool" type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" required value={pool} disabled={busy} onChange={e => setPool(e.target.value)}/>
        <button disabled={busy || training < 30 || validation < 10 || !pool}>{busy ? "در حال اجرا…" : "شروع آموزش آزمایشی"}</button>
      </form>
    </section>
  </main>;
}
