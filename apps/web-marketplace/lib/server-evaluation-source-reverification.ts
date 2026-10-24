import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore,
  sessionCookieName } from "./server-auth";
import { validEvaluationReverificationSelection,
  parseEvaluationSourceReverification } from "./evaluation-source-reverification";

export async function forwardEvaluationSourceReverification(request:NextRequest) {
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
  const input=await request.text().catch(()=>"");
  if(!input||input.length>1000)return fail("شناسه‌های انتخاب‌شده نامعتبرند.",400);
  let raw:unknown;
  try {raw=JSON.parse(input);} catch {return fail("درخواست معتبر نیست.",400);}
  if(!validEvaluationReverificationSelection(raw))
    return fail("انتخاب صریح اثر و Evaluation لازم است.",400);
  const url=hanaAuthApiUrl(
    "/api/v1/admin/allocation-proposals/research/evaluation-source-reverification/preview");
  if(!url)return fail("سرویس در دسترس نیست.",503);
  try {
    const res=await fetch(url,{method:"POST",cache:"no-store",
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify(raw),signal:AbortSignal.timeout(30000)});
    if(!res.ok)return fail(res.status===403?"دسترسی ادمین لازم است.":
      res.status===401?"نشست معتبر نیست.":
      res.status===400?"رکورد انتخابی نامعتبر است.":
      "محتوای Evaluation با رکوردهای موجود قابل تأیید نیست.",
      [400,401,403].includes(res.status)?res.status:503);
    const response=await res.text();
    if(response.length>12000)return fail("پاسخ بیش از اندازه است.",503);
    const validated=parseEvaluationSourceReverification(JSON.parse(response),raw);
    if(!validated)return fail("نتیجه بازبینی داده‌ها قابل تأیید نیست.",503);
    return NextResponse.json(validated,{headers:noStore});
  } catch {
    return fail("بازبینی داده‌ها ناموفق است؛ هیچ نسخه‌ای پذیرفته نشده.",503);
  }
}
