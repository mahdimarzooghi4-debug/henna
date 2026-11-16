"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrganizationPortalShell } from "./organization-portal";
import styles from "./organization-portal.module.css";

type AllocationMode = "HENNA_NEEDS_BASED" | "ORGANIZATION_DEFINED";
type Program = {
  programId: string;
  organizationId: string;
  organizationName?: string;
  name: string;
  allocationMode: AllocationMode;
  description: string;
  state: "DRAFT";
  revision: number;
  createdAtUtc: string;
};
type LoadState = { loading: boolean; programs: Program[]; error?: string };
const modeNames: Record<AllocationMode, string> = {
  HENNA_NEEDS_BASED: "نیازمحور حنا",
  ORGANIZATION_DEFINED: "تعریف‌شده توسط سازمان",
};

function errorMessage(value: unknown) {
  return value && typeof value === "object" && "message" in value && typeof value.message === "string"
    ? value.message
    : "دریافت طرح‌های سازمانی انجام نشد.";
}

export function OrganizationPrograms() {
  const [state, setState] = useState<LoadState>({ loading: true, programs: [] });
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/organization/programs", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !body || typeof body !== "object" || !("programs" in body) || !Array.isArray(body.programs)) {
          throw new Error(errorMessage(body));
        }
        if (!controller.signal.aborted) setState({ loading: false, programs: body.programs as Program[] });
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ loading: false, programs: [], error: error instanceof Error ? error.message : "ارتباط با سرویس سازمان برقرار نشد." });
      });
    return () => controller.abort();
  }, []);

  return <OrganizationPortalShell active="programs" title="مدیریت طرح‌ها و اعتبارها">
    <section className={styles.programPage} aria-label="لیست طرح‌های سازمانی" dir="rtl">
      <div className={styles.programCard}>
        <header className={styles.programHeader}>
          <h2>لیست طرح‌های سازمانی</h2>
          <div className={styles.programHeaderActions}>
            <Link className={styles.primaryButton} href="/organization/programs/new">
              <span aria-hidden="true">＋</span> ایجاد پیش‌نویس
            </Link>
            <div className={styles.programFilter}>
              <button type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen(value => !value)}>
                <span>فیلتر وضعیت</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.4v5.1l-3 1.5v-6.6L4 5Z"/></svg>
              </button>
              {filterOpen && <div className={styles.programFilterMenu} role="group" aria-label="وضعیت طرح">
                <span>پیش‌نویس</span>
              </div>}
            </div>
          </div>
        </header>
        {state.loading ? <p className={styles.programFormState} role="status">در حال دریافت طرح‌های سازمانی…</p>
          : state.error ? <div className={styles.programFormNotice} role="alert">{state.error}</div>
          : state.programs.length === 0 ? <div className={styles.programFormNotice}>
            <p>هنوز طرحی ثبت نشده است</p>
          </div>
          : <div className={styles.programTableWrap}>
            <table className={styles.programTable}>
              <colgroup><col className={styles.nameCol}/><col className={styles.typeCol}/><col className={styles.allocationCol}/><col className={styles.statusCol}/><col className={styles.dateCol}/><col className={styles.operationCol}/></colgroup>
              <thead><tr><th scope="col">نام طرح</th><th scope="col">نوع طرح</th><th scope="col">روش تخصیص</th><th scope="col">وضعیت</th><th scope="col">تاریخ ثبت</th><th scope="col">عملیات</th></tr></thead>
              <tbody>{state.programs.map(program => <tr key={program.programId}>
                <th scope="row">{program.name}</th>
                <td>طرح حمایتی</td>
                <td>{modeNames[program.allocationMode]}</td>
                <td><span className={`${styles.programStatus} ${styles.status2}`}>پیش‌نویس</span></td>
                <td>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(program.createdAtUtc))}</td>
                <td><div className={styles.programLinks}><div>
                  <Link href={`/organization/programs/${program.programId}`}>مشاهده جزئیات</Link>
                  <Link href={`/organization/programs/${program.programId}/funding-instruction`}>دستور تأمین</Link>
                  <Link href={`/organization/programs/${program.programId}/household-referrals`}>ارجاع خانوار</Link>
                </div></div></td>
              </tr>)}</tbody>
            </table>
          </div>}
      </div>
    </section>
  </OrganizationPortalShell>;
}
