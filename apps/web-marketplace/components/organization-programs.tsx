"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrganizationPortalShell } from "./organization-portal";

type AllocationMode = "HENNA_NEEDS_BASED" | "ORGANIZATION_DEFINED";
type Program = { programId: string; organizationId: string; organizationName: string; name: string; allocationMode: AllocationMode; description: string; state: "DRAFT"; revision: 1; createdAtUtc: string };
const modeLabels: Record<AllocationMode, string> = { HENNA_NEEDS_BASED: "مدل نیازمحور حنا", ORGANIZATION_DEFINED: "تعریف‌شده توسط سازمان" };

export function OrganizationPrograms() {
  const [state, setState] = useState<{ loading: boolean; programs: Program[]; message?: string }>({ loading: true, programs: [] });
  const [statusFilter, setStatusFilter] = useState("ALL");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/organization/programs", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body: unknown = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok || !body || typeof body !== "object" || !("programs" in body) || !Array.isArray(body.programs)) {
        setState({ loading: false, programs: [], message: body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "فهرست طرح‌ها در دسترس نیست." });
        return;
      }
      setState({ loading: false, programs: body.programs as Program[] });
    }).catch(() => { if (!controller.signal.aborted) setState({ loading: false, programs: [], message: "ارتباط با سرویس سازمان برقرار نشد." }); });
    return () => controller.abort();
  }, []);

  return <OrganizationPortalShell active="programs" title="مدیریت طرح‌ها و اعتبارها">
      <section className="organization-programs-content" aria-live="polite">
        <div className="organization-section-head"><h2>لیست طرح‌های سازمانی</h2><div className="organization-program-actions"><label>فیلتر وضعیت<select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="ALL">همه وضعیت‌ها</option><option value="DRAFT">پیش‌نویس</option></select></label><Link className="organization-primary-button" href="/organization/programs/new">ثبت طرح جدید</Link></div></div>
        {state.loading ? <p role="status">در حال دریافت طرح‌ها…</p> : state.message ? <div className="organization-notice">{state.message}</div> : state.programs.length === 0 ? <div className="organization-empty"><h3>هنوز طرحی ثبت نشده است</h3><p>برای شروع، یک پیش‌نویس بسازید و روش همکاری را انتخاب کنید.</p><Link className="organization-outline-button" href="/organization/programs/new">ایجاد پیش‌نویس</Link></div> : <div className="organization-table-wrap"><table className="organization-table"><thead><tr><th>نام طرح</th><th>سازمان</th><th>روش تخصیص ثبت‌شده</th><th>وضعیت</th><th>تاریخ ثبت</th><th>عملیات</th></tr></thead><tbody>{state.programs.filter(program => statusFilter === "ALL" || program.state === "DRAFT").map((program) => <tr key={program.programId}><td>{program.name}</td><td>{program.organizationName}</td><td>{modeLabels[program.allocationMode]}</td><td><span className="organization-draft-badge">پیش‌نویس</span></td><td>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(program.createdAtUtc))}</td><td><Link className="organization-muted-action" href={`/organization/programs/${program.programId}`}>جزئیات طرح</Link> · <Link className="organization-muted-action" href={`/organization/programs/${program.programId}/funding-instruction`}>دستور تأمین</Link> · <Link className="organization-muted-action" href={`/organization/programs/${program.programId}/household-referrals`}>ارجاع خانوار</Link></td></tr>)}</tbody></table></div>}
        <div className="organization-finance-boundary"><strong>پیش‌نویس، تخصیص مالی ایجاد نمی‌کند</strong><p>انتخاب مدل برای منبع سازمانی است. منابع صندوق نیکوکاری حنا فقط با مدل حنا تخصیص می‌یابند و مالکیت منبع از اطلاعات سازمان استنباط نمی‌شود. دستور منبع باید روش مجاز را جداگانه بررسی کند؛ ثبت آن هم به‌تنهایی وصول وجه یا تخصیص نیست.</p></div>
      </section>
  </OrganizationPortalShell>;
}
