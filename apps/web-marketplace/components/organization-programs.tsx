"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AllocationMode = "HENNA_NEEDS_BASED" | "ORGANIZATION_DEFINED";
type Program = { programId: string; organizationId: string; organizationName: string; name: string; allocationMode: AllocationMode; description: string; state: "DRAFT"; revision: 1; createdAtUtc: string };
const modeLabels: Record<AllocationMode, string> = { HENNA_NEEDS_BASED: "محاسبه بر اساس مدل حنا", ORGANIZATION_DEFINED: "تخصیص توسط سازمان" };

export function OrganizationPrograms() {
  const [state, setState] = useState<{ loading: boolean; programs: Program[]; message?: string }>({ loading: true, programs: [] });
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

  return <main className="organization-page organization-shell" dir="rtl">
    <aside className="organization-sidebar">
      <Link href="/organization" className="organization-brand"><img src="/hana-logo.png" alt="حنا" /><strong>پنل سازمان‌ها</strong></Link>
      <nav aria-label="منوی سازمان">
        <Link href="/organization">داشبورد</Link><Link className="is-active" href="/organization/programs">طرح‌ها و اعتبارها</Link>
        <Link href="/organization/programs">افراد و مشمولان</Link><span>تخصیص</span><span>وضعیت استفاده</span><span>منابع داده و API</span><span>گزارش‌ها</span><span>اعلانات</span><span>اطلاعات سازمان</span><span>پشتیبانی</span><span>تنظیمات</span>
      </nav>
    </aside>
    <div className="organization-main">
      <header className="organization-topbar"><span>سازمان همکار</span><h1>مدیریت طرح‌ها و اعتبارها</h1></header>
      <section className="organization-programs-content" aria-live="polite">
        <div className="organization-section-head"><div><h2>فهرست طرح‌های سازمانی</h2><p>روش همکاری هر طرح هنگام ایجاد آن مشخص می‌شود.</p></div><Link className="organization-primary-button" href="/organization/programs/new">ثبت طرح جدید</Link></div>
        {state.loading ? <p role="status">در حال دریافت طرح‌ها…</p> : state.message ? <div className="organization-notice">{state.message}</div> : state.programs.length === 0 ? <div className="organization-empty"><h3>هنوز طرحی ثبت نشده است</h3><p>برای شروع، یک پیش‌نویس بسازید و روش همکاری را انتخاب کنید.</p><Link className="organization-outline-button" href="/organization/programs/new">ایجاد پیش‌نویس</Link></div> : <div className="organization-table-wrap"><table className="organization-table"><thead><tr><th>نام طرح</th><th>سازمان</th><th>روش همکاری</th><th>وضعیت</th><th>تاریخ ثبت</th><th>عملیات</th></tr></thead><tbody>{state.programs.map((program) => <tr key={program.programId}><td>{program.name}</td><td>{program.organizationName}</td><td>{modeLabels[program.allocationMode]}</td><td><span className="organization-draft-badge">پیش‌نویس</span></td><td>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(program.createdAtUtc))}</td><td><Link className="organization-muted-action" href={`/organization/programs/${program.programId}/household-referrals`}>افراد و مشمولان</Link> · <Link className="organization-muted-action" href={`/organization/programs/${program.programId}/funding-instruction`}>جزئیات و دستور منبع</Link></td></tr>)}</tbody></table></div>}
        <div className="organization-finance-boundary"><strong>پیش‌نویس، تخصیص مالی ایجاد نمی‌کند</strong><p>تأمین اعتبار و آغاز تخصیص پس از ثبت دستور منبع، بررسی مجوز روش انتخاب‌شده و آماده‌شدن اطلاعات مشمولان انجام می‌شود.</p></div>
      </section>
    </div>
  </main>;
}
