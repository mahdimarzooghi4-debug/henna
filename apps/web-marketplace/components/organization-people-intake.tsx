"use client";

import { useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import styles from "./organization-portal.module.css";

export function OrganizationPeopleIntake() {
  const [name, setName] = useState("");
  const [organizationIdentifier, setOrganizationIdentifier] = useState("");
  const [mobile, setMobile] = useState("");
  const [program, setProgram] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setMessage(next ? "فایل فقط در این صفحه انتخاب شده و هنوز ارسال نشده است." : "");
  }
  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const next = event.dataTransfer.files?.[0] ?? null;
    if (!next) return;
    if (!/\.(csv|xlsx)$/i.test(next.name)) {
      setMessage("فقط فایل CSV یا Excel انتخاب کنید.");
      return;
    }
    setFile(next);
    setMessage("فایل فقط در این صفحه انتخاب شده و هنوز ارسال نشده است.");
  }
  function downloadTemplate() {
    const blob = new Blob(["نام,شناسه موردنیاز,شماره همراه در صورت نیاز\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hana-recipients-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function addBatch() {
    setMessage(file
      ? "فایل انتخاب شده است؛ ثبت گروهی پس از تعریف قواعد رکوردهای تکراری و ناقص و اتصال سرویس انجام می‌شود. فایلی ارسال نشد."
      : "ابتدا فایل CSV یا Excel را انتخاب کنید.");
  }
  function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !organizationIdentifier.trim() || !program) {
      setMessage("نام، شناسه موردنیاز و طرح حمایتی را تکمیل کنید.");
      return;
    }
    setMessage("اطلاعات واردشده ارسال یا ذخیره نشد؛ اتصال سرویس ثبت افراد هنوز آماده نیست.");
  }

  return <section className={styles.peopleIntakePage} aria-label="ثبت و افزودن دستی مشمولان">
    <div className={styles.peopleBackRow}>
      <Link href="/organization/people" className={styles.peopleBackLink}><span aria-hidden="true">←</span>بازگشت به لیست مشمولان</Link>
    </div>
    <div className={styles.peopleFormsGrid}>
      <section className={styles.peopleIntakeCard}>
        <header className={styles.peopleIntakeHeader}>
          <h2>ثبت گروهی افراد (فایل اکسل / CSV)</h2>
          <p>افزودن لیست مشمولان با بارگذاری گروهی قالب پیش‌فرض — نحوه برخورد با شناسه‌های تکراری، رکوردهای ناقص و ساختار نامعتبر نیازمند تعریف است</p>
        </header>
        <div className={styles.peopleIntakeDivider}/>
        <label
          className={`${styles.peopleFileDrop} ${dragging ? styles.peopleFileDropActive : ""}`}
          onDragOver={event => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={dropFile}
        >
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFile} aria-label="انتخاب فایل مشمولان"/>
          <span className={styles.peopleUploadIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></span>
          <strong>{file ? file.name : "فایل اکسل یا CSV را به اینجا بکشید یا انتخاب کنید"}</strong>
          <small>قالب ستون‌ها: نام، شناسه موردنیاز، شماره همراه در صورت نیاز</small>
        </label>
        <div className={styles.peopleBatchActions}>
          <button className={styles.outlineButton} type="button" onClick={downloadTemplate}>دانلود نمونه قالب فایل</button>
          <button className={styles.primaryButton} type="button" onClick={addBatch}>افزودن گروهی</button>
        </div>
        {message && <p className={styles.peopleIntakeMessage} role="status">{message}</p>}
      </section>

      <section className={styles.peopleIntakeCard}>
        <header className={styles.peopleIntakeHeader}>
          <h2>افزودن انفرادی مشمول جدید</h2>
          <p>مشخصات هویتی و ارتباطی پایه فرد را ثبت نمایید</p>
        </header>
        <div className={styles.peopleIntakeDivider}/>
        <form className={styles.peopleSingleForm} onSubmit={addPerson}>
          <label>نام و عنوان نمایشی<input value={name} onChange={event => setName(event.target.value)} placeholder="مثال: محمد امینی" maxLength={120}/></label>
          <label>شناسه موردنیاز<input value={organizationIdentifier} onChange={event => setOrganizationIdentifier(event.target.value)} placeholder="شناسه موردنیاز سازمان" maxLength={120}/></label>
          <label>شماره تلفن همراه (جهت تطبیق حساب کاربری)<input className={styles.peoplePhone} type="tel" inputMode="tel" value={mobile} onChange={event => setMobile(event.target.value)} placeholder="۰۹۱۲******"/></label>
          <label>انتخاب طرح حمایتی هدف<select value={program} onChange={event => setProgram(event.target.value)}><option value="">انتخاب طرح حمایتی فعال</option><option value="طرح نمونه ۱">طرح نمونه ۱</option><option value="طرح نمونه ۲">طرح نمونه ۲</option><option value="اعتبار نمونه">اعتبار نمونه</option></select></label>
          <div className={styles.peopleIntakeDivider}/>
          {message && <p className={styles.peopleIntakeMessage} role="alert">{message}</p>}
          <div className={styles.peopleSingleActions}>
            <Link className={styles.outlineButton} href="/organization/people">انصراف</Link>
            <button className={styles.primaryButton} type="submit">افزودن فرد</button>
          </div>
        </form>
      </section>
    </div>
  </section>;
}
