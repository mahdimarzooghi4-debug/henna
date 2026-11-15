"use client";

import Link from "next/link";
import { useState } from "react";
import { OrganizationPortalShell } from "./organization-portal";
import styles from "./organization-portal.module.css";

type ProgramStatus = "فعال" | "ثبت‌شده" | "پیش‌نویس" | "متوقف" | "پایان‌یافته";
type ProgramSample = { id: string; name: string; type: string; allocation: string; status: ProgramStatus; date: string };
const samplePrograms: ProgramSample[] = [
  { id: "sample-plan-1", name: "طرح نمونه ۱", type: "اعتبار نمونه", allocation: "الگوی حنا", status: "فعال", date: "تاریخ نمونه" },
  { id: "sample-plan-2", name: "طرح نمونه ۲", type: "برنامه حمایتی نمونه", allocation: "الگوی حنا", status: "ثبت‌شده", date: "تاریخ نمونه" },
  { id: "sample-plan-3", name: "برنامه حمایتی نمونه", type: "اعتبار نمونه", allocation: "الگوی حنا", status: "پیش‌نویس", date: "تاریخ نمونه" },
  { id: "sample-plan-4", name: "طرح نمونه ۱", type: "برنامه حمایتی نمونه", allocation: "الگوی حنا", status: "متوقف", date: "تاریخ نمونه" },
  { id: "sample-plan-5", name: "طرح نمونه ۲", type: "اعتبار نمونه", allocation: "الگوی حنا", status: "پایان‌یافته", date: "تاریخ نمونه" },
];
const statusOptions: Array<"همه وضعیت‌ها" | ProgramStatus> = ["همه وضعیت‌ها", "فعال", "ثبت‌شده", "پیش‌نویس", "متوقف", "پایان‌یافته"];

export function OrganizationPrograms() {
  const [statusFilter, setStatusFilter] = useState<typeof statusOptions[number]>("همه وضعیت‌ها");
  const [filterOpen, setFilterOpen] = useState(false);
  const visiblePrograms = samplePrograms.filter(program => statusFilter === "همه وضعیت‌ها" || program.status === statusFilter);

  return <OrganizationPortalShell active="programs" title="مدیریت طرح‌ها و اعتبارها">
    <section className={styles.programPage} aria-label="لیست طرح‌های سازمانی">
      <div className={styles.programCard}>
        <header className={styles.programHeader}>
          <div className={styles.programFilter}>
            <button type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen(value => !value)}>
              <span>فیلتر وضعیت</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16l-6.5 7.4v5.1l-3 1.5v-6.6L4 5Z"/></svg>
            </button>
            {filterOpen && <div className={styles.programFilterMenu} role="group" aria-label="انتخاب وضعیت">
              {statusOptions.map(option => <button type="button" key={option} aria-pressed={statusFilter === option} onClick={() => { setStatusFilter(option); setFilterOpen(false); }}>{option}</button>)}
            </div>}
          </div>
          <h2>لیست طرح‌های سازمانی</h2>
        </header>
        <div className={styles.programTableWrap}>
          <table className={styles.programTable}>
            <colgroup><col className={styles.operationCol}/><col className={styles.dateCol}/><col className={styles.statusCol}/><col className={styles.allocationCol}/><col className={styles.typeCol}/><col/></colgroup>
            <thead><tr><th scope="col">عملیات</th><th scope="col">تاریخ ثبت</th><th scope="col">وضعیت</th><th scope="col">روش تخصیص</th><th scope="col">نوع طرح</th><th scope="col">نام طرح</th></tr></thead>
            <tbody>{visiblePrograms.map((program, index) => <tr key={`${program.name}-${program.status}-${index}`}>
              <td><Link className={styles.programDetailsLink} href={`/organization/programs/${program.id}`}>مشاهده جزئیات</Link></td>
              <td>{program.date}</td>
              <td><span className={`${styles.programStatus} ${styles[`status${statusOptions.indexOf(program.status)}`]}`}>{program.status}</span></td>
              <td>{program.allocation}</td>
              <td>{program.type}</td>
              <th scope="row">{program.name}</th>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>

  </OrganizationPortalShell>;
}
