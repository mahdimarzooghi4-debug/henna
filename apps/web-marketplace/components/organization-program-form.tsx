"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { OrganizationPortalShell } from "./organization-portal";

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

  return <OrganizationPortalShell active="programs" title="ثبت طرح سازمانی">
      <section className="organization-program-form-area">
        <div className="organization-form-card"><h2>فرم ثبت پیش‌نویس طرح</h2><p className="organization-form-intro">فقط نام، روش ثبت‌شده و توضیحات در این مرحله ذخیره می‌شوند.</p>
          {loading ? <p role="status">در حال بررسی عضویت سازمانی…</p> : loadError ? <div className="organization-notice">{loadError}</div> : profiles.length === 0 ? <div className="organization-notice">برای این حساب عضویت فعال سازمانی ثبت نشده است.</div> : !canCreate ? <div className="organization-notice">نقش فعلی فقط امکان مشاهده دارد؛ برای ساخت پیش‌نویس با مدیر یا نمایندهٔ سازمان تماس بگیرید.</div> : <form onSubmit={submit}>
            {profiles.length > 1 && <label className="organization-field">سازمان<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{profiles.map((profile) => <option key={profile.membershipId} value={profile.organizationId}>{profile.organizationName}</option>)}</select></label>}
            <div className="organization-form-grid">
              <label className="organization-field">نام طرح<input aria-label="نام طرح" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="مثال: طرح تغذیه خانوار" /></label>
              <label className="organization-field">روش ثبت‌شده<select aria-label="روش ثبت‌شده" value={mode} onChange={(event) => setMode(event.target.value as AllocationMode)}><option value="HENNA_NEEDS_BASED">نیازمحور حنا</option><option value="ORGANIZATION_DEFINED">تعریف‌شده توسط سازمان</option></select></label>
            </div>
            <label className="organization-field">توضیحات و اهداف طرح<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={5} placeholder="توضیحات طرح را وارد کنید" /></label>
            <div className="organization-finance-boundary"><strong>این مرحله فقط پیش‌نویس می‌سازد</strong><p>انتخاب روش به‌تنهایی اجازهٔ تخصیص نیست. پیش‌نویس منبع مالی، مبلغ، کیف پول یا اعتبار ایجاد نمی‌کند. صندوق نیکوکاری حنا فقط با روش نیازمحور حنا کار می‌کند؛ منبع و اختیار آن باید جداگانه بررسی شود.</p></div>
            {message && <p className="organization-form-message" role="alert">{message}</p>}
            <div className="organization-form-actions"><Link className="organization-outline-button" href="/organization/programs">انصراف</Link><button className="organization-primary-button" type="submit" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت اولیه طرح سازمانی"}</button></div>
          </form>}
        </div>
      </section>
  </OrganizationPortalShell>;
}
