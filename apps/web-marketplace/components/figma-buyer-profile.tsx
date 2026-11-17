"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./figma-buyer-profile.module.css";
import accountStyles from "./figma-buyer-account.module.css";
import { BuyerAccountNav } from "./buyer-account-nav";
import {
  emptyPreviewCompany,
  normalizeCompany,
  readPreviewCompany,
  savePreviewCompany,
  validPreviewCompany,
  type PreviewCompany,
} from "../lib/preview-company";
import { toPersianDigits } from "../lib/normalize-digits";

export function FigmaBuyerProfile() {
  const router = useRouter();
  const [company, setCompany] = useState<PreviewCompany | null>(null);
  const [draft, setDraft] = useState<PreviewCompany>(emptyPreviewCompany);
  const [companyMode, setCompanyMode] = useState<"closed" | "view" | "edit">("closed");
  const [companyNotice, setCompanyNotice] = useState("");

  useEffect(() => {
    const saved = readPreviewCompany();
    setCompany(saved);
    if (!saved) setCompanyMode("edit");
  }, []);

  const openCompanyEdit = () => {
    setDraft(company ?? emptyPreviewCompany);
    setCompanyNotice("");
    setCompanyMode("edit");
  };

  return (
    <main className={accountStyles.page} dir="rtl" data-testid="preview-profile">
      <div className={accountStyles.layout}>
        <BuyerAccountNav active="account" />
        <section className={accountStyles.content}>
          <header className={accountStyles.summary}>
            <h1>تکمیل اطلاعات حساب</h1>
            <p>مشخصات شخص حقیقی و حقوقی را در همین صفحه تکمیل کنید.</p>
          </header>

          <form
            className={styles.form}
            data-testid="preview-personal-profile"
            onSubmit={(event) => {
              event.preventDefault();
              router.push("/buyer/account?mode=preview");
            }}
          >
            <h2>اطلاعات شخص حقیقی</h2>
            <label>نام و نام خانوادگی<input defaultValue="کاربر نمونه" /></label>
            <label>شماره موبایل<input defaultValue="۰۹۱۲۳۴۵۶۷۸۹" readOnly /><small>غیرقابل تغییر</small></label>
            <label>کد ملی (اختیاری جهت فعال‌سازی اعتبارات حمایتی)<input placeholder="نمونه: ۰۰۱۲۳۴۵۶۷۸" inputMode="numeric" /></label>
            <label>تاریخ تولد (اختیاری)<input placeholder="روز / ماه / سال" /></label>
            <p className={styles.notice}>نسخه نمایشی؛ اطلاعات این فرم در حساب واقعی ذخیره نمی‌شود.</p>
            <div className={styles.actions}>
              <button type="submit">ذخیره و ثبت نهایی اطلاعات</button>
              <Link href="/buyer/account?mode=preview">انصراف</Link>
            </div>
          </form>

          <article className={accountStyles.legalCard} data-testid="preview-account-legal">
            <div className={accountStyles.legalHeading}>
              <h2>اطلاعات شخص حقوقی</h2>
              <p>اگر به نام شرکت خرید می‌کنید، مشخصات ثبتی شرکت را برای درخواست فاکتور رسمی وارد کنید.</p>
            </div>
            <div className={accountStyles.legalState}>
              <strong>{company ? "اطلاعات شرکت در پیش‌نمایش ثبت شده است" : "هنوز مشخصات شرکت ثبت نشده است"}</strong>
              <p>این اطلاعات فقط برای پیش‌نمایش حساب است و به حساب واقعی یا سامانه مالی ارسال نمی‌شود.</p>
            </div>

            {company && (
              <div className={accountStyles.legalActions}>
                <button className={accountStyles.edit} type="button" onClick={openCompanyEdit}>ویرایش اطلاعات</button>
                <button className={accountStyles.view} type="button" onClick={() => { setCompanyMode(companyMode === "view" ? "closed" : "view"); setCompanyNotice(""); }}>مشاهده اطلاعات</button>
              </div>
            )}

            {!company && companyMode === "closed" && (
              <div className={accountStyles.legalActions}>
                <button className={accountStyles.view} type="button" onClick={openCompanyEdit}>تکمیل مشخصات</button>
              </div>
            )}

            {companyMode === "edit" && (
              <form
                data-testid="preview-company-form"
                className={accountStyles.companyForm}
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = normalizeCompany(draft);
                  if (!validPreviewCompany(next)) {
                    setCompanyNotice("نام شرکت، شناسه ملی ۱۱ رقمی و شماره ثبت را به‌درستی وارد کنید. کد پستی در صورت ورود باید ۱۰ رقم باشد.");
                    return;
                  }
                  if (!savePreviewCompany(next)) {
                    setCompanyNotice("ذخیره اطلاعات نمونه انجام نشد.");
                    return;
                  }
                  setCompany(next);
                  setCompanyMode("view");
                  setCompanyNotice("مشخصات شرکت نمونه در این نشست ذخیره شد.");
                }}
              >
                <div className={accountStyles.fields}>
                  {([
                    ["name", "نام شرکت"],
                    ["nationalId", "شناسه ملی شرکت"],
                    ["registrationNumber", "شماره ثبت"],
                    ["economicCode", "کد اقتصادی (اختیاری)"],
                    ["postalCode", "کد پستی (اختیاری)"],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        value={key === "name" ? draft[key] : toPersianDigits(draft[key])}
                        onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                        inputMode={key === "name" ? "text" : "numeric"}
                        maxLength={key === "name" ? 200 : key === "nationalId" ? 11 : key === "postalCode" ? 10 : 20}
                      />
                    </label>
                  ))}
                  <label className={accountStyles.fullField}>
                    نشانی شرکت (اختیاری)
                    <textarea value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} maxLength={500} />
                  </label>
                </div>
                <div className={accountStyles.legalActions}>
                  <button type="submit" className={accountStyles.edit}>ذخیره مشخصات شرکت</button>
                  {company && <button type="button" className={accountStyles.view} onClick={() => { setCompanyMode("view"); setCompanyNotice(""); }}>انصراف</button>}
                  {!company && <Link href="/buyer/account?mode=preview" className={accountStyles.view}>انصراف</Link>}
                </div>
              </form>
            )}

            {companyMode === "view" && company && (
              <dl className={accountStyles.fields} data-testid="preview-company-details">
                {([
                  ["name", "نام شرکت"],
                  ["nationalId", "شناسه ملی"],
                  ["registrationNumber", "شماره ثبت"],
                  ["economicCode", "کد اقتصادی"],
                  ["postalCode", "کد پستی"],
                  ["address", "نشانی شرکت"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{toPersianDigits(company[key]) || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
            {companyNotice && <p className={accountStyles.notice} role="status">{companyNotice}</p>}
          </article>
        </section>
      </div>
    </main>
  );
}
