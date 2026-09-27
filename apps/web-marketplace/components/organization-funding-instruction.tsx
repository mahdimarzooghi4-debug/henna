"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

type AllocationMode = "HENNA_NEEDS_BASED" | "ORGANIZATION_DEFINED";
type Program = { programId: string; organizationId: string; organizationName: string; name: string; allocationMode: AllocationMode; description: string; state: "DRAFT"; revision: number; createdAtUtc: string };
type Instruction = { instructionId: string; programId: string; programRevision: number; allocationMode: AllocationMode; sourceInstructionReference: string; state: "PENDING_VERIFICATION"; revision: number; submittedAtUtc: string };
type LoadState = { loading: boolean; program?: Program; instruction?: Instruction; canSubmit: boolean; message?: string };
const modeLabels: Record<AllocationMode, string> = { HENNA_NEEDS_BASED: "الگوی تخصیص حنا", ORGANIZATION_DEFINED: "انتخاب توسط سازمان" };
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export function OrganizationFundingInstruction({ programId }: { programId: string }) {
  const [state, setState] = useState<LoadState>({ loading: true, canSubmit: false });
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const idempotency = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [programResponse, profileResponse] = await Promise.all([
          fetch("/api/organization/programs", { cache: "no-store", signal: controller.signal }),
          fetch("/api/organization/profiles", { cache: "no-store", signal: controller.signal }),
        ]);
        const [programBody, profileBody] = await Promise.all([programResponse.json().catch(() => null), profileResponse.json().catch(() => null)]);
        if (!programResponse.ok || !isRecord(programBody) || !Array.isArray(programBody.programs) || !profileResponse.ok || !isRecord(profileBody) || !Array.isArray(profileBody.profiles)) throw new Error("دسترسی سازمان یا فهرست طرح‌ها در دسترس نیست.");
        const program = programBody.programs.find((item): item is Program => isRecord(item) && item.programId === programId) as Program | undefined;
        if (!program) throw new Error("طرح پیدا نشد یا دسترسی ندارید.");
        const profile = profileBody.profiles.find(item => isRecord(item) && item.organizationId === program.organizationId);
        const canSubmit = !!profile && profile.memberRole !== "ORG_TECHNICAL_OPERATOR";
        const response = await fetch(`/api/organization/programs/${programId}/funding-instruction`, { cache: "no-store", signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 404) { setState({ loading: false, program, canSubmit }); return; }
        if (!response.ok || !isRecord(body) || body.programId !== programId || body.state !== "PENDING_VERIFICATION") throw new Error(isRecord(body) && typeof body.message === "string" ? body.message : "وضعیت دستور منبع در دسترس نیست.");
        setReference(typeof body.sourceInstructionReference === "string" ? body.sourceInstructionReference : "");
        setState({ loading: false, program, instruction: body as Instruction, canSubmit });
      } catch (error) {
        if (!controller.signal.aborted) setState({ loading: false, canSubmit: false, message: error instanceof Error ? error.message : "اطلاعات طرح در دسترس نیست." });
      }
    };
    void load();
    return () => controller.abort();
  }, [programId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const program = state.program;
    const cleanReference = reference.trim();
    if (!program || !state.canSubmit || !cleanReference || cleanReference.length > 160) { setMessage("شماره یا مرجع دستور منبع را بررسی کنید."); return; }
    const payload = JSON.stringify({ programRevision: program.revision, sourceInstructionReference: cleanReference });
    if (!idempotency.current || idempotency.current.payload !== payload) idempotency.current = { payload, key: crypto.randomUUID() };
    setBusy(true);
    try {
      const response = await fetch(`/api/organization/programs/${programId}/funding-instruction`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotency.current.key }, body: payload, cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(body) || body.programId !== programId || body.state !== "PENDING_VERIFICATION") {
        setMessage(isRecord(body) && typeof body.message === "string" ? body.message : "ثبت دستور منبع تأیید نشد."); return;
      }
      setReference(typeof body.sourceInstructionReference === "string" ? body.sourceInstructionReference : cleanReference);
      setState(current => ({ ...current, instruction: body as Instruction }));
      idempotency.current = null;
    } catch { setMessage("ارتباط با سرویس برقرار نشد؛ می‌توانید همین درخواست را دوباره ارسال کنید."); }
    finally { setBusy(false); }
  }

  return <main className="organization-page organization-shell" dir="rtl">
    <aside className="organization-sidebar">
      <Link href="/organization" className="organization-brand"><img src="/hana-logo.png" alt="حنا" /><strong>پنل سازمان‌ها</strong></Link>
      <nav aria-label="منوی سازمان"><Link href="/organization">داشبورد</Link><Link className="is-active" href="/organization/programs">طرح‌ها و اعتبارها</Link><span>افراد و مشمولان</span><span>تخصیص</span><span>وضعیت استفاده</span><span>منابع داده و API</span><span>گزارش‌ها</span><span>اعلانات</span><span>اطلاعات سازمان</span><span>پشتیبانی</span><span>تنظیمات</span></nav>
    </aside>
    <div className="organization-main">
      <header className="organization-topbar"><span>سازمان همکار</span><h1>جزئیات دستور منبع</h1></header>
      <section className="organization-detail-content" aria-live="polite">
        <Link className="organization-back-link" href="/organization/programs">← بازگشت به طرح‌ها</Link>
        {state.loading ? <p role="status">در حال دریافت اطلاعات طرح…</p> : state.message ? <div className="organization-notice" role="alert">{state.message}</div> : state.program ? <>
          <div className="organization-detail-notice"><strong>مرجع دستور تأمین مالی را ثبت یا پیگیری کنید.</strong><span>ثبت مرجع، وصول وجه یا تأیید اختیار منبع را اثبات نمی‌کند.</span></div>
          <div className="organization-detail-grid">
            <section className="organization-detail-card"><h2>اطلاعات پایه تخصیص</h2><dl><div><dt>طرح مرتبط</dt><dd>{state.program.name}</dd></div><div><dt>روش تخصیص ثبت‌شده</dt><dd>{modeLabels[state.program.allocationMode]}</dd></div><div><dt>مرجع دستور منبع</dt><dd>{state.instruction?.sourceInstructionReference ?? "ثبت نشده"}</dd></div><div><dt>وضعیت دستور</dt><dd>{state.instruction ? "در انتظار بررسی" : "ثبت نشده"}</dd></div></dl></section>
            <section className="organization-detail-card"><h2>وضعیت بررسی</h2><dl><div><dt>نتیجه بررسی منبع</dt><dd>{state.instruction ? "در انتظار بررسی" : "ثبت دستور لازم است"}</dd></div><div><dt>تخصیص نهایی</dt><dd>هنوز انجام نشده است</dd></div><div><dt>وضعیت مالی</dt><dd>در این مرحله ثبت نمی‌شود</dd></div></dl></section>
          </div>
          {state.instruction ? <p className="organization-finance-boundary"><strong>مرجع ثبت شد؛ بررسی منبع هنوز انجام نشده است.</strong> در این برش فقط مرجع دستور سازمان و روش ثبت‌شده نگهداری می‌شود. مبلغ، موجودی، مشمول یا نتیجه تخصیص مالی نمایش داده نمی‌شود.</p> : <section className="organization-detail-card organization-instruction-form"><h2>ثبت مرجع دستور تأمین مالی</h2><p>شماره نامه یا شناسه دستور رسمی صادرشده از سازمان را وارد کنید. فعلاً مبلغ و اطلاعات مشمولان در این فرم ثبت نمی‌شود.</p>
            {state.canSubmit ? <form onSubmit={submit}><label className="organization-field">شماره یا مرجع دستور منبع<input value={reference} onChange={event => setReference(event.target.value)} maxLength={160} required autoComplete="off" placeholder="مرجع ثبت‌شده در سازمان" /></label>{message && <p role="alert" className="organization-form-message">{message}</p>}<button className="organization-primary-button" type="submit" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت برای بررسی"}</button></form> : <p className="organization-notice">نقش این حساب اجازه ثبت دستور منبع ندارد؛ با مسئول دارای دسترسی هماهنگ شوید.</p>}
          </section>}
        </> : null}
      </section>
    </div>
  </main>;
}
