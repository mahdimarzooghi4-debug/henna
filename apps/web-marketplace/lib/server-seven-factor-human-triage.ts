import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin,
  noStore, sessionCookieName } from "./server-auth";
import {validTriageSelection,parseTriageResult} from "./seven-factor-human-triage";

export async function forwardHumanReviewTriage(request:NextRequest) {
  const fail=(message:string,status:number)=>NextResponse.json({message},
    {status,headers:noStore});
  if(request.method!=="POST")return fail("درخواست معتبر نیست.",405);
  if(!isSameOrigin(request))return fail("مبدأ معتبر نیست.",403);
  if(request.nextUrl.search)return fail("پارامتر اضافی مجاز نیست.",400);
  if(!request.headers.get("content-type")?.startsWith("application/json"))
    return fail("نوع درخواست معتبر نیست.",400);
  const token=request.cookies.get(sessionCookieName)?.value;
  if(!token||!accessTokenPattern.test(token))
    return fail("ابتدا وارد شوید.",401);
  const body=await request.text().catch(()=>"");
  if(!body||body.length>24000)return fail("درخواست بیش از اندازه است.",400);
  let parsed:unknown;
  try{parsed=JSON.parse(body);}catch{return fail("درخواست معتبر نیست.",400);}
  if(!validTriageSelection(parsed))
    return fail("شناسه‌ها و زمان UTC معتبر لازم است.",400);
  const endpoint=hanaAuthApiUrl(
    "/api/v1/admin/allocation-proposals/research/seven-factor/human-review-triage/preview");
  if(!endpoint)return fail("سرویس در دسترس نیست.",503);
  try{
    const response=await fetch(endpoint,{
      method:"POST",cache:"no-store",
      headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify(parsed),signal:AbortSignal.timeout(30000)
    });
    if(!response.ok)return fail(response.status===403?"دسترسی ادمین لازم است.":
      response.status===401?"نشست معتبر نیست.":
      response.status===400?"بازبینی انتخابی یافت نشد یا نسب‌نامه آن ناقص است.":
      "بررسی تعارض‌های انسانی ممکن نشد.",
      [400,401,403].includes(response.status)?response.status:503);
    const raw=await response.text();
    if(raw.length>100000)return fail("پاسخ بیش از اندازه است.",503);
    const verified=parseTriageResult(JSON.parse(raw),parsed);
    if(!verified)return fail("پاسخ کاربرگ انسانی با انتخاب مطابقت ندارد.",503);
    return NextResponse.json(verified,{headers:noStore});
  }catch{return fail("پاسخ نامطمئن است؛ هیچ قضاوتی تغییر نکرد.",503);}
}
