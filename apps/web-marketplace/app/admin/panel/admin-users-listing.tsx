"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type UserAccount = {
  id: string;
  name: string;
  type: "شخص حقیقی" | "شخص حقوقی";
  identity: "تأیید شده" | "تأیید نشده";
  seller: "فعال" | "غیرفعال";
  support: "شناسایی شده" | "ثبت نشده";
  href: string;
};

const accounts: UserAccount[] = [
  { id: "USR-109", name: "کاربر نمونه یک", type: "شخص حقیقی", identity: "تأیید شده", seller: "فعال", support: "شناسایی شده", href: "/admin/panel/users/sample-account" },
  { id: "USR-110", name: "شرکت نمونه", type: "شخص حقوقی", identity: "تأیید نشده", seller: "غیرفعال", support: "ثبت نشده", href: "/admin/panel/users/sample-business" },
];

export default function AdminUsersListing() {
  const [accountType, setAccountType] = useState("همه");
  const [identity, setIdentity] = useState("همه");
  const [sellerStatus, setSellerStatus] = useState("همه");
  const [query, setQuery] = useState("");

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fa-IR");
    return accounts.filter(account =>
      (accountType === "همه" || account.type === accountType) &&
      (identity === "همه" || account.identity === identity) &&
      (sellerStatus === "همه" || account.seller === sellerStatus) &&
      (!normalizedQuery || `${account.id} ${account.name}`.toLocaleLowerCase("fa-IR").includes(normalizedQuery))
    );
  }, [accountType, identity, sellerStatus, query]);

  return <div className="admin-users">
    <div className="admin-users__filters" aria-label="فیلتر حساب‌های کاربری">
      <label className="admin-users__select"><span className="sr-only">نوع حساب</span><select value={accountType} onChange={event => setAccountType(event.target.value)}><option value="همه">نوع حساب: همه</option><option>شخص حقیقی</option><option>شخص حقوقی</option></select></label>
      <label className="admin-users__select"><span className="sr-only">وضعیت هویتی</span><select value={identity} onChange={event => setIdentity(event.target.value)}><option value="همه">وضعیت هویتی: همه</option><option>تأیید شده</option><option>تأیید نشده</option></select></label>
      <label className="admin-users__select"><span className="sr-only">وضعیت فروشنده</span><select value={sellerStatus} onChange={event => setSellerStatus(event.target.value)}><option value="همه">وضعیت فروشنده: همه</option><option>فعال</option><option>غیرفعال</option></select></label>
      <input className="admin-users__search" aria-label="جستجو بر اساس نام یا شناسه" placeholder="جستجو بر اساس نام یا شناسه..." value={query} onChange={event => setQuery(event.target.value)} />
    </div>

    <section className="admin-users__table-card" aria-label="فهرست کاربران و حساب‌ها">
      <div className="admin-users__table-scroll">
        <div className="admin-users__table" role="table" aria-label="کاربران و حساب‌ها">
          <div className="admin-users__row admin-users__row--head" role="row">
            {["عملیات", "وضعیت حساب", "وضعیت حمایتی مرتبط", "وضعیت فروشندگی", "احراز هویت", "نوع حساب", "نام / عنوان حساب", "شناسه"].map(label => <span role="columnheader" key={label}>{label}</span>)}
          </div>
          {visibleAccounts.map(account => <div className="admin-users__row" role="row" key={account.id}>
            <span role="cell"><Link className="admin-users__details" href={account.href}>جزئیات</Link></span>
            <span role="cell"><i className="admin-users__badge">فعال</i></span>
            <span role="cell">{account.support}</span>
            <span role="cell">{account.seller}</span>
            <span role="cell" className={account.identity === "تأیید شده" ? "is-approved" : "is-pending"}>{account.identity}</span>
            <span role="cell">{account.type}</span>
            <span role="cell" className="is-account-name">{account.name}</span>
            <span role="cell">{account.id}</span>
          </div>)}
          {visibleAccounts.length === 0 && <p className="admin-users__empty">حسابی با این مشخصات پیدا نشد.</p>}
        </div>
      </div>
    </section>
  </div>;
}
