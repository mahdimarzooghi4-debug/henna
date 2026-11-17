"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../allocation-proposals/page.module.css";
import {
  clearAllocationTrainingIntent,
  createAllocationTrainingIntent,
  persistAllocationTrainingIntent,
  restoreAllocationTrainingIntent,
  type AllocationTrainingIntent,
} from "../../../lib/web-pending-allocation-training";
type Assessment = { id: string; datasetVersion: string; sourceInstructionReference: string; health: number; hardship: number; age: number; size: number; care: number; education: number; evidenceReference?: string | null; trainingEligible: boolean };
type Label = { id: string; snapshotId: string; needScore: number; partition: number };
class RequestError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request(path: string, body?: unknown) {
  const response = await fetch(`/api/admin/allocation-proposals/research/${path}`, { cache: "no-store",
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.message ?? "دریافت اطلاعات ممکن نشد.", response.status);
  return data;
}
async function requestTraining(intent: AllocationTrainingIntent) {
  const response = await fetch("/api/admin/allocation-proposals/research/train", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": intent.key,
    },
    body: intent.body,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" &&
      "message" in data && typeof data.message === "string"
      ? data.message : "اجرای آموزش ممکن نشد.";
    throw new RequestError(message, response.status);
  }
  if (!data || typeof data !== "object" ||
      !("id" in data) || typeof data.id !== "string" ||
      !("status" in data) ||
      !["PROPOSED", "NO_IMPROVEMENT"].includes(String(data.status)) ||
      !("active" in data) || data.active !== false)
    throw new RequestError("پاسخ اجرای آموزش قابل تأیید نیست.", 503);
  return data as {
    id: string;
    status: "PROPOSED" | "NO_IMPROVEMENT";
    proposalId?: string | null;
    active: false;
  };
}
export default function AllocationTrainingPage() {
  const [rows, setRows] = useState<Assessment[]>([]), [labels, setLabels] = useState<Label[]>([]);
  const [page, setPage] = useState(1), [rubric, setRubric] = useState(""), [loadedRubric, setLoadedRubric] = useState("");
  const [snapshot, setSnapshot] = useState(""), [score, setScore] = useState(""), [partition, setPartition] = useState(1);
  const [selected, setSelected] = useState<string[]>([]), [pool, setPool] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<string | null>(null), [truncated, setTruncated] = useState(false);
  const [pendingTraining, setPendingTraining] =
    useState<AllocationTrainingIntent | null>(null);
  const [storageFailure, setStorageFailure] = useState<string | null>(null);
  useEffect(() => {
    try {
      const restored = restoreAllocationTrainingIntent();
      if (!restored) return;
      setPendingTraining(restored);
      setNotice(
        "یک اجرای آموزش نتیجه قطعی ندارد. همان labelIds، مبلغ، کلید و بدنه برای تکرار امن پس از reload بازیابی شد.");
    } catch {
      setStorageFailure(
        "وضعیت retry امن آموزش قابل اعتماد نیست. اجرای آموزش یا ثبت امتیاز جدید متوقف شد.");
    }
  }, []);
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
  async function sendTraining(intent: AllocationTrainingIntent) {
    setBusy(true); setError(""); setNotice(""); setProposal(null);
    try {
      const data = await requestTraining(intent);
      if (!clearAllocationTrainingIntent(intent.key)) {
        setStorageFailure(
          "پاسخ اجرای آموزش دریافت شد، اما پاک‌سازی retry محلی تأیید نشد. اجرای جدید متوقف است.");
        return;
      }
      setPendingTraining(null);
      setNotice(data.status === "PROPOSED"
        ? "آموزش انجام شد؛ پیشنهاد برای بررسی انسانی ثبت شد."
        : "بهبود کافی در ارزیابی مشاهده نشد؛ فقط سابقه اجرا ثبت شد.");
      setProposal(data.proposalId ?? null);
    } catch (e) {
      if (e instanceof RequestError && e.status === 503) {
        setPendingTraining(intent);
        setNotice(
          "نتیجه اجرای آموزش قطعی نیست. همان labelIds، مبلغ، کلید و بدنه پس از reload نیز برای تکرار امن حفظ شده‌اند.");
      } else {
        if (!clearAllocationTrainingIntent(intent.key)) {
          setStorageFailure(
            "نتیجه سرور قطعی است، اما پاک‌سازی retry آموزش تأیید نشد. اجرای جدید متوقف است.");
          return;
        }
        setPendingTraining(null);
        setError(e instanceof Error ? e.message : "اجرای درخواست ممکن نشد.");
        if (e instanceof RequestError && [401,403].includes(e.status)) {
          setRows([]); setLabels([]); setSelected([]);
        }
      }
    } finally { setBusy(false); }
  }
  async function startTraining() {
    if (pendingTraining || storageFailure) return;
    let intent: AllocationTrainingIntent;
    try {
      intent = createAllocationTrainingIntent(selected, Number(pool));
      persistAllocationTrainingIntent(intent);
    } catch {
      setStorageFailure(
        "ذخیره retry امن آموزش تأیید نشد؛ هیچ اجرای جدیدی به سرور ارسال نشد.");
      return;
    }
    setPendingTraining(intent);
    await sendTraining(intent);
  }
  async function retryTraining() {
    if (!pendingTraining) return;
    await sendTraining(pendingTraining);
  }
  const chosen = labels.filter(x => selected.includes(x.id));
  const training = chosen.filter(x => x.partition === 1).length, validation = chosen.filter(x => x.partition === 2).length;
  return <main className={styles.page}>
    <header><Link href="/admin/allocation-proposals">بررسی پیشنهادها</Link><Link href="/auth">ورود</Link></header>
    <h1>آموزش آزمایشی تخصیص — شش‌شاخصی</h1>
    <aside className={styles.note}>
      این فرم مربوط به مسیر آزمایشی شش‌شاخصی است. برای نسخه هفت‌شاخصی v1.1،
      وضعیت مالک/مستأجر و مقیاس پنج‌سطحی شدت نیاز، هنوز مسیر ورود عملیاتی
      این صفحه تأیید نشده است. شناسه مقیاس پنج‌سطحی را به‌جای Rubric کامل
      آموزشی وارد نکنید؛ پذیرش Dataset جدید مسدود می‌ماند.
      <p><Link href="/admin/allocation-ai">بازگشت به فضای کاری هوش حنا</Link></p>
    </aside>
    <Link href="/admin/allocation-training-runs">پیگیری سوابق و نتیجه آموزش</Link>
    <Link href="/admin/allocation-assessments">ثبت ارزیابی مستند خانوار</Link>
    <Link href="/admin/allocation-retention">Retention داده‌های پژوهشی</Link>
    <Link href="/admin/allocation-outcomes">Outcomeهای غیرمالی مستند</Link>
    <aside className={styles.note}>هوش حنا فقط از snapshotهای first-party ثبت‌شده داخل خود حنا آموزش می‌بیند؛ ارزیابی‌های منتسب/ورودی دستی فقط برای سابقه پژوهشی‌اند و وارد training نمی‌شوند. حداقل ۳۰ خانوار برای آموزش و ۱۰ خانوار متفاوت برای ارزیابی لازم است. ضرایب پس از آموزش خودکار فعال نمی‌شوند.</aside>
    {storageFailure && <p role="alert" className={styles.error}>{storageFailure}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
    {pendingTraining && !storageFailure && <button type="button"
      disabled={busy} onClick={() => void retryTraining()}>
      {busy ? "در حال تکرار امن…" : "تکرار امن اجرای آموزش قبلی"}
    </button>}
    {proposal && <Link href="/admin/allocation-proposals">مشاهده پیشنهاد ثبت‌شده در فهرست بررسی</Link>}
    <section className={styles.card}>
      <h2>ثبت امتیاز نیاز</h2>
      <label htmlFor="rubric">نسخه معیار ارزیابی</label><input id="rubric" required maxLength={120} value={rubric} disabled={busy || pendingTraining !== null || storageFailure !== null} onChange={e => { setRubric(e.target.value); setLabels([]); setSelected([]); setLoadedRubric(""); }}/>
      <p>ارزیابی‌های ذخیره‌شده؛ ترتیب فیلدها: سلامت، معیشت، سن، اندازه، مراقبت، تحصیلات.</p>
      {!rows.length && <p>ارزیابی ذخیره‌شده‌ای در این صفحه وجود ندارد.</p>}
      <label htmlFor="snapshot">ارزیابی خانوار</label><select id="snapshot" value={snapshot} disabled={busy || pendingTraining !== null || storageFailure !== null} onChange={e => setSnapshot(e.target.value)}>
        <option value="">انتخاب کنید</option>{rows.map((x,i) => <option key={x.id} value={x.id} disabled={!x.trainingEligible}>ردیف {i+1} · {x.datasetVersion} · {x.sourceInstructionReference} · {x.trainingEligible ? "داده داخلی حنا" : "فقط پژوهش؛ غیرمجاز برای آموزش"} · {[x.health,x.hardship,x.age,x.size,x.care,x.education].join(" / ")}</option>)}
      </select>
      <nav><button disabled={busy || pendingTraining !== null || storageFailure !== null || page === 1} onClick={() => setPage(p => p-1)}>قبلی</button><span>صفحه {page}</span><button disabled={busy || pendingTraining !== null || storageFailure !== null || rows.length < 20 || page >= 10000} onClick={() => setPage(p => p+1)}>بعدی</button></nav>
      <form onSubmit={e => { e.preventDefault(); void perform(async () => {
        await request("labels", { snapshotId: snapshot, needScore: Number(score), rubricVersion: rubric.trim(), partition });
        setNotice("امتیاز ثبت شد و قابل بازنویسی نیست."); setScore(""); await loadLabels();
      }); }}>
        <label htmlFor="score">امتیاز نیاز از صفر تا یک</label><input id="score" type="number" min="0" max="1" step="0.001" required value={score} disabled={busy || pendingTraining !== null || storageFailure !== null} onChange={e => setScore(e.target.value)}/>
        <label htmlFor="partition">کاربرد این خانوار</label><select id="partition" value={partition} disabled={busy || pendingTraining !== null || storageFailure !== null} onChange={e => setPartition(Number(e.target.value))}><option value={1}>آموزش</option><option value={2}>ارزیابی مستقل</option></select>
        <button disabled={busy || pendingTraining !== null || storageFailure !== null || !snapshot || !rubric.trim() || score === ""}>ثبت امتیاز</button>
      </form>
    </section>
    <section className={styles.card}>
      <h2>انتخاب داده و اجرای آموزش</h2>
      <button disabled={busy || storageFailure !== null || !rubric.trim()} onClick={() => void perform(loadLabels)}>دریافت امتیازهای این معیار</button>
      {loadedRubric && <p>معیار: {loadedRubric} · {labels.length} امتیاز</p>}
      {truncated && <p>بیش از ۵۰۰ امتیاز وجود دارد؛ فقط ۵۰۰ مورد اخیر نمایش داده می‌شود.</p>}
      <button disabled={busy || pendingTraining !== null || storageFailure !== null || !labels.length} onClick={() => setSelected(labels.map(x => x.id))}>انتخاب همه موارد نمایش‌داده‌شده</button>
      <button disabled={busy || pendingTraining !== null || storageFailure !== null || !selected.length} onClick={() => setSelected([])}>پاک‌کردن انتخاب</button>
      <ul>{labels.map((x,i) => <li key={x.id}><label><input type="checkbox" checked={selected.includes(x.id)} disabled={busy || pendingTraining !== null || storageFailure !== null} onChange={e => setSelected(ids => e.target.checked ? [...ids,x.id] : ids.filter(id => id !== x.id))}/>ردیف {i+1} · امتیاز {x.needScore} · {x.partition === 1 ? "آموزش" : "ارزیابی"}</label></li>)}</ul>
      <p>انتخاب‌شده: {training} آموزش، {validation} ارزیابی. تمام موارد باید از یک مجموعه و دستور تأمین مالی باشند؛ همپوشانی خانوار پذیرفته نمی‌شود.</p>
      <form onSubmit={e => { e.preventDefault(); void startTraining(); }}>
        <label htmlFor="pool">مبلغ شبیه‌سازی به ریال</label><input id="pool" type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" required value={pool}
          disabled={busy || pendingTraining !== null || storageFailure !== null}
          onChange={e => setPool(e.target.value)}/>
        <button disabled={busy || pendingTraining !== null || storageFailure !== null ||
          training < 30 || validation < 10 || !pool}>
          {busy ? "در حال اجرا…" : "شروع آموزش آزمایشی"}
        </button>
      </form>
    </section>
  </main>;
}
