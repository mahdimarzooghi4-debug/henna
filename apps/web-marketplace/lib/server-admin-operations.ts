import { NextRequest, NextResponse } from "next/server";
import {
  accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore, sessionCookieName,
} from "./server-auth";
import {
  adminOperationId, parseAdminCommandResponse, parseAdminResourcePage, parseAdminSummary,
  type AdminResourceKind,
} from "./admin-operations";

async function boundedText(source: Request | Response, max: number) {
  if (!source.body) throw Error();
  const reader=source.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let size=0,out="";
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>max){await reader.cancel();throw Error();}
      out+=decoder.decode(value,{stream:true});
    }
    return out+decoder.decode();
  } finally { reader.releaseLock(); }
}
async function boundedJson(response: Response, max:number):Promise<unknown>{
  return JSON.parse(await boundedText(response,max));
}
const fail=(status:number,message:string)=>
  NextResponse.json({message},{status,headers:noStore});
const cleanText=(v:unknown,max:number)=>
  typeof v==="string"&&v.trim()&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v)
    ? v.trim():null;
const page=(request:NextRequest)=>{
  if(request.nextUrl.searchParams.size===0)return 1;
  if(request.nextUrl.searchParams.size!==1)return null;
  const raw=request.nextUrl.searchParams.get("page");
  return raw&&/^[1-9][0-9]{0,3}$/.test(raw)&&Number(raw)<=10000?Number(raw):null;
};

const resourceMap:Record<string,{kind:string;parse:AdminResourceKind}> = {
  audit:{kind:"AUDIT",parse:"audit"},
  permissions:{kind:"PERMISSION",parse:"permissions"},
  content:{kind:"CONTENT",parse:"content"},
  organizations:{kind:"ORGANIZATION",parse:"organizations"},
  memberships:{kind:"MEMBERSHIP",parse:"memberships"},
  "fee-policies":{kind:"FEE_VERSION",parse:"fee-policies"},
  withdrawals:{kind:"WITHDRAWAL",parse:"withdrawals"},
  settlements:{kind:"SETTLEMENT",parse:"settlements"},
  programs:{kind:"PROGRAM",parse:"programs"},
  credits:{kind:"CREDIT",parse:"credits"},
  households:{kind:"HOUSEHOLD",parse:"households"},
};
const actions=new Set([
  "SET_STAFF_PERMISSION","SAVE_CONTENT","PUBLISH_CONTENT",
  "CREATE_ORGANIZATION","GRANT_ORGANIZATION_MEMBER",
  "REVOKE_ORGANIZATION_MEMBER","SET_FEE_POLICY",
  "BUILD_SETTLEMENTS","ASSESS_WITHDRAWAL_SLA",
  "CREATE_PROGRAM","ALLOCATE_CREDIT","LINK_HOUSEHOLD",
]);

function validate(action:string,raw:unknown):Record<string,unknown>|null{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
  const x=raw as Record<string,unknown>;
  if(action==="SET_STAFF_PERMISSION")
    return adminOperationId(x.accountId)&&["FINANCE","SUPPORT"].includes(String(x.permission))&&
      typeof x.active==="boolean"
      ? {accountId:x.accountId,permission:x.permission,active:x.active}:null;
  if(action==="LINK_HOUSEHOLD"){
    const evidence=cleanText(x.evidenceReference,1000);
    return adminOperationId(x.accountId)&&adminOperationId(x.householdKey)&&evidence
      ? {accountId:x.accountId,householdKey:x.householdKey,
        evidenceReference:evidence}:null;
  }
  if(action==="CREATE_PROGRAM"){
    const name=cleanText(x.name,120),funding=cleanText(x.fundingReference,1000);
    const categories=Array.isArray(x.categoryIds)?x.categoryIds:null;
    const organization=x.organizationId;
    if(!name||!funding||!Number.isSafeInteger(x.fundedRial)||
       Number(x.fundedRial)<1||typeof x.expiresAtUtc!=="string"||
       x.expiresAtUtc.length>50||!Number.isFinite(Date.parse(x.expiresAtUtc))||
       !categories||categories.length<1||categories.length>100||
       categories.some(id=>!adminOperationId(id))||
       new Set(categories).size!==categories.length||
       !(organization===null||adminOperationId(organization))) return null;
    return {name,fundingReference:funding,fundedRial:x.fundedRial,
      expiresAtUtc:x.expiresAtUtc,categoryIds:categories,
      organizationId:organization};
  }
  if(action==="ALLOCATE_CREDIT"){
    if(!adminOperationId(x.programId)||!Number.isSafeInteger(x.poolRial)||
       Number(x.poolRial)<1||!Array.isArray(x.beneficiaries)||
       x.beneficiaries.length<1||x.beneficiaries.length>500) return null;
    const beneficiaries=[];
    for(const raw of x.beneficiaries){
      if(!raw||typeof raw!=="object"||Array.isArray(raw)) return null;
      const item=raw as Record<string,unknown>;
      const scores=item.scores;
      if(!adminOperationId(item.accountId)||!adminOperationId(item.householdKey)||
         typeof item.geographicFactor!=="number"||
         !Number.isFinite(item.geographicFactor)||item.geographicFactor<=0||
         !scores||typeof scores!=="object"||Array.isArray(scores)) return null;
      const sr=scores as Record<string,unknown>;
      const cleanScores:Record<string,number>={};
      for(const name of ["health","hardship","age","size","care","education"]){
        const score=sr[name];
        if(!Number.isSafeInteger(score)||Number(score)<0||Number(score)>3)return null;
        cleanScores[name]=Number(score);
      }
      beneficiaries.push({accountId:item.accountId,householdKey:item.householdKey,
        geographicFactor:item.geographicFactor,scores:cleanScores});
    }
    return {programId:x.programId,poolRial:x.poolRial,beneficiaries};
  }
  if(action==="SAVE_CONTENT"){
    const slug=cleanText(x.slug,100),title=cleanText(x.title,200),body=cleanText(x.text,10000);
    return slug&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&title&&body&&
      Number.isSafeInteger(x.expectedVersion)&&Number(x.expectedVersion)>=0
      ? {slug,title,text:body,expectedVersion:x.expectedVersion}:null;
  }
  if(action==="PUBLISH_CONTENT")
    return adminOperationId(x.contentId)&&typeof x.published==="boolean"&&
      Number.isSafeInteger(x.expectedVersion)&&Number(x.expectedVersion)>=0
      ? {contentId:x.contentId,published:x.published,expectedVersion:x.expectedVersion}:null;
  if(action==="CREATE_ORGANIZATION"){
    const name=cleanText(x.name,200),ref=cleanText(x.registrationReference,1000);
    return name&&ref?{name,registrationReference:ref}:null;
  }
  if(action==="GRANT_ORGANIZATION_MEMBER")
    return adminOperationId(x.organizationId)&&adminOperationId(x.accountId)&&
      ["MANAGER","BENEFICIARY"].includes(String(x.role))
      ? {organizationId:x.organizationId,accountId:x.accountId,role:x.role}:null;
  if(action==="REVOKE_ORGANIZATION_MEMBER")
    return adminOperationId(x.membershipId)?{membershipId:x.membershipId}:null;
  if(action==="SET_FEE_POLICY"){
    const version=cleanText(x.version,120),ref=cleanText(x.approvalReference,1000);
    return version&&ref&&Number.isSafeInteger(x.fixedInvoiceFeeRial)&&
      Number(x.fixedInvoiceFeeRial)>=0
      ? {version,fixedInvoiceFeeRial:x.fixedInvoiceFeeRial,approvalReference:ref}:null;
  }
  if(action==="BUILD_SETTLEMENTS"||action==="ASSESS_WITHDRAWAL_SLA")
    return Object.keys(x).length===0?{}:null;
  return null;
}

export async function forwardAdminOperations(
  request:NextRequest,segments:string[],method:"GET"|"POST",
){
  const token=request.cookies.get(sessionCookieName)?.value;
  if(!token||!accessTokenPattern.test(token))
    return fail(401,"برای دسترسی مدیریتی ابتدا وارد شوید.");

  let upstream="",expectedPage=1,parseKind:AdminResourceKind|null=null;
  let body:string|undefined,key:string|undefined,summary=false;

  if(method==="GET"&&segments.length===1&&segments[0]==="summary"&&
      request.nextUrl.searchParams.size===0){
    upstream="/api/v1/commerce/resources/SUMMARY"; summary=true;
  } else if(method==="GET"&&segments.length===1&&resourceMap[segments[0]]){
    const p=page(request); if(p===null)return fail(400,"صفحه‌بندی معتبر نیست.");
    expectedPage=p; const mapped=resourceMap[segments[0]];
    parseKind=mapped.parse;
    upstream=`/api/v1/commerce/resources/${mapped.kind}?page=${p}`;
  } else if(method==="POST"&&segments.length===2&&segments[0]==="commands"&&
      actions.has(segments[1])&&request.nextUrl.searchParams.size===0){
    if(!isSameOrigin(request))return fail(403,"مبدأ درخواست معتبر نیست.");
    key=request.headers.get("Idempotency-Key")??undefined;
    if(!adminOperationId(key)||
       !request.headers.get("content-type")?.startsWith("application/json"))
      return fail(400,"درخواست مدیریتی معتبر نیست.");
    try{
      const parsed=validate(segments[1],JSON.parse(await boundedText(request,65536)));
      if(!parsed)return fail(400,"اطلاعات عملیات معتبر نیست.");
      body=JSON.stringify(parsed);
    }catch{return fail(400,"اطلاعات عملیات معتبر نیست.");}
    upstream="/api/v1/commerce/commands/"+segments[1];
  } else return fail(404,"مسیر مدیریتی معتبر نیست.");

  const target=hanaAuthApiUrl(upstream);
  if(!target)return fail(503,"سرویس عملیات ادمین آماده نیست.");
  try{
    const response=await fetch(target,{
      method,body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000),
      headers:{
        Accept:"application/json",Authorization:`Bearer ${token}`,
        ...(method==="POST"?{"Content-Type":"application/json","Idempotency-Key":key!}:{}),
      },
    });
    if(!response.ok){
      const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
      const messages:Record<number,string>={
        400:"اطلاعات عملیات معتبر نیست.",401:"نشست معتبر نیست؛ دوباره وارد شوید.",
        403:"این عملیات فقط برای مدیر یا مجوز تخصصی مربوطه مجاز است.",
        404:"منبع مدیریتی پیدا نشد.",409:"وضعیت سرور تغییر کرده است؛ اطلاعات را تازه کنید.",
        429:"تعداد عملیات زیاد است؛ کمی بعد دوباره تلاش کنید.",
        503:"سرویس عملیات ادمین آماده نیست.",
      };
      return fail(status,messages[status]??messages[503]);
    }
    if(response.status!==200||
       !response.headers.get("content-type")?.includes("application/json"))
      return fail(503,"پاسخ عملیات ادمین قابل تأیید نیست.");
    const raw=await boundedJson(response,1024*1024);
    if(method==="POST"){
      const parsed=parseAdminCommandResponse(segments[1],raw);
      return parsed?NextResponse.json(parsed,{headers:noStore}):
        fail(503,"پاسخ عملیات ادمین قابل اعتماد نیست.");
    }
    if(summary){
      const parsed=parseAdminSummary(raw);
      return parsed?NextResponse.json(parsed,{headers:noStore}):
        fail(503,"پاسخ خلاصه مدیریتی قابل اعتماد نیست.");
    }
    const parsed=parseAdminResourcePage(parseKind!,raw,expectedPage);
    return parsed?NextResponse.json(parsed,{headers:noStore}):
      fail(503,"پاسخ منبع مدیریتی قابل اعتماد نیست.");
  }catch{return fail(503,"سرویس عملیات ادمین آماده نیست.");}
}
