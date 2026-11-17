"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { validPublicIntakeReceipt } from "../../../../lib/public-seller-intake";

export function PublicSellerIntakeStatus(){
  const [state,setState]=useState<
    | {kind:"loading"}
    | {kind:"success",code:string,date:string}
    | {kind:"error",message:string}
  >({kind:"loading"});
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/seller/public-registration/status",{
      cache:"no-store",signal:controller.signal,
    }).then(async response=>{
      const result:unknown=await response.json().catch(()=>null);
      if(controller.signal.aborted)return;
      if(response.ok&&validPublicIntakeReceipt(result)){
        setState({kind:"success",code:result.trackingCode,date:result.submittedAtUtc});
      }else{
        const v=result&&typeof result==="object"&&"message" in result&&
          typeof result.message==="string" ? result.message : null;
        setState({kind:"error",message:v??"رسید قابل تأیید نیست."});
      }
    }).catch(()=>{if(!controller.signal.aborted)setState({
      kind:"error",message:"پیگیری درخواست در دسترس نیست."
    });});
    return ()=>controller.abort();
  },[]);
  return <section className="surface-card seller-card" dir="rtl">
    {state.kind==="loading"&&<p role="status">در حال بررسی رسید محرمانه…</p>}
    {state.kind==="error"&&<div role="alert">
      <p>{state.message}</p>
      <p>داشتن کد پیگیری به‌تنهایی اجازه دسترسی به اطلاعات شخصی نمی‌دهد.
        برای پیگیری از مرورگر اولیه استفاده کنید یا با پشتیبانی تماس بگیرید.</p>
      <Link href="/seller/register">بازگشت به ثبت‌نام</Link>
    </div>}
    {state.kind==="success"&&<div role="status">
      <h2>درخواست همکاری دریافت شده است</h2>
      <p>کد پیگیری: <bdi dir="ltr">{state.code}</bdi></p>
      <p>زمان دریافت: {new Intl.DateTimeFormat("fa-IR",{
        dateStyle:"long",timeStyle:"short",
      }).format(new Date(state.date))}</p>
      <p>این وضعیت فقط دریافت درخواست را تأیید می‌کند. 
        بررسی، تأیید هویت و فعال‌سازی فروشندگی هنوز انجام نشده‌اند.</p>
      <Link href="/">بازگشت به حنا</Link>
    </div>}
  </section>;
}
