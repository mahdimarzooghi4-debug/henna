"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type Role = "ORG_LEAD" | "ORG_REPRESENTATIVE" | "ORG_TECHNICAL_OPERATOR";
type Profile = { organizationId: string; organizationName: string; memberRole: Role; membershipId: string };
type AllocationMode = "HENNA_NEEDS_BASED" | "ORGANIZATION_DEFINED";
const allowedModes: AllocationMode[] = ["HENNA_NEEDS_BASED", "ORGANIZATION_DEFINED"];

export function OrganizationProgramForm() {
  const router = useRouter();
  const idempotency = useRef<{ fingerprint: string; key: string } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<AllocationMode>("HENNA_NEEDS_BASED");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/organization/profiles", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok || !body || typeof body !== "object" || !("profiles" in body) || !Array.isArray(body.profiles)) {
        setLoadError(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "اطلاعات عضویت سازمانی در دسترس نیست.");
        setLoading(false); return;
      }
      const next = body.profiles as Profile[];
      setProfiles(next); setOrganizationId(next[0]?.organizationId ?? ""); setLoading(false);
    }).catch(() => { if (!controller.signal.aborted) { setLoadError("ارتباط با سرویس سازمان برقرار نشد."); setLoading(false); } });
    return () => controller.abort();
  }, []);

  const selectedProfile = profiles.find((profile) => profile.organizationId === organizationId);
  const canCreate = selectedProfile?.memberRole === "ORG_LEAD" || selectedProfile?.memberRole === "ORG_REPRESENTATIVE";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (!canCreate) { setMessage("نقش این حساب اجازه ثبت پیش‌نویس طرح را ندارد."); return; }
    if (!name.trim() || name.trim().length > 120 || description.length > 1200 || !allowedModes.includes(mode)) { setMessage("اطلاعات طرح را بررسی کنید."); return; }
    const payload = { organizationId, name: name.trim(), allocationMode: mode, description: description.trim() };
    const fingerprint = JSON.stringify(payload);
    if (!idempotency.current || idempotency.current.fingerprint !== fingerprint) idempotency.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    try {
      const response = await fetch("/api/organization/programs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotency.current.key }, body: fingerprint, cache: "no-store" });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) { setMessage(body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "ثبت پیش‌نویس انجام نشد."); return; }
      router.push("/organization/programs");
    } catch { setMessage("ارتباط با سرویس سازمان برقرار نشد؛ برای تلاش دوباره همین اطلاعات را نگه دارید."); }
    finally { setBusy(false); }
  }

  return <main className="organization-page organization-shell" dir="rtl">
    <aside className="organization-sidebar">
      <Link href="/organization" className="organization-brand"><img src="/hana-logo.png" alt="حنا" /><strong>پنل سازمان‌ها</strong></Link>
      <nav aria-label="منوی سازمان"><Link href="/organization">داشبورد</Link><Link className="is-active" href="/organization/programs">طرح‌ها و اعتبارها</Link><span>افراد و مشمولان</span><span>تخصیص</span><span>وضعیت استفاده</span><span>منابع داده و API</span><span>گزارش‌ها</span><span>اعلانات</span><span>اطلاعات سازمان</span><span>پشتیبانی</span><span>تنظیمات</span></nav>
    </aside>
    <div className="organization-main">
      <header className="organization-topbar"><span>سازمان همکار</span><h1>ثبت طرح سازمانی</h1></header>
      <section className="organization-program-form-area">
        <div className="organization-form-card"><Link className="organization-back-link" href="/organization/programs">بازگشت به طرح‌ها و اعتبارها</Link><h2>فرم راه‌اندازی و پیکربندی طرح اعتباری</h2><p className="organization-form-intro">این انتخاب برای منابعی است که سازمان در اختیار حنا می‌گذارد. منبع صندوق نیکوکاری حنا فقط با مدل حنا تخصیص می‌یابد و روش آن را سازمان تعیین نمی‌کند.</p>
          {loading ? <p role="status">در حال بررسی عضویت سازمانی…</p> : loadError ? <div className="organization-notice">{loadError}</div> : profiles.length === 0 ? <div className="organization-notice">برای این حساب عضویت فعال سازمانی ثبت نشده است.</div> : !canCreate ? <div className="organization-notice">نقش فعلی فقط امکان مشاهده دارد؛ برای ساخت پیش‌نویس با مدیر یا نمایندهٔ سازمان تماس بگیرید.</div> : <form onSubmit={submit}>
            {profiles.length > 1 && <label className="organization-field">سازمان<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{profiles.map((profile) => <option key={profile.membershipId} value={profile.organizationId}>{profile.organizationName}</option>)}</select></label>}
            <label className="organization-field">نام طرح<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="نام طرح را وارد کنید" /></label>
            <fieldset className="organization-mode-fieldset"><legend>روش همکاری در تخصیص</legend>
              <label className="organization-mode-option"><input type="radio" name="allocationMode" value="HENNA_NEEDS_BASED" checked={mode === "HENNA_NEEDS_BASED"} onChange={() => setMode("HENNA_NEEDS_BASED")} /><span><strong>محاسبه بر اساس مدل حنا</strong><small>حنا سهم هر خانوار را با فرمول و ضرایب نسخه‌دار محاسبه می‌کند.</small></span></label>
              <label className="organization-mode-option"><input type="radio" name="allocationMode" value="ORGANIZATION_DEFINED" checked={mode === "ORGANIZATION_DEFINED"} onChange={() => setMode("ORGANIZATION_DEFINED")} /><span><strong>تخصیص توسط سازمان</strong><small>سازمان مبلغ هر مشمول را تعیین می‌کند؛ محاسبه نیازمحور حنا روی آن اعمال نمی‌شود.</small></span></label>
            </fieldset>
            <label className="organization-field">توضیحات و اهداف طرح<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={5} placeholder="توضیحات طرح را وارد کنید" /></label>
            <div className="organization-finance-boundary"><strong>انتخاب روش هنوز تخصیص اعتبار نیست</strong><p>مالک منبع و روش انتخابی باید در دستور تأمین مالی طرح تأیید شوند. این پیش‌نویس منبع مالی، مبلغ، کیف پول یا اعتبار مشمولان را ایجاد نمی‌کند.</p></div>
            {message && <p className="organization-form-message" role="alert">{message}</p>}
            <div className="organization-form-actions"><Link className="organization-outline-button" href="/organization/programs">انصراف</Link><button className="organization-primary-button" type="submit" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت پیش‌نویس طرح"}</button></div>
          </form>}
        </div>
      </section>
    </div>
  </main>;
}
