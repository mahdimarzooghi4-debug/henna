"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type Program = { programId: string; organizationId: string; name: string; state: "DRAFT"; revision: number };
type Member = { genderCategory: string; lifeStage: string; educationLevel: string; healthNeed: string };
type Referral = { referralId: string; programId: string; externalReference: string; provinceId: string; cityId: string | null; settlementType: string; housingTenure: string | null; revision: number; submittedAtUtc: string; members: (Member & { memberNumber: number })[] };
type Option = { id: string; name: string; provinceId?: string };
const emptyMember = (): Member => ({ genderCategory: "NOT_REPORTED", lifeStage: "ADULT", educationLevel: "NOT_REPORTED", healthNeed: "NOT_REPORTED" });
const labels: Record<string, string> = { FEMALE: "زن", MALE: "مرد", NOT_REPORTED: "ثبت نشده", INFANT: "نوزاد", PRESCHOOL: "کودک پیش‌دبستانی", SCHOOL_AGE: "کودک مدرسه‌ای", ADULT: "بزرگسال", OLDER_ADULT: "سالمند", NO_FORMAL_EDUCATION: "بدون تحصیلات رسمی", PRIMARY: "ابتدایی", SECONDARY: "متوسطه", DIPLOMA: "دیپلم", HIGHER_EDUCATION: "تحصیلات عالی", NO_KNOWN_CHRONIC_NEED: "نیاز مزمن گزارش نشده", CHRONIC_NEED: "نیاز مزمن دارد" };
const isRecord = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);

export function OrganizationHouseholdReferrals({ programId }: { programId: string }) {
  const [program, setProgram] = useState<Program | null>(null);
  const [role, setRole] = useState("");
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [reference, setReference] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [cityId, setCityId] = useState("");
  const [settlementType, setSettlementType] = useState("URBAN");
  const [housingTenure, setHousingTenure] = useState("");
  const [members, setMembers] = useState<Member[]>([emptyMember()]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canSubmit = role === "ORG_LEAD" || role === "ORG_REPRESENTATIVE";
  const provinceNames = useMemo(() => new Map(provinces.map(x => [x.id, x.name])), [provinces]);
  const cityNames = useMemo(() => new Map(cities.map(x => [x.id, x.name])), [cities]);

  async function loadCities(selectedProvince: string, signal?: AbortSignal) {
    if (!selectedProvince) { setCities([]); return; }
    const response = await fetch(`/api/geography/cities?provinceId=${encodeURIComponent(selectedProvince)}`, { cache: "no-store", signal });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(body) || !Array.isArray(body.items) || body.items.some(x => !isRecord(x) || typeof x.id !== "string" || typeof x.name !== "string" || x.provinceId !== selectedProvince)) throw new Error("فهرست شهرهای قابل انتخاب در دسترس نیست.");
    setCities(body.items as Option[]);
  }

  async function load(signal?: AbortSignal) {
    setLoading(true); setMessage("");
    try {
      const [programResponse, profileResponse, provinceResponse, referralResponse] = await Promise.all([
        fetch("/api/organization/programs", { cache: "no-store", signal }), fetch("/api/organization/profiles", { cache: "no-store", signal }),
        fetch("/api/geography/provinces", { cache: "no-store", signal }), fetch(`/api/organization/programs/${programId}/household-referrals`, { cache: "no-store", signal }),
      ]);
      const [programBody, profileBody, provinceBody, referralBody] = await Promise.all([programResponse.json().catch(() => null), profileResponse.json().catch(() => null), provinceResponse.json().catch(() => null), referralResponse.json().catch(() => null)]);
      if (!programResponse.ok || !profileResponse.ok || !provinceResponse.ok || !referralResponse.ok || !isRecord(programBody) || !Array.isArray(programBody.programs) || !isRecord(profileBody) || !Array.isArray(profileBody.profiles) || !isRecord(provinceBody) || !Array.isArray(provinceBody.items) || !isRecord(referralBody) || !Array.isArray(referralBody.referrals)) throw new Error("اطلاعات طرح، دسترسی سازمان یا تقسیمات کشوری در دسترس نیست.");
      const found = programBody.programs.find((x): x is Program => isRecord(x) && x.programId === programId) as Program | undefined;
      if (!found || found.state !== "DRAFT") throw new Error("طرح پیدا نشد یا در این مرحله امکان ثبت ارجاع ندارد.");
      const profile = profileBody.profiles.find(x => isRecord(x) && x.organizationId === found.organizationId);
      if (!isRecord(profile) || typeof profile.memberRole !== "string") throw new Error("عضویت سازمانی فعال پیدا نشد.");
      if (signal?.aborted) return;
      setProgram(found); setRole(profile.memberRole); setProvinces(provinceBody.items as Option[]); setReferrals(referralBody.referrals as Referral[]);
    } catch (e) { if (!signal?.aborted) setMessage(e instanceof Error ? e.message : "داده‌ها در دسترس نیست."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [programId]);
  useEffect(() => { const controller = new AbortController(); void loadCities(provinceId, controller.signal).catch(e => { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "فهرست شهرها در دسترس نیست."); }); setCityId(""); return () => controller.abort(); }, [provinceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!program || !canSubmit || !reference.trim() || !provinceId || !housingTenure || settlementType === "URBAN" && !cityId || members.length < 1 || members.length > 20) { setMessage("اطلاعات خانوار را کامل کنید."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/organization/programs/${programId}/household-referrals`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ programRevision: program.revision, externalReference: reference.trim(), provinceId, cityId: cityId || null, settlementType, housingTenure, members }), cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(body) || !Array.isArray(body.members)) throw new Error(isRecord(body) && typeof body.message === "string" ? body.message : "ثبت ارجاع تأیید نشد.");
      setReferrals(current => [body as unknown as Referral, ...current]); setReference(""); setHousingTenure(""); setMembers([emptyMember()]);
    } catch (e) { setMessage(e instanceof Error ? e.message : "ثبت ارجاع تأیید نشد."); }
    finally { setBusy(false); }
  }

  const select = (label: string, value: string, onChange: (value: string) => void, options: string[]) => <label>{label}<select value={value} onChange={e => onChange(e.target.value)}>{options.map(option => <option key={option} value={option}>{labels[option] ?? option}</option>)}</select></label>;
  return <main className="organization-page organization-shell" dir="rtl">
    <aside className="organization-sidebar"><Link href="/organization" className="organization-brand"><img src="/hana-logo.png" alt="حنا"/><strong>پنل سازمان‌ها</strong></Link><nav aria-label="منوی سازمان"><Link href="/organization">داشبورد</Link><Link href="/organization/programs">طرح‌ها و اعتبارها</Link><Link className="is-active" href={`/organization/programs/${programId}/household-referrals`}>افراد و مشمولان</Link><span>تخصیص</span><span>وضعیت استفاده</span><span>گزارش‌ها</span></nav></aside>
    <div className="organization-main"><header className="organization-topbar"><span>سازمان همکار</span><h1>ارجاع خانوارها</h1></header><section className="organization-program-form-area" aria-live="polite">
      <div className="organization-form-card"><Link href="/organization/programs" className="organization-back-link">بازگشت به طرح‌ها</Link><h2>{program?.name ?? "ارجاع به طرح"}</h2><p>این فرم فقط داده‌های کیفی و مرجع داخلی سازمان را ثبت می‌کند؛ ثبت ارجاع به‌معنای تأیید استحقاق یا تخصیص اعتبار نیست.</p>
        {loading ? <p role="status">در حال دریافت اطلاعات…</p> : message && referrals.length === 0 ? <p className="organization-form-message" role="alert">{message}</p> : <>
          {canSubmit ? <form onSubmit={submit} className="organization-referral-form"><label>شناسه پرونده در سازمان<input value={reference} maxLength={120} onChange={e => setReference(e.target.value)} required /></label><p className="organization-form-hint">نام، کد ملی، شماره تماس و اطلاعات بانکی اعضا دریافت نمی‌شود.</p>
            <div className="organization-form-row"><label>استان<select aria-label="استان" required value={provinceId} onChange={e => setProvinceId(e.target.value)}><option value="">انتخاب استان</option>{provinces.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>نوع محل سکونت<select aria-label="نوع محل سکونت" value={settlementType} onChange={e => { setSettlementType(e.target.value); if (e.target.value === "RURAL") setCityId(""); }}><option value="URBAN">شهری</option><option value="RURAL">روستایی</option></select></label>{settlementType === "URBAN" ? <label>شهر<select aria-label="شهر" required value={cityId} onChange={e => setCityId(e.target.value)}><option value="">انتخاب شهر</option>{cities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label> : <p className="organization-form-hint">برای محل روستایی، شهر ثبت نمی‌شود؛ فقط استان و نوع سکونت ذخیره می‌شود.</p>}</div>
            <label>وضعیت سکونت<select aria-label="وضعیت سکونت" required value={housingTenure} onChange={e => setHousingTenure(e.target.value)}><option value="">انتخاب وضعیت</option><option value="OWNER">مالک</option><option value="TENANT">مستأجر</option></select></label><h3>ترکیب خانوار</h3>{members.map((member, i) => <fieldset className="organization-member-card" key={i}><legend>عضو {i + 1}</legend>{select("جنسیت", member.genderCategory, value => setMembers(current => current.map((m, index) => index === i ? { ...m, genderCategory: value } : m)), ["NOT_REPORTED", "FEMALE", "MALE"])}{select("گروه سنی", member.lifeStage, value => setMembers(current => current.map((m, index) => index === i ? { ...m, lifeStage: value } : m)), ["INFANT", "PRESCHOOL", "SCHOOL_AGE", "ADULT", "OLDER_ADULT"])}{select("تحصیلات", member.educationLevel, value => setMembers(current => current.map((m, index) => index === i ? { ...m, educationLevel: value } : m)), ["NOT_REPORTED", "NO_FORMAL_EDUCATION", "PRIMARY", "SECONDARY", "DIPLOMA", "HIGHER_EDUCATION"])}{select("وضعیت نیاز مزمن", member.healthNeed, value => setMembers(current => current.map((m, index) => index === i ? { ...m, healthNeed: value } : m)), ["NOT_REPORTED", "NO_KNOWN_CHRONIC_NEED", "CHRONIC_NEED"])}{members.length > 1 && <button type="button" className="organization-outline-button" onClick={() => setMembers(current => current.filter((_, index) => index !== i))}>حذف عضو</button>}</fieldset>)}
            {members.length < 20 && <button type="button" className="organization-outline-button" onClick={() => setMembers(current => [...current, emptyMember()])}>افزودن عضو</button>}
            {message && <p className="organization-form-message" role="alert">{message}</p>}<button type="submit" className="organization-primary-button" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت ارجاع خانوار"}</button></form> : <p role="status">نقش فنی فقط اجازه مشاهده دارد.</p>}
          <div className="organization-referral-list"><h3>ارجاع‌های ثبت‌شده ({referrals.length})</h3>{referrals.length === 0 ? <p>برای این طرح ارجاعی ثبت نشده است.</p> : referrals.map(item => <article className="organization-referral-item" key={item.referralId}><strong>{item.externalReference}</strong><span>{provinceNames.get(item.provinceId) ?? "استان ثبت‌شده"}{item.cityId ? `، ${cityNames.get(item.cityId) ?? "شهر ثبت‌شده"}` : "، محل روستایی"} · {item.settlementType === "URBAN" ? "شهری" : "روستایی"} · {item.housingTenure === "OWNER" ? "مالک" : item.housingTenure === "TENANT" ? "مستأجر" : "وضعیت مالکیت ثبت نشده"}</span><span>{item.members.length} عضو · {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(item.submittedAtUtc))}</span><span>ارجاع ثبت شده است؛ در این صفحه بررسی استحقاق یا تخصیص انجام نمی‌شود.</span></article>)}</div>
        </>}
      </div>
    </section></div>
  </main>;
}
