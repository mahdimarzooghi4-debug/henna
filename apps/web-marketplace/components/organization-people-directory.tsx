"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./organization-portal.module.css";

type PersonRow = {
  id: string;
  name: string;
  maskedId: string;
  match: "حساب حنا شناسایی شده" | "نیازمند تطبیق" | "در انتظار بررسی";
  source: "API / منبع داده سازمان" | "ورود دستی";
  program: "طرح نمونه ۱" | "طرح نمونه ۲" | "اعتبار نمونه";
  allocation: "تخصیص‌یافته" | "در انتظار اعتبار" | "تعریف نشده";
  usage: "استفاده شده" | "—";
};
const people: PersonRow[] = [
  { id: "person-1", name: "فرد نمونه ۱", maskedId: "۰۰۲****۳۲۱", match: "حساب حنا شناسایی شده", source: "API / منبع داده سازمان", program: "طرح نمونه ۱", allocation: "تخصیص‌یافته", usage: "استفاده شده" },
  { id: "person-2", name: "فرد نمونه ۲", maskedId: "۱۲۸****۸۹۰", match: "نیازمند تطبیق", source: "ورود دستی", program: "طرح نمونه ۲", allocation: "در انتظار اعتبار", usage: "—" },
  { id: "person-3", name: "فرد نمونه ۳", maskedId: "۰۴۵****۴۵۶", match: "در انتظار بررسی", source: "API / منبع داده سازمان", program: "اعتبار نمونه", allocation: "تعریف نشده", usage: "—" },
];

export function OrganizationPeopleDirectory() {
  const [allocation, setAllocation] = useState("همه وضعیت‌ها");
  const [source, setSource] = useState("همه منابع (API / دستی)");
  const [program, setProgram] = useState("");
  const [match, setMatch] = useState("همه وضعیت‌ها");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PersonRow | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return people.filter(person =>
      (allocation === "همه وضعیت‌ها" || person.allocation === allocation) &&
      (source === "همه منابع (API / دستی)" || person.source === source) &&
      (!program || person.program === program) &&
      (match === "همه وضعیت‌ها" || person.match === match) &&
      (!normalized || `${person.name} ${person.maskedId}`.toLocaleLowerCase().includes(normalized))
    );
  }, [allocation, source, program, match, query]);

  return <>
    <section className={styles.peopleDirectory} aria-label="فهرست افراد و مشمولان" dir="rtl">
      <header className={styles.peopleDirectoryHeader}>
        <div className={styles.peopleDirectoryTitle}>
          <h2>افراد و مشمولان طرح‌ها</h2>
          <p>تعریف افراد و افزودن مشمولان به طرح‌های سازمانی</p>
        </div>
        <Link className={styles.primaryButton} href="/organization/people/new">
          <span aria-hidden="true">＋</span> تعریف و افزودن مشمول
        </Link>
      </header>
      <div className={styles.peopleBanner}>
        ثبت فرد در منبع داده سازمان به معنای تخصیص اعتبار نیست. در صورت وجود حساب حنا، اطلاعات فرد با همان حساب تطبیق داده می‌شود.
      </div>
      <div className={styles.peopleFilters}>
        <label>وضعیت تخصیص<select value={allocation} onChange={event => setAllocation(event.target.value)}><option>همه وضعیت‌ها</option><option>تخصیص‌یافته</option><option>در انتظار اعتبار</option><option>تعریف نشده</option></select></label>
        <label>منبع ثبت<select value={source} onChange={event => setSource(event.target.value)}><option>همه منابع (API / دستی)</option><option>API / منبع داده سازمان</option><option>ورود دستی</option></select></label>
        <label>طرح مرتبط<select value={program} onChange={event => setProgram(event.target.value)}><option value="">انتخاب طرح</option><option>طرح نمونه ۱</option><option>طرح نمونه ۲</option><option>اعتبار نمونه</option></select></label>
        <label>وضعیت تطبیق حنا<select value={match} onChange={event => setMatch(event.target.value)}><option>همه وضعیت‌ها</option><option>حساب حنا شناسایی شده</option><option>نیازمند تطبیق</option><option>در انتظار بررسی</option></select></label>
        <label className={styles.peopleSearch}>جستجوی مشمول<input value={query} onChange={event => setQuery(event.target.value)} placeholder="نام، شناسه موردنیاز یا شناسه کاربری..." aria-label="جستجوی مشمول"/></label>
      </div>
      <div className={styles.peopleTableCard}>
        <div className={styles.peopleTableWrap}>
          <table className={styles.peopleTable}>
            <thead><tr><th>شخص / شناسه موردنیاز</th><th>وضعیت تطبیق با حنا</th><th>منبع ثبت</th><th>طرح مرتبط</th><th>وضعیت تخصیص</th><th>وضعیت استفاده</th><th>عملیات</th></tr></thead>
            <tbody>{filtered.map(person => <tr key={person.id}>
              <td><strong>{person.name}</strong><small>شناسه: {person.maskedId}</small></td>
              <td><span className={`${styles.peopleBadge} ${person.match === "حساب حنا شناسایی شده" ? styles.peopleBadgeTeal : person.match === "نیازمند تطبیق" ? styles.peopleBadgeSand : styles.peopleBadgeMuted}`}>{person.match}</span></td>
              <td>{person.source}</td><td>{person.program}</td>
              <td className={person.allocation === "در انتظار اعتبار" ? styles.peoplePending : person.allocation === "تخصیص‌یافته" ? styles.peopleTealText : styles.peopleMutedText}>{person.allocation}</td>
              <td className={person.usage === "استفاده شده" ? styles.peopleTealText : styles.peopleMutedText}>{person.usage}</td>
              <td><button type="button" className={styles.peopleView} onClick={() => setSelected(person)}>مشاهده</button></td>
            </tr>)}</tbody>
          </table>
          {filtered.length === 0 && <div className={styles.peopleEmpty}>فردی با این مشخصات پیدا نشد.</div>}
        </div>
      </div>
    </section>
    {selected && <div className={styles.peopleModalBackdrop} onClick={() => setSelected(null)}>
      <section className={styles.peopleModal} role="dialog" aria-modal="true" aria-labelledby="person-detail-title" onClick={event => event.stopPropagation()}>
        <button type="button" className={styles.peopleModalClose} onClick={() => setSelected(null)} aria-label="بستن">×</button>
        <h2 id="person-detail-title">جزئیات فرد مشمول</h2>
        <dl><div><dt>نام</dt><dd>{selected.name}</dd></div><div><dt>شناسه</dt><dd>{selected.maskedId}</dd></div><div><dt>وضعیت تطبیق با حنا</dt><dd>{selected.match}</dd></div><div><dt>منبع ثبت</dt><dd>{selected.source}</dd></div><div><dt>طرح مرتبط</dt><dd>{selected.program}</dd></div><div><dt>وضعیت تخصیص</dt><dd>{selected.allocation}</dd></div><div><dt>وضعیت استفاده</dt><dd>{selected.usage}</dd></div></dl>
      </section>
    </div>}
  </>;
}
