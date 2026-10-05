"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  adminOperationId,
  adminOperationIntent,
  adminRial,
  adminTime,
  parseAdminResourcePage,
  parseAdminSummary,
  type AdminAudit,
  type AdminContent,
  type AdminFeePolicy,
  type AdminMembership,
  type AdminOperationIntent,
  type AdminOrganization,
  type AdminPermission,
  type AdminResourceKind,
  type AdminSettlement,
  type AdminSummary,
  type AdminWithdrawal,
} from "../../../lib/admin-operations";

type Load<T> =
  | { kind:"loading" }
  | { kind:"ready"; items:T[] }
  | { kind:"error"; message:string };
type SummaryState =
  | { kind:"loading" }
  | { kind:"ready"; value:AdminSummary }
  | { kind:"denied"; message:string }
  | { kind:"error"; message:string };

class AdminOperationError extends Error {
  constructor(public status:number,message:string){super(message);}
}
async function responseJson(response:Response):Promise<unknown>{
  const body:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    const message=body&&typeof body==="object"&&"message" in body&&
      typeof body.message==="string"?body.message:"عملیات مدیریتی تأیید نشد.";
    throw new AdminOperationError(response.status,message);
  }
  return body;
}

const initial=<T,>():Load<T>=>({kind:"loading"});
const money=(value:string)=>/^[0-9]{1,15}$/.test(value)?Number(value):null;

export default function AdminOperationsPage(){
  const [summary,setSummary]=useState<SummaryState>({kind:"loading"});
  const [auditPage,setAuditPage]=useState(1);
  const [audit,setAudit]=useState<Load<AdminAudit>>(initial());
  const [permissions,setPermissions]=useState<Load<AdminPermission>>(initial());
  const [contents,setContents]=useState<Load<AdminContent>>(initial());
  const [organizations,setOrganizations]=useState<Load<AdminOrganization>>(initial());
  const [memberships,setMemberships]=useState<Load<AdminMembership>>(initial());
  const [fees,setFees]=useState<Load<AdminFeePolicy>>(initial());
  const [withdrawals,setWithdrawals]=useState<Load<AdminWithdrawal>>(initial());
  const [settlements,setSettlements]=useState<Load<AdminSettlement>>(initial());
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const intents=useRef<Record<string,AdminOperationIntent|null>>({});

  const [staffAccount,setStaffAccount]=useState("");
  const [staffPermission,setStaffPermission]=useState<"FINANCE"|"SUPPORT">("SUPPORT");
  const [staffActive,setStaffActive]=useState(true);

  const [contentId,setContentId]=useState("");
  const [contentSlug,setContentSlug]=useState("");
  const [contentTitle,setContentTitle]=useState("");
  const [contentText,setContentText]=useState("");
  const [contentVersion,setContentVersion]=useState("0");
  const [contentPublished,setContentPublished]=useState(true);

  const [organizationName,setOrganizationName]=useState("");
  const [organizationReference,setOrganizationReference]=useState("");
  const [membershipOrganization,setMembershipOrganization]=useState("");
  const [membershipAccount,setMembershipAccount]=useState("");
  const [membershipRole,setMembershipRole]=useState<"MANAGER"|"BENEFICIARY">("MANAGER");
  const [membershipRevoke,setMembershipRevoke]=useState("");

  const [feeVersion,setFeeVersion]=useState("");
  const [feeRial,setFeeRial]=useState("");
  const [feeApproval,setFeeApproval]=useState("");

  const loadSummary=useCallback(async(signal?:AbortSignal)=>{
    setSummary({kind:"loading"});
    try{
      const raw=await responseJson(await fetch("/api/admin/operations/summary",{
        cache:"no-store",credentials:"same-origin",redirect:"error",signal,
        headers:{Accept:"application/json"},
      }));
      const parsed=parseAdminSummary(raw);
      setSummary(parsed?{kind:"ready",value:parsed}:
        {kind:"error",message:"پاسخ خلاصه مدیریتی قابل اعتماد نیست."});
    }catch(error){
      if(signal?.aborted)return;
      if(error instanceof AdminOperationError&&(error.status===401||error.status===403))
        setSummary({kind:"denied",message:error.message});
      else setSummary({kind:"error",message:error instanceof Error?error.message:"خطای دریافت خلاصه"});
    }
  },[]);

  const loadResource=useCallback(async<T,>(
    kind:AdminResourceKind,page:number,setter:(value:Load<T>)=>void,
    signal?:AbortSignal,
  )=>{
    setter({kind:"loading"});
    try{
      const raw=await responseJson(await fetch(
        `/api/admin/operations/${kind}?page=${page}`,{
          cache:"no-store",credentials:"same-origin",redirect:"error",signal,
          headers:{Accept:"application/json"},
        }));
      const parsed=parseAdminResourcePage(kind,{items:raw,page,
        ...(kind==="audit"?{}:{pageSize:20})},page);
      setter(parsed?{kind:"ready",items:parsed as T[]}:
        {kind:"error",message:"پاسخ مدیریتی قابل اعتماد نیست."});
    }catch(error){
      if(!signal?.aborted)setter({kind:"error",
        message:error instanceof Error?error.message:"دریافت اطلاعات ناموفق بود."});
    }
  },[]);

  const refresh=useCallback(async()=>{
    await Promise.all([
      loadSummary(),
      loadResource("audit",auditPage,setAudit),
      loadResource("permissions",1,setPermissions),
      loadResource("content",1,setContents),
      loadResource("organizations",1,setOrganizations),
      loadResource("memberships",1,setMemberships),
      loadResource("fee-policies",1,setFees),
      loadResource("withdrawals",1,setWithdrawals),
      loadResource("settlements",1,setSettlements),
    ]);
  },[auditPage,loadResource,loadSummary]);

  useEffect(()=>{
    const controller=new AbortController();
    void loadSummary(controller.signal);
    void loadResource("audit",auditPage,setAudit,controller.signal);
    void loadResource("permissions",1,setPermissions,controller.signal);
    void loadResource("content",1,setContents,controller.signal);
    void loadResource("organizations",1,setOrganizations,controller.signal);
    void loadResource("memberships",1,setMemberships,controller.signal);
    void loadResource("fee-policies",1,setFees,controller.signal);
    void loadResource("withdrawals",1,setWithdrawals,controller.signal);
    void loadResource("settlements",1,setSettlements,controller.signal);
    return()=>controller.abort();
  },[auditPage,loadResource,loadSummary]);

  const command=useCallback(async(action:string,input:unknown,success:string)=>{
    const intent=adminOperationIntent(intents.current[action]??null,action,input);
    intents.current[action]=intent;setBusy(action);setNotice("");
    try{
      await responseJson(await fetch(`/api/admin/operations/commands/${action}`,{
        method:"POST",body:intent.body,cache:"no-store",credentials:"same-origin",
        redirect:"error",headers:{"Content-Type":"application/json",
          "Idempotency-Key":intent.key},
      }));
      intents.current[action]=null;
      setNotice(success);
      await refresh();
    }catch(error){
      if(error instanceof AdminOperationError&&error.status===503){
        setNotice("نتیجه درخواست قطعی نیست؛ همان اقدام را بدون تغییر ورودی دوباره بزنید تا با همان کلید تکرار شود.");
      }else{
        intents.current[action]=null;
        setNotice(error instanceof Error?error.message:"عملیات مدیریتی ناموفق بود.");
        if(error instanceof AdminOperationError&&error.status===409) await refresh();
      }
    }finally{setBusy(null);}
  },[refresh]);

  if(summary.kind==="denied")return(
    <main className="admin-ops admin-ops--denied">
      <img src="/hana-logo.png" alt="حنا" className="support-panel__logo"/>
      <h1>عملیات ادمین</h1><p role="alert">{summary.message}</p>
      <Link href="/" className="auth-card__secondary">بازگشت به حنا</Link>
    </main>
  );

  const submitStaff=(event:FormEvent)=>{
    event.preventDefault();
    if(!adminOperationId(staffAccount)){setNotice("شناسه حساب معتبر نیست.");return;}
    void command("SET_STAFF_PERMISSION",{
      accountId:staffAccount,permission:staffPermission,active:staffActive,
    },"مجوز تخصصی کاربر ثبت شد.");
  };
  const submitContent=(event:FormEvent)=>{
    event.preventDefault();
    const expected=Number(contentVersion);
    if(!Number.isSafeInteger(expected)||expected<0){setNotice("نسخه محتوا معتبر نیست.");return;}
    void command("SAVE_CONTENT",{slug:contentSlug,title:contentTitle,
      text:contentText,expectedVersion:expected},"محتوا با نسخه جدید ذخیره شد.");
  };
  const publishContent=()=>{
    const version=Number(contentVersion);
    if(!adminOperationId(contentId)||!Number.isSafeInteger(version)||version<0){
      setNotice("شناسه و نسخه محتوا برای انتشار معتبر نیست.");return;
    }
    void command("PUBLISH_CONTENT",{contentId,published:contentPublished,
      expectedVersion:version},"وضعیت انتشار محتوا ثبت شد.");
  };
  const createOrganization=(event:FormEvent)=>{
    event.preventDefault();
    void command("CREATE_ORGANIZATION",{name:organizationName,
      registrationReference:organizationReference},"سازمان ثبت شد.");
  };
  const grantMembership=(event:FormEvent)=>{
    event.preventDefault();
    if(!adminOperationId(membershipOrganization)||!adminOperationId(membershipAccount)){
      setNotice("شناسه سازمان یا حساب معتبر نیست.");return;
    }
    void command("GRANT_ORGANIZATION_MEMBER",{
      organizationId:membershipOrganization,accountId:membershipAccount,
      role:membershipRole,
    },"عضویت سازمانی ثبت شد.");
  };
  const revokeMembership=()=>{
    if(!adminOperationId(membershipRevoke)){setNotice("شناسه عضویت معتبر نیست.");return;}
    void command("REVOKE_ORGANIZATION_MEMBER",{membershipId:membershipRevoke},
      "عضویت سازمانی لغو شد.");
  };
  const setFee=(event:FormEvent)=>{
    event.preventDefault();
    const amount=money(feeRial);
    if(amount===null){setNotice("کارمزد باید عدد صحیح ریالی باشد.");return;}
    void command("SET_FEE_POLICY",{version:feeVersion,fixedInvoiceFeeRial:amount,
      approvalReference:feeApproval},"نسخه کارمزد ثبت شد؛ هیچ پرداخت بانکی انجام نشده است.");
  };

  return(
    <main className="admin-ops">
      <header className="admin-ops__header">
        <div>
          <img src="/hana-logo.png" alt="حنا" className="support-panel__logo"/>
          <p className="seller-panel__eyebrow">کنسول داخلی حنا</p>
          <h1>عملیات ادمین</h1>
          <p>این صفحه فقط عملیات داخلی موجود را به backend واقعی وصل می‌کند؛ انتقال بانکی، پیامک و لجستیک خارجی در این کنسول جعل نمی‌شوند.</p>
        </div>
        <div className="admin-ops__header-actions">
          <Link href="/admin/sellers" className="auth-card__secondary">بررسی فروشندگان</Link>
          <button type="button" className="seller-commerce__refresh"
            disabled={busy!==null} onClick={()=>void refresh()}>تازه‌سازی</button>
        </div>
      </header>

      {notice&&<p className="form-status admin-ops__notice" role="status">{notice}</p>}

      <section className="admin-ops__section">
        <h2>نمای عملیاتی</h2>
        {summary.kind==="loading"&&<p className="form-status">در حال دریافت خلاصه…</p>}
        {summary.kind==="error"&&<p role="alert" className="form-status form-status--error">{summary.message}</p>}
        {summary.kind==="ready"&&(
          <div className="admin-ops__metrics">
            <article><span>سفارش‌ها</span><strong>{summary.value.orders}</strong></article>
            <article><span>تحویل‌شده</span><strong>{summary.value.collected}</strong></article>
            <article><span>لغوشده</span><strong>{summary.value.cancelled}</strong></article>
            <article><span>پرونده باز</span><strong>{summary.value.openIncidents}</strong></article>
            <article><span>تسویه آماده</span><strong>{summary.value.preparedSettlements}</strong></article>
            <article><span>فروش ناخالص</span><strong>{adminRial(summary.value.grossRial)}</strong></article>
          </div>
        )}
      </section>

      <section className="admin-ops__grid">
        <article className="admin-ops__section">
          <h2>مجوزهای FINANCE / SUPPORT</h2>
          <form onSubmit={submitStaff} className="admin-ops__form">
            <input className="field__input" placeholder="UUID حساب"
              value={staffAccount} onChange={e=>setStaffAccount(e.target.value)}/>
            <select className="field__input" value={staffPermission}
              onChange={e=>setStaffPermission(e.target.value as "FINANCE"|"SUPPORT")}>
              <option value="SUPPORT">SUPPORT</option><option value="FINANCE">FINANCE</option>
            </select>
            <label className="admin-ops__check"><input type="checkbox"
              checked={staffActive} onChange={e=>setStaffActive(e.target.checked)}/>فعال</label>
            <button className="primary-button" disabled={busy!==null}>ثبت مجوز</button>
          </form>
          <Resource state={permissions} empty="مجوزی ثبت نشده است.">
            {item=><p key={item.id}><bdi dir="ltr">{item.accountId}</bdi> — {item.permission} — {item.active?"فعال":"غیرفعال"}</p>}
          </Resource>
        </article>

        <article className="admin-ops__section">
          <h2>CMS داخلی</h2>
          <form onSubmit={submitContent} className="admin-ops__form">
            <input className="field__input" placeholder="slug" value={contentSlug}
              onChange={e=>setContentSlug(e.target.value)}/>
            <input className="field__input" placeholder="عنوان" value={contentTitle}
              onChange={e=>setContentTitle(e.target.value)}/>
            <textarea className="field__input admin-ops__textarea" placeholder="متن"
              value={contentText} onChange={e=>setContentText(e.target.value)}/>
            <input className="field__input" inputMode="numeric" placeholder="expectedVersion"
              value={contentVersion} onChange={e=>setContentVersion(e.target.value)}/>
            <button className="primary-button" disabled={busy!==null}>ذخیره محتوا</button>
          </form>
          <div className="admin-ops__form">
            <input className="field__input" placeholder="UUID محتوا"
              value={contentId} onChange={e=>setContentId(e.target.value)}/>
            <label className="admin-ops__check"><input type="checkbox"
              checked={contentPublished} onChange={e=>setContentPublished(e.target.checked)}/>منتشر باشد</label>
            <button type="button" className="primary-button" disabled={busy!==null}
              onClick={publishContent}>ثبت وضعیت انتشار</button>
          </div>
          <Resource state={contents} empty="محتوایی ثبت نشده است.">
            {item=><p key={item.id}><b>{item.title}</b> — {item.slug} — نسخه {item.version} — {item.published?"منتشر":"پیش‌نویس"}</p>}
          </Resource>
        </article>

        <article className="admin-ops__section">
          <h2>سازمان و عضویت</h2>
          <form onSubmit={createOrganization} className="admin-ops__form">
            <input className="field__input" placeholder="نام سازمان"
              value={organizationName} onChange={e=>setOrganizationName(e.target.value)}/>
            <input className="field__input" placeholder="مرجع ثبت/قرارداد"
              value={organizationReference} onChange={e=>setOrganizationReference(e.target.value)}/>
            <button className="primary-button" disabled={busy!==null}>ایجاد سازمان</button>
          </form>
          <form onSubmit={grantMembership} className="admin-ops__form">
            <input className="field__input" placeholder="UUID سازمان"
              value={membershipOrganization} onChange={e=>setMembershipOrganization(e.target.value)}/>
            <input className="field__input" placeholder="UUID حساب"
              value={membershipAccount} onChange={e=>setMembershipAccount(e.target.value)}/>
            <select className="field__input" value={membershipRole}
              onChange={e=>setMembershipRole(e.target.value as "MANAGER"|"BENEFICIARY")}>
              <option value="MANAGER">MANAGER</option><option value="BENEFICIARY">BENEFICIARY</option>
            </select>
            <button className="primary-button" disabled={busy!==null}>ثبت عضویت</button>
          </form>
          <div className="admin-ops__form">
            <input className="field__input" placeholder="UUID عضویت برای لغو"
              value={membershipRevoke} onChange={e=>setMembershipRevoke(e.target.value)}/>
            <button type="button" className="seller-commerce__refresh"
              disabled={busy!==null} onClick={revokeMembership}>لغو عضویت</button>
          </div>
          <Resource state={organizations} empty="سازمانی ثبت نشده است.">
            {item=><p key={item.id}><b>{item.name}</b> — <bdi dir="ltr">{item.id}</bdi></p>}
          </Resource>
          <Resource state={memberships} empty="عضوی ثبت نشده است.">
            {item=><p key={item.id}>{item.role} — <bdi dir="ltr">{item.accountId}</bdi></p>}
          </Resource>
        </article>

        <article className="admin-ops__section">
          <h2>مالی داخلی؛ بدون اعلام پرداخت بانکی</h2>
          <form onSubmit={setFee} className="admin-ops__form">
            <input className="field__input" placeholder="نسخه سیاست"
              value={feeVersion} onChange={e=>setFeeVersion(e.target.value)}/>
            <input className="field__input" inputMode="numeric" placeholder="کارمزد ثابت ریال"
              value={feeRial} onChange={e=>setFeeRial(e.target.value)}/>
            <input className="field__input" placeholder="مرجع تصویب"
              value={feeApproval} onChange={e=>setFeeApproval(e.target.value)}/>
            <button className="primary-button" disabled={busy!==null}>ثبت سیاست کارمزد</button>
          </form>
          <div className="admin-ops__button-row">
            <button type="button" className="primary-button" disabled={busy!==null}
              onClick={()=>void command("BUILD_SETTLEMENTS",{},
                "تسویه‌های واجد شرایط فقط آماده شدند؛ انتقال بانکی انجام نشده است.")}>
              آماده‌سازی تسویه
            </button>
            <button type="button" className="seller-commerce__refresh" disabled={busy!==null}
              onClick={()=>void command("ASSESS_WITHDRAWAL_SLA",{},
                "SLA برداشت‌های معوق ارزیابی شد؛ انتقال بانکی انجام نشده است.")}>
              ارزیابی SLA برداشت
            </button>
          </div>
          <Resource state={fees} empty="سیاست کارمزدی ثبت نشده است.">
            {item=><p key={item.id}>{item.version} — {adminRial(item.fixedInvoiceFeeRial)} — {item.approvalReference}</p>}
          </Resource>
          <h3>برداشت‌ها</h3>
          <Resource state={withdrawals} empty="برداشتی ثبت نشده است.">
            {item=><p key={item.id}>{adminRial(item.amountRial)} — {item.state} — سررسید {adminTime(item.dueAtUtc)} {item.slaEscalated?"— escalated":""}</p>}
          </Resource>
          <h3>تسویه‌های آماده</h3>
          <Resource state={settlements} empty="تسویه‌ای آماده نشده است.">
            {item=><p key={item.id}>{adminRial(item.netRial)} — {item.state} — سفارش <bdi dir="ltr">{item.orderId}</bdi></p>}
          </Resource>
        </article>
      </section>

      <section className="admin-ops__section">
        <div className="seller-commerce__section-title">
          <h2>Audit عملیاتی</h2><span>صفحه {auditPage}</span>
        </div>
        <Resource state={audit} empty="رخداد audit در این صفحه نیست.">
          {item=><p key={item.id}><b>{item.event}</b> — {adminTime(item.createdAtUtc)} — actor <bdi dir="ltr">{item.actorId}</bdi> — resource <bdi dir="ltr">{item.resourceId}</bdi></p>}
        </Resource>
        <div className="seller-commerce__pager">
          <button type="button" disabled={auditPage===1||busy!==null}
            onClick={()=>setAuditPage(p=>Math.max(1,p-1))}>صفحه قبل</button>
          <button type="button" disabled={audit.kind!=="ready"||audit.items.length<20||busy!==null}
            onClick={()=>setAuditPage(p=>p+1)}>صفحه بعد</button>
        </div>
      </section>
    </main>
  );
}

function Resource<T>({state,empty,children}:{
  state:Load<T>;empty:string;children:(item:T)=>React.ReactNode;
}){
  if(state.kind==="loading")return <p className="form-status">در حال دریافت…</p>;
  if(state.kind==="error")return <p className="form-status form-status--error" role="alert">{state.message}</p>;
  if(!state.items.length)return <p className="seller-commerce__empty">{empty}</p>;
  return <div className="admin-ops__list">{state.items.map(children)}</div>;
}
