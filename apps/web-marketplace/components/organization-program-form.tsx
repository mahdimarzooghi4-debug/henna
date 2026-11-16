"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { OrganizationPortalShell } from "./organization-portal";
import styles from "./organization-portal.module.css";

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
  const [programKind, setProgramKind] = useState("");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<AllocationMode>("HENNA_NEEDS_BASED");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/organization/profiles", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (response.status === 401) { setPreviewMode(true); setLoading(false); return; }
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
    if (previewMode) { router.push(`/auth?returnTo=${encodeURIComponent("/organization/programs/new")}`); return; }
    if (!canCreate) { setMessage("نقش این حساب اجازه ثبت پیش‌نویس طرح را ندارد."); return; }
    if (!programKind || !source || !name.trim() || name.trim().length > 120 || description.length > 1200 || !allowedModes.includes(mode)) { setMessage("اطلاعات طرح را بررسی کنید."); return; }
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

  return <OrganizationPortalShell active="programs" title="ثبت طرح سازمانی جدید">
    <section className={styles.programFormPage} dir="rtl">
      <div className={styles.programFormCard}>
        <header className={styles.programFormHeader}>
          <h2>مشخصات اولیه طرح</h2>
          <p>مشخصات اولیه، الگوی تخصیص و دامنه افراد مشمول را مشخص نمایید.</p>
        </header>
        <div className={styles.programFormDivider}/>
        {loading ? <p role="status" className={styles.programFormState}>در حال بررسی عضویت سازمانی…</p> : loadError ? <div className={styles.programFormNotice} role="alert">{loadError}</div> : profiles.length === 0 && !previewMode ? <div className={styles.programFormNotice}>برای این حساب عضویت فعال سازمانی ثبت نشده است.</div> : !canCreate && !previewMode ? <div className={styles.programFormNotice}>نقش فعلی فقط امکان مشاهده دارد؛ برای ساخت پیش‌نویس با مدیر یا نمایندهٔ سازمان تماس بگیرید.</div> : <form className={styles.programForm} onSubmit={submit}>
          <div className={styles.programFormGrid}>
            <div className={styles.programFormRow}>
              <label className={styles.programFormField}>نوع اعتبار / برنامه
                <select value={programKind} onChange={(event) => setProgramKind(event.target.value)} required>
                  <option value="" disabled>انتخاب نوع اعتبار / برنامه</option>
                  <option value="credit">اعتبار نمونه</option>
                  <option value="program">برنامه حمایتی نمونه</option>
                </select>
              </label>
              <label className={styles.programFormField}>نام طرح
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="مثال: طرح نمونه ۱"/>
              </label>
            </div>
            <div className={styles.programFormRow}>
              <label className={styles.programFormField}>منبع افراد و مشمولان
                <select value={source} onChange={(event) => setSource(event.target.value)} required>
                  <option value="" disabled>انتخاب ورود دستی یا API / منبع داده سازمان</option>
                  <option value="manual">ورود دستی</option>
                  <option value="organization-api">API / منبع داده سازمان</option>
                </select>
              </label>
              <label className={styles.programFormField}>روش ثبت‌شده
                <select value={mode} onChange={(event) => setMode(event.target.value as AllocationMode)}>
                  <option value="HENNA_NEEDS_BASED">روش تخصیص: الگوی حنا</option>
                  <option value="ORGANIZATION_DEFINED">تعریف‌شده توسط سازمان</option>
                </select>
              </label>
            </div>
            <label className={styles.programFormField}>توضیحات و اهداف طرح
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={4} placeholder="شرح اهداف، نحوه استفاده و اطلاعات تکمیلی برای مشمولان طرح..."/>
            </label>
          </div>
          <p className={styles.programFormNote}>{previewMode ? "پیش‌نمایش طرح؛ برای ثبت پیش‌نویس وارد پنل سازمان شوید. نوع برنامه و منبع افراد در مرحله بعد پیکربندی خواهند شد." : "در ثبت اولیه، فقط نام طرح، روش تخصیص و توضیحات ذخیره می‌شود؛ نوع برنامه و منبع افراد در مرحله بعد پیکربندی خواهند شد."}</p>
          <div className={styles.programFormDivider}/>
          {message && <p className={styles.programFormMessage} role="alert">{message}</p>}
          <div className={styles.programFormActions}>
            <Link className={styles.outlineButton} href="/organization/programs">انصراف</Link>
            <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت اولیه طرح سازمانی"}</button>
          </div>
          <div className={styles.programFinanceBoundary}><b>ثبت اولیه طرح فقط یک پیش‌نویس می‌سازد.</b> این مرحله منبع مالی، مبلغ، کیف پول یا اعتبار ایجاد نمی‌کند.</div>
        </form>}
      </div>
    </section>
  </OrganizationPortalShell>;
}
