"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { normalizeDigits } from "../../../lib/normalize-digits";
import { validateSellerDraft } from "../../../lib/seller-edit-safety";
import { validPublicIntakeReceipt } from "../../../lib/public-seller-intake";
import styles from "./public-registration.module.css";

type Values = {
  storeName: string; ownerName: string; phone: string;
  city: string; address: string; postalCode: string;
  applicantType: "" | "NATURAL" | "LEGAL";
  businessName: string; businessDescription: string;
  offeringType: "" | "GOOD" | "SERVICE" | "BOTH";
  activityAddress: string; activityHours: string;
  sellerDelivery: boolean; pickup: boolean; serviceArea: string;
  registrationContactName: string; registrationContactRole: string;
  backupPhone: string; websiteOrSocial: string;
  businessEmail: string; responseHours: string;
};
const empty:Values={
  storeName:"",ownerName:"",phone:"",city:"",address:"",postalCode:"",
  applicantType:"",businessName:"",businessDescription:"",offeringType:"",
  activityAddress:"",activityHours:"",sellerDelivery:false,pickup:false,
  serviceArea:"",registrationContactName:"",registrationContactRole:"",
  backupPhone:"",websiteOrSocial:"",businessEmail:"",responseHours:""
};
const stages=[
  "شروع ثبت‌نام","نوع متقاضی","احراز هویت",
  "اطلاعات کسب‌وکار","محدوده فعالیت","اطلاعات تکمیلی",
  "بازبینی و ثبت","وضعیت درخواست",
] as const;

export function PublicSellerRegistrationForm() {
  const [step,setStep]=useState(2);
  const [values,setValues]=useState<Values>(empty);
  const [confirmed,setConfirmed]=useState(false);
  const [acknowledged,setAcknowledged]=useState(false);
  const [busy,setBusy]=useState(false);
  const [checking,setChecking]=useState(true);
  const [error,setError]=useState("");
  const [receipt,setReceipt]=useState<{trackingCode:string;submittedAtUtc:string}|null>(null);
  const change=(key:keyof Values,value:string|boolean)=>{
    // Human confirmation applies to the exact reviewed fields, not to
    // values edited later in the wizard.
    setConfirmed(false);
    setError("");
    setValues(prev=>({...prev,[key]:value}));
  };

  // Receipt proof is this browser's independent, HttpOnly applicant cookie:
  // never infer success from a network timeout or a buyer authentication.
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/seller/public-registration/status",{
      cache:"no-store",signal:controller.signal,
    }).then(async response=>{
      if(!response.ok) return;
      const body:unknown=await response.json();
      if(!controller.signal.aborted && validPublicIntakeReceipt(body)){
        setReceipt({trackingCode:body.trackingCode,submittedAtUtc:body.submittedAtUtc});
        setStep(8);
      }
    }).catch(()=>{}).finally(()=>{
      if(!controller.signal.aborted)setChecking(false);
    });
    return ()=>controller.abort();
  },[]);

  function next(){
    setError("");
    if(step===2 && !values.applicantType){
      setError("نوع متقاضی را انتخاب کنید.");return;
    }
    if(step===3){
      const phone=normalizeDigits(values.phone.trim());
      if(!values.ownerName.trim() || values.ownerName.length>120 ||
        !/^09\d{9}$/.test(phone) || !acknowledged){
        setError("نام مسئول و شماره موبایل معتبر را وارد و اطلاعیه بررسی هویت را تأیید کنید.");
        return;
      }
      setValues(v=>({...v,phone}));
    }
    if(step===4){
      const result=validateSellerDraft({
        storeName:values.storeName,ownerName:values.ownerName,
        phone:values.phone,city:values.city,address:values.address,
        postalCode:values.postalCode,
      });
      if(result.firstInvalid||!values.businessName.trim()||
        !values.businessDescription.trim()||!values.offeringType){
        setError(Object.values(result.errors)[0]??"اطلاعات کسب‌وکار و نوع ارائه را کامل کنید.");
        return;
      }
      setValues(v=>({...v,...result.values}));
    }
    if(step===5 && (!values.activityAddress.trim() ||
      !values.activityHours.trim() || !values.serviceArea.trim() ||
      (!values.sellerDelivery && !values.pickup))){
      setError("محدوده فعالیت و حداقل یکی از روش‌های تحویل را مشخص کنید.");return;
    }
    if(step===6 && (!values.registrationContactName.trim() ||
      !values.responseHours.trim())){
      setError("مسئول ثبت‌نام و ساعات پاسخگویی را کامل کنید.");return;
    }
    setStep(s=>Math.min(s+1,7));
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function back(){
    setError("");
    setConfirmed(false);
    setStep(s=>Math.max(2,s-1));
  }

  async function submit(){
    if(!confirmed||busy)return;
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/seller/public-registration",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          ...values,
          registrationContactRole:values.registrationContactRole.trim()||null,
          backupPhone:normalizeDigits(values.backupPhone.trim())||null,
          websiteOrSocial:values.websiteOrSocial.trim()||null,
          businessEmail:values.businessEmail.trim()||null,
          confirmed:true,
        }),
        cache:"no-store",
      });
      const body:unknown=await response.json().catch(()=>null);
      if(response.ok && validPublicIntakeReceipt(body)){
        setReceipt({trackingCode:body.trackingCode,submittedAtUtc:body.submittedAtUtc});
        setStep(8);
        return;
      }
      const problem=body&&typeof body==="object"&&
        "message" in body&&typeof body.message==="string" ? body.message : null;
      setError(problem??"ثبت درخواست تأیید نشد؛ لطفاً دوباره تلاش کنید.");
    }catch{
      setError("پاسخ ثبت نامشخص است. پیش از ارسال مجدد وضعیت درخواست را بررسی کنید.");
    }finally{setBusy(false);}
  }

  function field(key:keyof Values,label:string,required=true,type="text",placeholder=""){
    const value=values[key];
    if(typeof value!=="string")return null;
    const maxLengths:Partial<Record<keyof Values,number>>={
      storeName:120,ownerName:120,phone:11,city:120,address:500,postalCode:10,
      businessName:180,businessDescription:500,activityAddress:500,
      activityHours:180,serviceArea:240,registrationContactName:120,
      registrationContactRole:120,backupPhone:11,websiteOrSocial:300,
      businessEmail:254,responseHours:180,
    };
    return <label className={styles.field} key={key}>
      <span>{label}{required?" *":""}</span>
      <input name={key} required={required} type={type} value={value}
        maxLength={maxLengths[key]} placeholder={placeholder}
        dir={type==="tel"||type==="email"?"ltr":"rtl"}
        onChange={e=>change(key,e.target.value)}
        disabled={busy||checking}/>
    </label>;
  }

  return <div className={styles.root} dir="rtl">
    <nav className={styles.steps} aria-label="مراحل ثبت‌نام آزاد فروشنده">
      {stages.map((label,i)=><span key={label} className={step===i+1?styles.active:""}
        aria-current={step===i+1?"step":undefined}>
        <b>{new Intl.NumberFormat("fa-IR").format(i+1)}</b>{label}
      </span>)}
    </nav>
    <nav className={styles.mobileProgress} aria-label="پیشرفت ثبت‌نام فروشنده در موبایل">
      <div className={styles.mobileProgressBars} aria-hidden="true">
        {stages.map((stage,i)=><span key={stage}
          className={i+1<step?styles.mobileProgressDone:i+1===step?styles.mobileProgressCurrent:styles.mobileProgressPending}/>)}
      </div>
      <div className={styles.mobileProgressCaption}>
        <strong>{step===8?"وضعیت درخواست":"ثبت اطلاعات کاربری"}</strong>
        <span>مرحله {new Intl.NumberFormat("fa-IR").format(step)} از ۸</span>
      </div>
    </nav>
    <section className={styles.card}>
      {checking?<p role="status">در حال بررسی رسید قبلی این مرورگر…</p>:<>
      <h2>{stages[step-1]}</h2>
      <p className={styles.intro}>برای ارسال درخواست همکاری نیازی به ورود یا ساخت حساب خریدار ندارید.
        اطلاعات واردشده صرفاً درخواست بررسی است و فعال‌سازی فروشگاه محسوب نمی‌شود.</p>

      {step===2&&<div className={styles.applicantChoices} role="group" aria-label="نوع متقاضی">
        <label className={`${styles.applicantCard} ${values.applicantType==="NATURAL"?styles.applicantCardActive:""}`}>
          <span className={styles.applicantCardTop}>
            <span className={styles.applicantIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6"/>
              </svg>
            </span>
            <input aria-label="شخص حقیقی" type="radio" name="applicantType"
              checked={values.applicantType==="NATURAL"}
              onChange={()=>change("applicantType","NATURAL")}/>
          </span>
          <strong>شخص حقیقی</strong>
          <span className={styles.applicantDescription}>
            ثبت‌نام به نام یک فرد با کد ملی شخصی. مناسب برای کسب‌وکارهای خانگی،
            ارائه‌دهندگان محلی کالا و خدمات، آزادکاران و تولیدکنندگان انفرادی.
          </span>
        </label>
        <label className={`${styles.applicantCard} ${values.applicantType==="LEGAL"?styles.applicantCardActive:""}`}>
          <span className={styles.applicantCardTop}>
            <span className={styles.applicantIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4.5" y="3" width="15" height="18" rx="1.8"/>
                <path d="M8 7h2m4 0h2M8 11h2m4 0h2M10 21v-5h4v5"/>
              </svg>
            </span>
            <input aria-label="شخص حقوقی" type="radio" name="applicantType"
              checked={values.applicantType==="LEGAL"}
              onChange={()=>change("applicantType","LEGAL")}/>
          </span>
          <strong>شخص حقوقی</strong>
          <span className={styles.applicantDescription}>
            ثبت‌نام به نام یک شخصیت حقوقی یا سازمان.
          </span>
        </label>
      </div>}
      {step===3&&<div className={styles.info}>
        <div className={styles.grid}>
          {field("ownerName","نام و نام خانوادگی مسئول")}
          {field("phone","شماره موبایل مسئول",true,"tel","09xxxxxxxxx")}
        </div>
        <p>این مرحله صرفاً ثبت اطلاعات هویتی اولیه است؛ شماره همراه و هویت هنوز تأیید نشده‌اند. احراز هویت معتبر پیش از تأیید فروشندگی جداگانه انجام می‌شود.</p>
        <label><input type="checkbox" checked={acknowledged}
          onChange={e=>setAcknowledged(e.target.checked)}/>
          متوجه هستم ثبت اطلاعات به معنای احراز هویت نیست.</label>
      </div>}
      {step===4&&<div className={styles.grid}>
        {field("storeName","نام فروشگاه",true,"text","مثلاً سوپرمارکت بهار")}
        {field("city","شهر / منطقه")}
        {field("address","نشانی فروشگاه")}
        {field("postalCode","کدپستی",true,"text","۱۰ رقم")}
        {field("businessName","نام کسب‌وکار")}
        {field("businessDescription","توضیح فعالیت و محصولات یا خدمات")}
        <fieldset className={styles.choices}><legend>نوع ارائه</legend>
          {([["GOOD","کالا"],["SERVICE","خدمت"],["BOTH","کالا و خدمت"]] as const)
            .map(([type,label])=><label key={type}>
            <input type="radio" checked={values.offeringType===type}
              onChange={()=>change("offeringType",type)}/>{label}</label>)}
        </fieldset>
      </div>}
      {step===5&&<div className={styles.grid}>
        {field("activityAddress","نشانی فعالیت")}
        {field("activityHours","ساعات فعالیت")}
        {field("serviceArea","محدوده خدمت‌رسانی")}
        <fieldset className={styles.choices}><legend>روش ارائه یا تحویل</legend>
          <label><input type="checkbox" checked={values.sellerDelivery}
            onChange={e=>change("sellerDelivery",e.target.checked)}/> ارسال توسط فروشگاه</label>
          <label><input type="checkbox" checked={values.pickup}
            onChange={e=>change("pickup",e.target.checked)}/> تحویل حضوری</label>
        </fieldset>
      </div>}
      {step===6&&<div className={styles.grid}>
        {field("registrationContactName","نام مسئول پیگیری")}
        {field("registrationContactRole","سمت مسئول",false)}
        {field("backupPhone","موبایل دوم",false,"tel")}
        {field("websiteOrSocial","وب‌سایت یا شبکه اجتماعی",false)}
        {field("businessEmail","ایمیل کسب‌وکار",false,"email")}
        {field("responseHours","ساعات پاسخگویی")}
      </div>}
      {step===7&&<div className={styles.review}>
        <p><strong>فروشگاه:</strong> {values.storeName}</p>
        <p><strong>مسئول:</strong> {values.ownerName}</p>
        <p><strong>شماره تماس:</strong> <bdi dir="ltr">{values.phone}</bdi></p>
        <p><strong>نوع متقاضی:</strong> {values.applicantType==="NATURAL"?"حقیقی":"حقوقی"}</p>
        <p><strong>کسب‌وکار:</strong> {values.businessName}</p>
        <p><strong>شهر و منطقه:</strong> {values.city} — {values.serviceArea}</p>
        <p className={styles.info}>این درخواست فقط برای بررسی دریافت می‌شود.
          شماره تماس، هویت، دسته فعالیت و سایر شرایط هنوز تأیید نشده‌اند.</p>
        <label><input type="checkbox" checked={confirmed}
          onChange={e=>setConfirmed(e.target.checked)}/>
          صحت اطلاعاتی را که خودم وارد کرده‌ام تأیید می‌کنم.</label>
      </div>}
      {step===8&&<div className={styles.success} role="status">
        <h3>درخواست ثبت‌نام دریافت شد</h3>
        <p>کد پیگیری: <bdi dir="ltr">{receipt?.trackingCode??"—"}</bdi></p>
        <p>این دریافت درخواست، تأیید هویت یا فعال‌سازی فروشندگی نیست.</p>
        <Link href="/seller/register/public-status">مشاهده رسید درخواست در همین مرورگر</Link>
      </div>}

      {error&&<p role="alert" className={styles.error}>{error}</p>}
      {step<8&&<div className={styles.actions}>
        {step>2&&<button type="button" className={styles.secondary} onClick={back}
          disabled={busy}>مرحله قبل</button>}
        {step<7?<button type="button" className={styles.primary} onClick={next}>
          ادامه</button>:<button type="button" className={styles.primary}
          onClick={()=>void submit()} disabled={!confirmed||busy}>
          {busy?"در حال ثبت…":"ثبت نهایی درخواست"}</button>}
      </div>}
      </>}
    </section>
  </div>;
}
