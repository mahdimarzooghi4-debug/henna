"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AdminRow } from "./admin-pages";

type Props = { columns: string[]; rows: AdminRow[] };
type StatusFilter = "all" | "active" | "review";

const filters: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "active", label: "فعال" },
  { id: "review", label: "در انتظار بررسی" },
];

export default function AdminOrganizationsListing({ columns, rows }: Props) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => rows.filter((item) => {
    const statusValue = item.cells.at(-2) ?? "";
    const matchesStatus = status === "all"
      || (status === "active" && statusValue === "فعال")
      || (status === "review" && statusValue.includes("انتظار بررسی"));
    return matchesStatus && item.cells.join(" ").toLocaleLowerCase("fa-IR").includes(query.trim().toLocaleLowerCase("fa-IR"));
  }), [query, rows, status]);
  const gridTemplateColumns = `repeat(${columns.length - 1}, minmax(120px, 1fr)) minmax(120px, 1fr)`;

  return <>
    <div className="admin-filters" aria-label="فیلترهای سازمان‌ها">
      {filters.map((filter) => <button
        aria-pressed={status === filter.id}
        className={`admin-filter${status === filter.id ? " admin-filter--active" : ""}`}
        key={filter.id}
        onClick={() => setStatus(filter.id)}
        type="button"
      >{filter.label}</button>)}
      <input
        className="admin-search"
        aria-label="جستجو در سازمان‌ها"
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder="جستجو در سازمان‌ها..."
        type="search"
        value={query}
      />
    </div>
    <section className="admin-table-card">
      <div className="admin-table-scroll">
        <div className="admin-table admin-generic-table admin-organizations__table">
          <div className="admin-table__row admin-table__head" style={{ gridTemplateColumns }}>
            {columns.map((column) => <span key={column}>{column}</span>)}
          </div>
          {filteredRows.map((item, index) => <div className="admin-table__row" key={item.href} style={{ gridTemplateColumns }}>
            {item.cells.slice(0, -1).map((cell, cellIndex) => <span className={cellIndex === 0 ? "admin-generic-table__primary" : ""} key={`${index}-${cellIndex}`}>{cell}</span>)}
            <span><Link className="admin-row-link" href={item.href}>{item.cells.at(-1)}</Link></span>
          </div>)}
          {filteredRows.length === 0 && <p className="admin-organizations__empty">سازمانی با این فیلتر پیدا نشد.</p>}
        </div>
      </div>
      <p className="admin-sample-note">اطلاعات این صفحه نمونه‌ای است و به داده‌های واقعی سامانه متصل نیست.</p>
    </section>
  </>;
}
