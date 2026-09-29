"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type Program = { programId: string; organizationId: string; name: string; state: "DRAFT"; revision: number };
type Member = { genderCategory: string; lifeStage: string; educationLevel: string; healthNeed: string; needsPracticalSupport: boolean | null };
type Referral = { referralId: string; programId: string; externalReference: string; provinceId: string; cityId: string | null; settlementType: string; housingTenure: string | null; healthBurdenLevel: string | null; economicHardshipLevel: string | null; careSupportLevel: string | null; educationAttainment: string | null; revision: number; submittedAtUtc: string; members: (Member & { memberNumber: number })[] };
type Option = { id: string; name: string; provinceId?: string };
const emptyMember = (): Member => ({ genderCategory: "NOT_REPORTED", lifeStage: "ADULT", educationLevel: "NOT_REPORTED", healthNeed: "NOT_REPORTED", needsPracticalSupport: false });
const labels: Record<string, string> = { FEMALE: "زن", MALE: "مرد", NOT_REPORTED: "ثبت نشده", INFANT: "نوزاد", PRESCHOOL: "کودک پیش‌دبستانی", SCHOOL_AGE: "کودک مدرسه‌ای", ADULT: "بزرگسال", OLDER_ADULT: "سالمند", NO_FORMAL_EDUCATION: "بدون تحصیلات رسمی", PRIMARY: "ابتدایی", SECONDARY: "متوسطه", DIPLOMA: "دیپلم", HIGHER_EDUCATION: "تحصیلات عالی", NO_KNOWN_CHRONIC_NEED: "نیاز مزمن گزارش نشده", CHRONIC_NEED: "نیاز مزمن دارد", OWNER: "مالک", TENANT: "مستأجر", NO_ONGOING_TREATMENT: "درمان مستمر گزارش نشده", ONE_MANAGEABLE_ONGOING_CASE: "یک مورد درمانی قابل مدیریت", HIGH_COST_OR_LIMITING_OR_MULTIPLE_MANAGEABLE_CASES: "درمان پرهزینه، محدودکننده یا چند مورد", SEVERE_ONGOING_CARE_OR_MULTIPLE_HIGH_BURDEN_CASES: "مراقبت مستمر شدید یا چند نیاز سنگین", ESSENTIAL_NEEDS_GENERALLY_MET: "نیازهای اساسی عموماً تأمین می‌شود", OCCASIONAL_SHORTFALL_IN_ONE_ESSENTIAL_NEED: "کمبود گاه‌به‌گاه در یک نیاز اساسی", RECURRENT_SHORTFALL_OR_ESSENTIAL_DEBT: "کمبود تکرارشونده یا بدهی ضروری", MULTIPLE_ESSENTIAL_NEEDS_UNMET_OR_SEVERE_INSTABILITY: "چند نیاز اساسی تأمین‌نشده یا بی‌ثباتی شدید", EFFECTIVE_ADULT_OR_PRACTICAL_SUPPORT_AVAILABLE: "حمایت بزرگسال یا عملی مؤثر در دسترس است", ONE_RESPONSIBLE_ADULT_WITHOUT_DEPENDENTS: "یک بزرگسال مسئول بدون فرد وابسته", LONE_CAREGIVER_WITH_ONE_DEPENDENT_OR_LIMITED_SUPPORT: "مراقب تنها با یک فرد وابسته یا حمایت محدود", NO_PRACTICAL_SUPPORT_WITH_MULTIPLE_DEPENDENTS_OR_HIGH_CARE_BURDEN: "بدون حمایت عملی، چند فرد وابسته یا بار مراقبتی بالا", BACHELOR_OR_HIGHER: "کارشناسی یا بالاتر", DIPLOMA_OR_ASSOCIATE: "دیپلم یا کاردانی", BELOW_DIPLOMA_WITH_FORMAL_EDUCATION: "کمتر از دیپلم با تحصیلات رسمی", NO_LITERACY_OR_FORMAL_EDUCATION: "بی‌سوادی یا بدون تحصیلات رسمی" };
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
  const [healthBurdenLevel, setHealthBurdenLevel] = useState("");
  const [economicHardshipLevel, setEconomicHardshipLevel] = useState("");
  const [careSupportLevel, setCareSupportLevel] = useState("");
  const [educationAttainment, setEducationAttainment] = useState("");
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
    if (!program || !canSubmit || !reference.trim() || !provinceId || !housingTenure || !healthBurdenLevel || !economicHardshipLevel || !careSupportLevel || !educationAttainment || settlementType === "URBAN" && !cityId || members.length < 1 || members.length > 20) { setMessage("اطلاعات خانوار را کامل کنید."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/organization/programs/${programId}/household-referrals`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ programRevision: program.revision, externalReference: reference.trim(), provinceId, cityId: cityId || null, settlementType, housingTenure, healthBurdenLevel, economicHardshipLevel, careSupportLevel, educationAttainment, members }), cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(body) || !Array.isArray(body.members)) throw new Error(isRecord(body) && typeof body.message === "string" ? body.message : "ثبت ارجاع تأیید نشد.");
      setReferrals(current => [body as unknown as Referral, ...current]); setReference(""); setHousingTenure(""); setHealthBurdenLevel(""); setEconomicHardshipLevel(""); setCareSupportLevel(""); setEducationAttainment(""); setMembers([emptyMember()]);
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
            <label>وضعیت سکونت<select aria-label="وضعیت سکونت" required value={housingTenure} onChange={e => setHousingTenure(e.target.value)}><option value="">انتخاب وضعیت</option><option value="OWNER">مالک</option><option value="TENANT">مستأجر</option></select></label><h3>ارزیابی کیفی خانوار</h3><div className="organization-form-row">{select("بار درمانی خانوار", healthBurdenLevel, setHealthBurdenLevel, ["NO_ONGOING_TREATMENT", "ONE_MANAGEABLE_ONGOING_CASE", "HIGH_COST_OR_LIMITING_OR_MULTIPLE_MANAGEABLE_CASES", "SEVERE_ONGOING_CARE_OR_MULTIPLE_HIGH_BURDEN_CASES"])}{select("سختی اقتصادی", economicHardshipLevel, setEconomicHardshipLevel, ["ESSENTIAL_NEEDS_GENERALLY_MET", "OCCASIONAL_SHORTFALL_IN_ONE_ESSENTIAL_NEED", "RECURRENT_SHORTFALL_OR_ESSENTIAL_DEBT", "MULTIPLE_ESSENTIAL_NEEDS_UNMET_OR_SEVERE_INSTABILITY"])}{select("حمایت و مراقبت", careSupportLevel, setCareSupportLevel, ["EFFECTIVE_ADULT_OR_PRACTICAL_SUPPORT_AVAILABLE", "ONE_RESPONSIBLE_ADULT_WITHOUT_DEPENDENTS", "LONE_CAREGIVER_WITH_ONE_DEPENDENT_OR_LIMITED_SUPPORT", "NO_PRACTICAL_SUPPORT_WITH_MULTIPLE_DEPENDENTS_OR_HIGH_CARE_BURDEN"])}{select("سطح تحصیلات خانوار", educationAttainment, setEducationAttainment, ["BACHELOR_OR_HIGHER", "DIPLOMA_OR_ASSOCIATE", "BELOW_DIPLOMA_WITH_FORMAL_EDUCATION", "NO_LITERACY_OR_FORMAL_EDUCATION"])}</div><h3>ترکیب خانوار</h3>{members.map((member, i) => <fieldset className="organization-member-card" key={i}><legend>عضو {i + 1}</legend>{select("جنسیت", member.genderCategory, value => setMembers(current => current.map((m, index) => index === i ? { ...m, genderCategory: value } : m)), ["NOT_REPORTED", "FEMALE", "MALE"])}{select("گروه سنی", member.lifeStage, value => setMembers(current => current.map((m, index) => index === i ? { ...m, lifeStage: value, needsPracticalSupport: value === "OLDER_ADULT" ? null : false } : m)), ["INFANT", "PRESCHOOL", "SCHOOL_AGE", "ADULT", "OLDER_ADULT"])}{select("تحصیلات", member.educationLevel, value => setMembers(current => current.map((m, index) => index === i ? { ...m, educationLevel: value } : m)), ["NOT_REPORTED", "NO_FORMAL_EDUCATION", "PRIMARY", "SECONDARY", "DIPLOMA", "HIGHER_EDUCATION"])}{select("وضعیت نیاز مزمن", member.healthNeed, value => setMembers(current => current.map((m, index) => index === i ? { ...m, healthNeed: value } : m)), ["NOT_REPORTED", "NO_KNOWN_CHRONIC_NEED", "CHRONIC_NEED"])}{member.lifeStage === "OLDER_ADULT" && <label>نیاز به حمایت عملی<select required aria-label={`نیاز به حمایت عملی عضو ${i + 1}`} value={member.needsPracticalSupport === null ? "" : String(member.needsPracticalSupport)} onChange={e => setMembers(current => current.map((m, index) => index === i ? { ...m, needsPracticalSupport: e.target.value === "" ? null : e.target.value === "true" } : m))}><option value="">انتخاب کنید</option><option value="true">نیاز دارد</option><option value="false">نیاز ندارد</option></select></label>}{members.length > 1 && <button type="button" className="organization-outline-button" onClick={() => setMembers(current => current.filter((_, index) => index !== i))}>حذف عضو</button>}</fieldset>)}
            {members.length < 20 && <button type="button" className="organization-outline-button" onClick={() => setMembers(current => [...current, emptyMember()])}>افزودن عضو</button>}
            {message && <p className="organization-form-message" role="alert">{message}</p>}<button type="submit" className="organization-primary-button" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت ارجاع خانوار"}</button></form> : <p role="status">نقش فنی فقط اجازه مشاهده دارد.</p>}
          <div className="organization-referral-list"><h3>ارجاع‌های ثبت‌شده ({referrals.length})</h3>{referrals.length === 0 ? <p>برای این طرح ارجاعی ثبت نشده است.</p> : referrals.map(item => <article className="organization-referral-item" key={item.referralId}><strong>{item.externalReference}</strong><span>{provinceNames.get(item.provinceId) ?? "استان ثبت‌شده"}{item.cityId ? `، ${cityNames.get(item.cityId) ?? "شهر ثبت‌شده"}` : "، محل روستایی"} · {item.settlementType === "URBAN" ? "شهری" : "روستایی"} · {item.housingTenure === "OWNER" ? "مالک" : item.housingTenure === "TENANT" ? "مستأجر" : "وضعیت مالکیت ثبت نشده"} · {item.healthBurdenLevel ? labels[item.healthBurdenLevel] : "بار درمانی ثبت نشده"} · {item.economicHardshipLevel ? labels[item.economicHardshipLevel] : "سختی اقتصادی ثبت نشده"} · {item.careSupportLevel ? labels[item.careSupportLevel] : "حمایت خانوادگی ثبت نشده"} · {item.educationAttainment ? labels[item.educationAttainment] : "تحصیلات خانوار ثبت نشده"}</span><span>{item.members.length} عضو · {new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(item.submittedAtUtc))}</span><span>ارجاع ثبت شده است؛ در این صفحه بررسی استحقاق یا تخصیص انجام نمی‌شود.</span></article>)}</div>
        </>}
      </div>
    </section></div>
  </main>;
}
