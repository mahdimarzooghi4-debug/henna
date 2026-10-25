"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  parseHumanReviewInventory, parsePartitionPreflightPreview,
  validPartitionChoices, type HumanReviewInventory,
  type PartitionPreflightPreview,
  validPartitionRevalidationRequest, parsePartitionRevalidationResult,
  type PartitionRevalidationRequest, type PartitionRevalidationResult,
} from "../../../../lib/seven-factor-partitions";
import styles from "../evidence/page.module.css";
import { parseTriageResult, validTriageSelection,
  parseTriageRevalidationResult, validTriageRevalidationRequest,
  type TriageResult, type TriageRevalidationResult } from "../../../../lib/seven-factor-human-triage";

const root = "/api/admin/allocation-proposals/research/seven-factor";
const choices = ["", "training", "validation", "evaluation"] as const;
type Choice = typeof choices[number];
const names: Record<Choice, string> = {
  "": "انتخاب نشده", training: "آموزش", validation: "اعتبارسنجی",
  evaluation: "ارزیابی مستقل",
};
const errorBody = async (response: Response): Promise<string> => {
  const raw: unknown = await response.json().catch(() => null);
  return raw && typeof raw === "object" && "message" in raw &&
    typeof raw.message === "string" ? raw.message : "درخواست پذیرفته نشد.";
};

export default function SevenFactorPartitionPage() {
  const [page, setPage] = useState(1);
  const [inventory, setInventory] = useState<HumanReviewInventory | null>(null);
  const [selection, setSelection] = useState<Record<string, Choice>>({});
  const [cutoff, setCutoff] = useState("");
  const [preview, setPreview] = useState<PartitionPreflightPreview | null>(null);
  const [manifest, setManifest] = useState<PartitionRevalidationRequest | null>(null);
  const [renewed, setRenewed] = useState<PartitionRevalidationResult | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [triageRevalidation, setTriageRevalidation] = useState<TriageRevalidationResult | null>(null);
  const [triageRevalidating, setTriageRevalidating] = useState(false);
  const [triageBusy, setTriageBusy] = useState(false);
  const triageSequence = useRef(0);
  const invalidateTriage = () => {
    ++triageSequence.current;
    setTriage(null); setTriageRevalidation(null);
    setTriageBusy(false); setTriageRevalidating(false);
  };
  const operation = useRef(0);
  const invalidatePreview = () => {
    ++operation.current; setPreview(null); setManifest(null);
    setRenewed(null); setError(""); setBusy(false); setRevalidating(false);
    invalidateTriage();
  };
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    ++operation.current;
    setLoading(true); setInventory(null); setPreview(null);
    setManifest(null); setRenewed(null); setError("");
    invalidateTriage();
    fetch(root + "/human-reviews?page=" + page, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(await errorBody(response));
        const parsed = parseHumanReviewInventory(await response.json());
        if (!parsed) throw new Error("دفتر قضاوت‌های انسانی قابل تأیید نیست.");
        return parsed;
      })
      .then(data => { if (!controller.signal.aborted) setInventory(data); })
      .catch(e => { if (!controller.signal.aborted) setError(
        e instanceof Error ? e.message : "خطای نامشخص"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page]);

  const assigned = (group: Choice) =>
    Object.entries(selection).filter(([, value]) => value === group).map(([id]) => id);
  const training = assigned("training"), validation = assigned("validation"),
    evaluation = assigned("evaluation");

  async function inspect() {
    const payload = {
      trainingReviewIds: training,
      validationReviewIds: validation,
      evaluationReviewIds: evaluation,
      cutoffUtc: cutoff,
    };
    const requestSequence = ++operation.current;
    setPreview(null); setManifest(null); setRenewed(null); setError("");
    if (!validPartitionChoices(payload)) {
      setError("هر سه بخش باید دارای بازبینی‌های انسانی مجزا و زمان معتبر UTC باشند.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(root + "/partition-preflight/preview", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await errorBody(res));
      const parsed = parsePartitionPreflightPreview(await res.json());
      if (!parsed || parsed.trainingCount !== training.length ||
          parsed.validationCount !== validation.length ||
          parsed.evaluationCount !== evaluation.length ||
          Date.parse(parsed.cutoffUtc) !== Date.parse(cutoff))
        throw new Error("پیش‌بررسی به داده انتخاب‌شده منطبق نیست.");
      if (requestSequence === operation.current) {
        setPreview(parsed);
        setManifest({ ...payload, expectedSha256: parsed.sha256 });
      }
    } catch (e) {
      if (requestSequence === operation.current)
        setError(e instanceof Error ? e.message : "هیچ مدرکی پذیرفته نشد.");
    } finally { if (requestSequence === operation.current) setBusy(false); }
  }

  async function revalidate() {
    if (!preview || !manifest || busy || revalidating ||
        !validPartitionRevalidationRequest(manifest)) return;
    const seq = ++operation.current;
    setRenewed(null); setError(""); setRevalidating(true);
    try {
      const response = await fetch(root + "/partition-preflight/revalidate", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manifest),
      });
      if (!response.ok) {
        if (response.status === 400 || response.status === 409) {
          if (seq === operation.current) {
            setPreview(null); setManifest(null);
          }
        }
        throw new Error(await errorBody(response));
      }
      const parsed = parsePartitionRevalidationResult(
        await response.json(), manifest, preview);
      if (!parsed) throw new Error("نتیجه بازاعتبارسنجی منطبق نیست؛ هیچ مدرکی پذیرفته نشد.");
      if (seq === operation.current) setRenewed(parsed);
    } catch (e) {
      if (seq === operation.current)
        setError(e instanceof Error ? e.message : "بازاعتبارسنجی ناموفق بود.");
    } finally { if (seq === operation.current) setRevalidating(false); }
  }

  async function inspectTriage() {
    const selected=Object.entries(selection).filter(([,v])=>v!=="")
      .map(([id])=>id);
    const request={selectedReviewIds:selected,cutoffUtc:cutoff};
    const seq=++triageSequence.current;
    setTriage(null);setTriageRevalidation(null);setError("");
    if(!validTriageSelection(request)){
      setError("برای کاربرگ، شناسه‌های انتخابی و زمان UTC معتبر لازم است.");
      return;
    }
    setTriageBusy(true);
    try{
      const res=await fetch(root+"/human-review-triage/preview",{
        method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(request)
      });
      if(!res.ok)throw new Error(await errorBody(res));
      const parsed=parseTriageResult(await res.json(),request);
      if(!parsed)throw new Error("پاسخ کاربرگ با انتخاب‌ها تطابق ندارد.");
      if(seq===triageSequence.current)setTriage(parsed);
    }catch(e){
      if(seq===triageSequence.current)
        setError(e instanceof Error?e.message:"کاربرگ قابل دریافت نیست.");
    }finally{if(seq===triageSequence.current)setTriageBusy(false);}
  }

  async function revalidateTriage() {
    if(!triage||triageBusy||triageRevalidating)return;
    const selected=Object.entries(selection).filter(([,v])=>v!=="").map(([id])=>id);
    const request={selectedReviewIds:selected,cutoffUtc:cutoff,expectedSha256:triage.sha256};
    const matches=selected.length===triage.selectedReviewCount&&
      selected.every(id=>triage.entries.some(entry=>entry.reviewId.toLowerCase()===id.toLowerCase()))&&
      Date.parse(triage.cutoffUtc)===Date.parse(cutoff);
    const seq=++triageSequence.current;
    setTriageRevalidation(null);setError("");
    if(!matches||!validTriageRevalidationRequest(request)){
      setTriage(null);
      setError("انتخاب‌ها یا زمان برش با کاربرگ قبلی یکسان نیست؛ کاربرگ تازه بگیرید.");
      return;
    }
    setTriageBusy(true);setTriageRevalidating(true);
    try{
      const response=await fetch(root+"/human-review-triage/revalidate",{
        method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(request)
      });
      if(!response.ok){
        if(response.status===400||response.status===409){if(seq===triageSequence.current)setTriage(null);}
        throw new Error(await errorBody(response));
      }
      const parsed=parseTriageRevalidationResult(await response.json(),request);
      if(!parsed)throw new Error("نتیجه بازاعتبارسنجی با اثرانگشت قبلی مطابقت ندارد.");
      if(seq===triageSequence.current)setTriageRevalidation(parsed);
    }catch(e){
      if(seq===triageSequence.current)setError(e instanceof Error?e.message:"بازاعتبارسنجی کاربرگ ناموفق بود.");
    }finally{
      if(seq===triageSequence.current){setTriageBusy(false);setTriageRevalidating(false);}
    }
  }

  const triageLabel: Record<string,string>={
    COMPETING_HUMAN_REVIEWS:"چند قضاوت انسانی برای این خانوار",
    COMPETING_FEATURE_REVIEWS:"چند بازبینی هفت‌عاملی برای این خانوار",
    ABSTAINED_OR_CONFLICTING_EVIDENCE:"امتناع یا تعارض در شواهد",
    REVIEW_OR_SOURCE_AFTER_CUTOFF:"منبع یا بازبینی خارج از زمان برش",
    FIRST_PARTY_SOURCE_LINEAGE_UNVERIFIED:"نسب‌نامه اولین‌طرف احراز نشده",
  };
  return <main className={styles.page} dir="rtl">
    <nav className={styles.nav} aria-label="مسیر راهبری">
      <Link href="/admin/allocation-ai">هوش حنا</Link> /
      <span aria-current="page">پیش‌بررسی سه‌بخشی</span>
    </nav>
    <h1>تفکیک دستی شواهد هفت‌عاملی</h1>
    <p className={styles.lede}>
      سه گروه مستقل <strong>آموزش، اعتبارسنجی و ارزیابی</strong> را با شناسه‌های
      بازبینی انسانی انتخاب کنید. سامانه هیچ گروهی را خودکار انتخاب نمی‌کند.
      هر خانوار باید فقط در یکی از سه بخش باشد؛ تعارض، شواهد ناقص یا نسخه ناسازگار رد می‌شود.
    </p>
    <div className={styles.status} role="note">
      فقط پیش‌بررسی شواهد — بدون ساخت Dataset، اجرای مدل، ارزیابی کیفیت، تأیید یا فعال‌سازی Production.
      سه مجموعه غیرخالی فقط شرط ساختاری است و کفایت آماری را اثبات نمی‌کند.
    </div>
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2>قضاوت‌های انسانی ثبت‌شده</h2>
        <div className={styles.pager}>
          <button disabled={loading || busy || revalidating || triageBusy || page === 1} onClick={() => setPage(p => p - 1)}>قبلی</button>
          <span>صفحه {page.toLocaleString("fa-IR")}</span>
          <button disabled={loading || busy || revalidating || triageBusy || !inventory?.hasMore} onClick={() => setPage(p => p + 1)}>بعدی</button>
        </div>
      </div>
      {loading && <p role="status">در حال دریافت اطلاعات…</p>}
      {!loading && inventory?.items.length === 0 && <p>قضاوت انسانی برای این صفحه پیدا نشد.</p>}
      {inventory && <div className={styles.rows}>
        {inventory.items.map(item => <div key={item.id} className={styles.row}>
          <div className={styles.rowInfo}>
            <span dir="ltr">{item.id}</span>
            <small>زمان بازبینی: {new Date(item.reviewedAtUtc).toLocaleString("fa-IR")} ·
              وضعیت شواهد: {item.evidenceDisposition === 1 ? "دارای قضاوت انسانی" : "امتناع/تعارض؛ پیش‌بررسی رد می‌شود"}</small>
          </div>
          <label>
            <span className={styles.fieldLabel}>بخش بازبینی</span>
            <select aria-label={"بخش بازبینی " + item.id}
              value={selection[item.id] ?? ""} disabled={busy || revalidating || triageBusy}
              onChange={event => {
                const value = event.target.value as Choice;
                if (!choices.includes(value)) return;
                setSelection(old => ({ ...old, [item.id]: value }));
                invalidatePreview();
              }}>
              {choices.map(choice => <option key={choice} value={choice}>{names[choice]}</option>)}
            </select>
          </label>
        </div>)}
      </div>}
      <p>انتخاب‌ها در صفحات بعد حفظ می‌شوند؛ برای بررسی مجدد پس از تغییر داده، اثرانگشت تازه بگیرید.</p>
    </section>
    <section className={styles.panel}>
      <h2>پیش‌بررسی قطعی نسب‌نامه</h2>
      <p>
        آموزش: {training.length.toLocaleString("fa-IR")} ·
        اعتبارسنجی: {validation.length.toLocaleString("fa-IR")} ·
        ارزیابی مستقل: {evaluation.length.toLocaleString("fa-IR")}
      </p>
      <label htmlFor="partition-cutoff" className={styles.fieldLabel}>
        زمان برش UTC — باید بعد از تمام بازبینی‌های انتخابی باشد
      </label>
      <div className={styles.actions}>
        <input id="partition-cutoff" dir="ltr" value={cutoff} placeholder="2026-10-09T12:00:00.000Z"
          onChange={event => { setCutoff(event.target.value); invalidatePreview(); }}/>
        <button type="button" disabled={busy}
          onClick={() => { setCutoff(new Date().toISOString()); invalidatePreview(); }}>
          زمان فعلی UTC
        </button>
        <button type="button" disabled={busy || revalidating || triageBusy || loading || !inventory || training.length < 1 ||
          validation.length < 1 || evaluation.length < 1} onClick={() => void inspect()}>
          {busy ? "در حال اعتبارسنجی…" : "بررسی سه بخش (بدون پذیرش)"}
        </button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {preview && <div className={styles.result} role="status">
        <h3>نتیجه ساختاری معتبر — نه تأیید Dataset</h3>
        <p>نسخه مبنا: {preview.sourceFormulaVersion} · Dataset مبنا: {preview.sourceDatasetVersion}</p>
        <p>دستور مالی: {preview.sourceInstructionReference}</p>
        <p>تعداد: {preview.trainingCount} آموزش / {preview.validationCount} اعتبارسنجی /
          {preview.evaluationCount} ارزیابی مستقل</p>
        <p>SHA-256 مجموعه دقیق انتخاب‌شده:</p>
        <code dir="ltr">{preview.sha256}</code>
        <p><strong>{preview.admissionStatus}</strong></p>
        <div className={styles.actions}>
          <button type="button" disabled={!manifest || busy || revalidating}
            onClick={() => void revalidate()}>
            {revalidating ? "در حال بازاعتبارسنجی…" :
              "بازاعتبارسنجی همین انتخاب و SHA-256 در PostgreSQL"}
          </button>
        </div>
        {renewed && <p role="status">
          بازاعتبارسنجی موفق: SHA-256 و نسب‌نامه انتخاب‌شده تغییر نکرده‌اند.
          این تأیید Dataset، آموزش یا فعال‌سازی مدل نیست.
        </p>}
      </div>}
    </section>
    <section className={styles.panel} aria-label="کاربرگ تعارض بازبینی‌های انسانی">
      <h2>کاربرگ بررسی تعارض بازبینی‌های انسانی</h2>
      <p>شناسه‌هایی که برای سه گروه انتخاب کرده‌اید، به‌صورت دستی و فقط‌خواندنی بررسی می‌شوند.
        نتیجه، تصمیم اصلاح، تأیید شواهد یا گزینش قضاوت برتر نیست.</p>
      <button type="button" disabled={busy || revalidating || loading || triageBusy}
        onClick={()=>void inspectTriage()}>
        {triageBusy?"در حال بررسی تعارض…":"بررسی تعارض تمام شناسه‌های منتخب"}
      </button>
      {triage&&<div className={styles.rows} role="status">
        <p>تعداد بررسی‌شده: {triage.selectedReviewCount.toLocaleString("fa-IR")} ·
          هیچ تعارضی خودکار رفع نشده است.</p>
        <p>اثر انگشت محتوای کاربرگ:</p><code dir="ltr">{triage.sha256}</code>
        <button type="button" disabled={busy||revalidating||loading||triageBusy}
          onClick={()=>void revalidateTriage()}>
          {triageRevalidating?"در حال بازبینی مجدد محتوای PostgreSQL…":"بازاعتبارسنجی محتوای همین کاربرگ در PostgreSQL"}
        </button>
        {triageRevalidation&&<p role="status">
          اثرانگشت و محتوای فعلی تغییر نکرده‌اند. این نتیجه فقط ثبات کاربرگ را تأیید می‌کند؛
          تعارض انسانی رفع نشده و Dataset یا مدل پذیرفته نشده است.
        </p>}
        {triage.entries.map(item=><div key={item.reviewId} className={styles.row}>
          <div className={styles.rowInfo}>
            <strong dir="ltr">{item.reviewId}</strong>
            <small>{item.finding==="NEEDS_EXPLICIT_HUMAN_REVIEW"
              ?"نیازمند بررسی انسانی"
              :"مانع ساختاری در این کاربرگ مشاهده نشد؛ بدون پذیرش داده"}</small>
            <small>بازبینی ویژگی: {item.householdFeatureReviewCount.toLocaleString("fa-IR")} ·
              قضاوت انسانی: {item.householdHumanReviewCount.toLocaleString("fa-IR")}</small>
            {item.reasons.map(code=><small key={code}>{triageLabel[code]??code}</small>)}
          </div>
        </div>)}
      </div>}
    </section>
    <p className={styles.footer}>
      این پیش‌بررسی فقط تطابق و عدم همپوشانی شواهد را می‌سنجد. معیار کامل تأییدشده،
      اصالت‌سنجی اسناد، قرارداد اصلاح/انصراف، آزمون عدالت و معیار پذیرش مدل هنوز باید
      مستقل و انسانی تصویب شوند.
    </p>
    <Link href="/admin/allocation-ai/evidence">بازگشت به دفتر شواهد هفت‌عاملی ←</Link>
  </main>;
}
