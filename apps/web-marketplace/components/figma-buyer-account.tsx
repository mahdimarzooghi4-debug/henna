"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { emptyPreviewCompany, normalizeCompany, readPreviewCompany, savePreviewCompany, validPreviewCompany, type PreviewCompany } from "../lib/preview-company";
import { toPersianDigits } from "../lib/normalize-digits";
import styles from "./figma-buyer-account.module.css";

import { BuyerAccountNav } from "./buyer-account-nav";

export function FigmaBuyerAccount() {
  const [notice, setNotice] = useState("");
  const [company,setCompany]=useState<PreviewCompany|null>(null);
  const [draft,setDraft]=useState<PreviewCompany>(emptyPreviewCompany);
  const [mode,setMode]=useState<"closed"|"view"|"edit">("closed");
  useEffect(()=>{
    const saved=readPreviewCompany();
    setCompany(saved);
    if(!saved) setMode("edit");
  },[]);
  const openEdit=()=>{setDraft(company??emptyPreviewCompany);setNotice("");setMode("edit");};

  return (
    <main className={styles.page} dir="rtl" data-testid="preview-account">
      <div className={styles.layout}>
        <BuyerAccountNav active="account" />
        <section className={styles.content} aria-label="حساب من">
          <article className={styles.legalCard} data-testid="preview-account-legal">
            <div className={styles.legalHeading}>
              <h2>خرید حقوقی</h2>
              <p>اطلاعات شرکت ثبت‌شده در حساب شما برای درخواست فاکتور رسمی هنگام خرید استفاده می‌شود.</p>
            </div>
            <div className={styles.legalState}>
              <strong>{company ? "اطلاعات شرکت در پیش‌نمایش ثبت شده است" : "هنوز مشخصات شرکت ثبت نشده است"}</strong>
              <p>برای درخواست فاکتور رسمی در خرید حقوقی، مشخصات شرکت را یک‌بار در حساب وارد کنید. این نسخه آزمایشی است؛ فقط اطلاعات نمونه وارد کنید.</p>
            </div>
            <div className={styles.legalActions}>
              <button className={styles.edit} type="button" onClick={openEdit}>{company?"ویرایش اطلاعات":"ثبت مشخصات شرکت"}</button>
              {company && <button className={styles.view} type="button" onClick={()=>{setMode(mode==="view"?"closed":"view");setNotice("");}}>مشاهده اطلاعات</button>}
            </div>
            {mode==="edit" && <form data-testid="preview-company-form" className={styles.companyForm} onSubmit={event=>{
              event.preventDefault();const next=normalizeCompany(draft);
              if(!validPreviewCompany(next)){setNotice("نام شرکت، شناسه ملی ۱۱ رقمی و شماره ثبت را به‌درستی وارد کنید. کد پستی در صورت ورود باید ۱۰ رقم باشد.");return;}
              if(!savePreviewCompany(next)){setNotice("ذخیره اطلاعات نمونه انجام نشد.");return;}
              setCompany(next);setMode("view");setNotice("مشخصات شرکت نمونه در این نشست ذخیره شد.");
            }} noValidate>
              <div className={styles.fields}>
                {([["name","نام شرکت"],["nationalId","شناسه ملی شرکت"],["registrationNumber","شماره ثبت"],["economicCode","کد اقتصادی (اختیاری)"],["postalCode","کد پستی (اختیاری)"]] as const).map(([key,label])=><label key={key}>{label}<input value={key==="name"?draft[key]:toPersianDigits(draft[key])} onChange={event=>setDraft(current=>({...current,[key]:event.target.value}))} inputMode={key==="name"?"text":"numeric"} maxLength={key==="name"?200:key==="nationalId"?11:key==="postalCode"?10:20}/></label>)}
                <label className={styles.fullField}>نشانی شرکت (اختیاری)<textarea value={draft.address} onChange={event=>setDraft(current=>({...current,address:event.target.value}))} maxLength={500}/></label>
              </div>
              <div className={styles.legalActions}><button type="submit" className={styles.edit}>ذخیره مشخصات شرکت</button><button type="button" className={styles.view} onClick={()=>{setMode("closed");setNotice("");}}>انصراف</button></div>
            </form>}
            {mode==="view"&&company&&<dl className={styles.fields} data-testid="preview-company-details">{([["name","نام شرکت"],["nationalId","شناسه ملی"],["registrationNumber","شماره ثبت"],["economicCode","کد اقتصادی"],["postalCode","کد پستی"],["address","نشانی شرکت"]] as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{toPersianDigits(company[key])||"—"}</dd></div>)}</dl>}
            {notice && <p className={styles.notice} role="status">{notice}</p>}
          </article>
          <section className={styles.summary} data-testid="preview-account-summary">
            <h1>حساب من</h1>
            <p>همه بخش‌های حساب، سفارش‌ها، آدرس‌ها، روش‌های پرداخت و اعتبارهای شما در یک صفحه جمع‌وجور نمایش داده می‌شود.</p>
          </section>
          <article className={styles.infoCard} id="account-info" data-testid="preview-account-info">
            <h2>اطلاعات حساب</h2>
            <div className={styles.divider} />
            <dl className={styles.fields}>
              <div className={styles.fullField}><dt>نام و نام خانوادگی</dt><dd>کاربر نمونه</dd></div>
              <div><dt>ایمیل</dt><dd>ایمیل نمونه</dd></div>
              <div><dt>شماره تلفن همراه</dt><dd>شماره تماس نمونه</dd></div>
            </dl>
            <div className={styles.infoActions}>
              <Link href="/buyer/profile?mode=preview" className={styles.edit}>ویرایش اطلاعات حساب</Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
