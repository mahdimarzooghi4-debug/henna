"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./admin-sellers-listing.module.css";

type Seller = {
  name: string;
  owner: string;
  area: "کشوری" | "محلی";
  category: string;
  sellerStatus: "تأیید شده" | "در انتظار بررسی";
  accountStatus: "فعال" | "غیرفعال";
  href: string;
};

const sellers: Seller[] = [
  { name: "کسب‌وکار نمونه", owner: "مسئول نمونه", area: "کشوری", category: "پوشاک و هنر سنتی", sellerStatus: "تأیید شده", accountStatus: "فعال", href: "/admin/panel/sellers/sample-seller" },
  { name: "فروشگاه نمونه", owner: "مدیر فروشگاه", area: "محلی", category: "مواد غذایی", sellerStatus: "تأیید شده", accountStatus: "فعال", href: "/admin/panel/sellers/second-seller" },
];

export default function AdminSellersListing() {
  const [category, setCategory] = useState("همه");
  const [status, setStatus] = useState("همه");
  const [area, setArea] = useState("همه");
  const [query, setQuery] = useState("");

  const visibleSellers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fa-IR");
    return sellers.filter(seller =>
      (category === "همه" || seller.category === category) &&
      (status === "همه" || seller.accountStatus === status) &&
      (area === "همه" || seller.area === area) &&
      (!normalizedQuery || `${seller.name} ${seller.owner}`.toLocaleLowerCase("fa-IR").includes(normalizedQuery))
    );
  }, [category, status, area, query]);

  return <div className={styles.page}>
    <header className={styles.heading}>
      <h1>فروشندگان</h1>
      <p>نمایش و بررسی اطلاعات فروشگاه‌های فعال در بازارگاه حنا</p>
    </header>

    <div className={styles.filters} aria-label="فیلترهای فروشندگان">
      <label className={styles.select}><span className={styles.srOnly}>دسته‌بندی</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="همه">دسته‌بندی: همه</option><option>پوشاک و هنر سنتی</option><option>مواد غذایی</option></select></label>
      <label className={styles.select}><span className={styles.srOnly}>وضعیت حساب</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="همه">وضعیت حساب: همه</option><option>فعال</option><option>غیرفعال</option></select></label>
      <label className={styles.select}><span className={styles.srOnly}>محدوده فعالیت</span><select value={area} onChange={event => setArea(event.target.value)}><option value="همه">محدوده فعالیت: همه</option><option>کشوری</option><option>محلی</option></select></label>
      <input className={styles.search} aria-label="جستجوی شناسه یا عنوان کسب‌وکار" placeholder="جستجوی شناسه یا عنوان کسب‌وکار..." value={query} onChange={event => setQuery(event.target.value)} />
    </div>

    <section className={styles.tableCard} aria-label="فهرست فروشندگان">
      <div className={styles.tableScroll}>
        <div className={styles.table} role="table" aria-label="فهرست فروشندگان">
          <div className={`${styles.row} ${styles.head}`} role="row">
            {["عملیات", "وضعیت حساب", "وضعیت فروشندگی", "دسته‌بندی", "محدوده فعالیت", "صاحب حساب", "نام کسب‌وکار"].map(label => <span role="columnheader" key={label}>{label}</span>)}
          </div>
          {visibleSellers.map(seller => <div className={styles.row} role="row" key={seller.href}>
            <span role="cell"><Link className={styles.action} href={seller.href}>جزئیات</Link></span>
            <span role="cell"><i className={styles.active}>فعال</i></span>
            <span role="cell" className={seller.sellerStatus === "تأیید شده" ? styles.approved : styles.pending}>{seller.sellerStatus}</span>
            <span role="cell">{seller.category}</span>
            <span role="cell">{seller.area}</span>
            <span role="cell">{seller.owner}</span>
            <strong role="cell">{seller.name}</strong>
          </div>)}
          {visibleSellers.length === 0 && <p className={styles.empty}>فروشنده‌ای با این مشخصات پیدا نشد.</p>}
        </div>
      </div>
      <p className={styles.note}>اطلاعات این صفحه برای نمایش ساختار مدیریت فروشگاه‌ها نمونه‌سازی شده است.</p>
    </section>
  </div>;
}
