"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BuyerCommerceError,
  buyerGet,
  buyerPost,
  commerceIntent,
  rial,
  type BuyerWallet,
  type BuyerWithdrawal,
  type CommerceIntent,
} from "../lib/buyer-commerce";
import {
  clearWebCommerceIntent,
  persistWebCommerceIntent,
  restoreWebCommerceIntent,
} from "../lib/web-pending-commerce";

type Load<T> =
  | { kind:"loading" }
  | { kind:"ready"; value:T }
  | { kind:"error"; message:string };

function message(error:unknown){
  return error instanceof Error?error.message:"دریافت اطلاعات کیف پول تأیید نشد.";
}

export function BuyerWalletCenter(){
  const [wallet,setWallet]=useState<Load<BuyerWallet>>({kind:"loading"});
  const [withdrawals,setWithdrawals]=useState<
    Load<{items:BuyerWithdrawal[];page:number}>
  >({kind:"loading"});
  const [page,setPage]=useState(1);
  const [amount,setAmount]=useState("");
  const [reference,setReference]=useState("");
  const [pending,setPending]=useState<CommerceIntent|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const mounted=useRef(true);

  const load=useCallback(async(signal?:AbortSignal)=>{
    setWallet({kind:"loading"});
    setWithdrawals({kind:"loading"});
    try{
      const [walletValue,items]=await Promise.all([
        buyerGet<BuyerWallet>("wallet",signal),
        buyerGet<BuyerWithdrawal[]>("withdrawals?page="+page,signal),
      ]);
      if(signal?.aborted)return;
      setWallet({kind:"ready",value:walletValue});
      setWithdrawals({kind:"ready",value:{items,page}});
    }catch(error){
      if(signal?.aborted)return;
      const text=message(error);
      setWallet({kind:"error",message:text});
      setWithdrawals({kind:"error",message:text});
    }
  },[page]);

  useEffect(()=>{
    mounted.current=true;
    try{
      const restored=restoreWebCommerceIntent("wallet");
      if(restored){
        setPending(restored);
        if(restored.path==="withdrawals"){
          const body=JSON.parse(restored.body) as Record<string,unknown>;
          if(typeof body.amountRial==="number")setAmount(String(body.amountRial));
          if(typeof body.ibanVerificationRequestReference==="string")
            setReference(body.ibanVerificationRequestReference);
        }
        setNotice(
          "یک درخواست برداشت با نتیجه نامشخص از همین تب بازیابی شد؛ فقط همان درخواست قابل تکرار است.");
      }
    }catch{
      setBusy(true);
      setNotice(
        "وضعیت درخواست قبلی قابل تأیید نیست؛ برای جلوگیری از جابه‌جایی تکراری وجه، عملیات نوشتنی قفل شده است.");
    }
    return()=>{mounted.current=false;};
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    void load(controller.signal);
    return()=>controller.abort();
  },[load]);

  const mutate=useCallback(async(intent:CommerceIntent,success:string)=>{
    setBusy(true);setNotice("");
    try{
      persistWebCommerceIntent("wallet",intent);
      setPending(intent);
      await buyerPost(intent);
      clearWebCommerceIntent(intent.key);
      if(!mounted.current)return;
      setPending(null);
      setNotice(success);
      if(intent.path==="withdrawals"){setAmount("");setReference("");}
      await load();
    }catch(error){
      if(!mounted.current)return;
      const normalized=error instanceof BuyerCommerceError
        ?error:new BuyerCommerceError(503);
      if(normalized.status===503){
        setPending(intent);
        setNotice(
          "نتیجه درخواست قطعی نیست؛ همان درخواست را دوباره بزنید تا کلید و بدنه بدون تغییر تکرار شوند.");
      }else{
        clearWebCommerceIntent(intent.key);
        setPending(null);
        setNotice(normalized.message);
        if(normalized.status===409)await load();
      }
    }finally{
      if(mounted.current)setBusy(false);
    }
  },[load]);

  const requestWithdrawal=()=>{
    if(pending||busy)return;
    if(!/^[0-9]{1,15}$/.test(amount)||Number(amount)<1||
       !reference.trim()||reference.trim().length>240){
      setNotice("مبلغ و مرجع درخواست تأیید مالکیت شبا را کامل کنید.");
      return;
    }
    void mutate(commerceIntent(null,"withdrawals",{
      amountRial:Number(amount),
      ibanVerificationRequestReference:reference.trim(),
    }),
    "درخواست برداشت ثبت شد و مبلغ تا تأیید مالکیت شبا در hold قرار گرفت؛ انتقال بانکی انجام نشده است.");
  };

  const cancel=(item:BuyerWithdrawal)=>{
    if(pending||busy||item.state!=="OWNERSHIP_VERIFICATION_PENDING")return;
    void mutate(
      commerceIntent(null,"withdrawals/"+item.id+"/cancel",{}),
      "درخواست برداشت لغو شد و مبلغ به کیف پول نقدی برگشت.",
    );
  };

  const retry=()=>{
    if(!pending||busy)return;
    void mutate(pending,pending.path==="withdrawals"
      ?"درخواست برداشت ثبت شد و مبلغ در hold قرار گرفت؛ انتقال بانکی انجام نشده است."
      :"درخواست برداشت لغو شد و مبلغ به کیف پول نقدی برگشت.");
  };

  const balance=wallet.kind==="ready"?wallet.value.balanceRial:null;

  return(
    <main className="buyer-wallet">
      <header className="buyer-wallet__header">
        <div>
          <p className="seller-panel__eyebrow">حساب خریدار</p>
          <h1>کیف پول و درخواست برداشت</h1>
          <p>
            این صفحه وضعیت داخلی حنا را نشان می‌دهد. درخواست برداشت تا
            تأیید مالکیت شبا و اتصال بانکی فقط در hold می‌ماند.
          </p>
        </div>
        <div className="buyer-wallet__actions">
          <Link href="/account" className="auth-card__secondary">
            اعلان‌ها و پشتیبانی
          </Link>
          <Link href="/" className="auth-card__secondary">فروشگاه</Link>
        </div>
      </header>

      {notice&&<p role="status" className="form-status buyer-wallet__notice">
        {notice}
      </p>}

      {pending&&(
        <section className="buyer-account__pending">
          <strong>یک عملیات مالی با نتیجه نامشخص دارید.</strong>
          <p>
            تا تعیین نتیجه، عملیات مالی دیگری ارسال نمی‌شود.
          </p>
          <button type="button" className="primary-button"
            disabled={busy} onClick={retry}>
            {busy?"در حال بررسی…":"تکرار امن همان درخواست"}
          </button>
        </section>
      )}

      <section className="buyer-wallet__grid">
        <article className="buyer-wallet__panel">
          <h2>موجودی نقدی</h2>
          {wallet.kind==="loading"&&
            <p className="form-status">در حال دریافت موجودی…</p>}
          {wallet.kind==="error"&&
            <p className="form-status form-status--error" role="alert">
              {wallet.message}{" "}
              <Link href="/auth?returnTo=/wallet">ورود به حنا</Link>
            </p>}
          {balance!==null&&(
            <strong className="buyer-wallet__balance">{rial(balance)}</strong>
          )}

          <h3>درخواست برداشت</h3>
          <label className="field">
            <span className="field__label">مبلغ، ریال</span>
            <input className="field__input" inputMode="numeric"
              value={amount} maxLength={15}
              disabled={busy||pending!==null}
              onChange={event=>setAmount(event.target.value)}
              placeholder="مثلاً 500000"/>
          </label>
          <label className="field">
            <span className="field__label">مرجع درخواست تأیید مالکیت شبا</span>
            <input className="field__input" maxLength={240}
              value={reference}
              disabled={busy||pending!==null}
              onChange={event=>setReference(event.target.value)}
              placeholder="مرجع قابل پیگیری تأیید مالکیت"/>
          </label>
          <p className="buyer-wallet__boundary">
            حنا در این مرحله شماره شبا یا موفقیت انتقال بانکی را جعل نمی‌کند.
            این مرجع برای اتصال سرویس تأیید مالکیت بعدی نگه‌داری می‌شود.
          </p>
          <button type="button" className="primary-button"
            disabled={busy||pending!==null||!amount||!reference.trim()}
            onClick={requestWithdrawal}>
            ثبت درخواست برداشت
          </button>
        </article>

        <article className="buyer-wallet__panel">
          <div className="seller-commerce__section-title">
            <h2>سابقه برداشت</h2>
            <span>صفحه {new Intl.NumberFormat("fa-IR").format(page)}</span>
          </div>
          {withdrawals.kind==="loading"&&
            <p className="form-status">در حال دریافت درخواست‌ها…</p>}
          {withdrawals.kind==="error"&&
            <p className="form-status form-status--error" role="alert">
              {withdrawals.message}
            </p>}
          {withdrawals.kind==="ready"&&!withdrawals.value.items.length&&
            <p className="seller-commerce__empty">درخواست برداشتی ندارید.</p>}
          {withdrawals.kind==="ready"&&withdrawals.value.items.map(item=>(
            <article className="buyer-wallet__withdrawal" key={item.id}>
              <div>
                <strong>{rial(item.amountRial)}</strong>
                <p>
                  {item.state==="OWNERSHIP_VERIFICATION_PENDING"
                    ?"در انتظار تأیید مالکیت شبا"
                    :"لغوشده"}
                  {item.slaEscalated?" · نیازمند پیگیری SLA":""}
                </p>
              </div>
              <dl>
                <div><dt>ثبت درخواست</dt><dd>
                  {new Intl.DateTimeFormat("fa-IR",{
                    dateStyle:"medium",timeStyle:"short",
                  }).format(new Date(item.requestedAtUtc))}
                </dd></div>
                <div><dt>مهلت بررسی</dt><dd>
                  {new Intl.DateTimeFormat("fa-IR",{
                    dateStyle:"medium",timeStyle:"short",
                  }).format(new Date(item.dueAtUtc))}
                </dd></div>
              </dl>
              {item.state==="OWNERSHIP_VERIFICATION_PENDING"&&(
                <button type="button" className="seller-commerce__refresh"
                  disabled={busy||pending!==null}
                  onClick={()=>cancel(item)}>
                  لغو درخواست و آزادسازی مبلغ
                </button>
              )}
            </article>
          ))}
          <div className="seller-commerce__pager">
            <button type="button"
              disabled={page===1||busy||pending!==null}
              onClick={()=>setPage(value=>value-1)}>صفحه قبل</button>
            <button type="button"
              disabled={withdrawals.kind!=="ready"||
                withdrawals.value.items.length<20||busy||pending!==null}
              onClick={()=>setPage(value=>value+1)}>صفحه بعد</button>
          </div>
        </article>
      </section>
    </main>
  );
}
