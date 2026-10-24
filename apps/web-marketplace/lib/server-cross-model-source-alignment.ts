import { NextRequest, NextResponse } from "next/server";
import { accessTokenPattern, hanaAuthApiUrl, isSameOrigin, noStore,
  sessionCookieName } from "./server-auth";
import { parsePeerAlignment, validPeerSelection } from "./cross-model-source-alignment";

export async function forwardPeerAlignment(request:NextRequest) {
  const fail=(message:string,status:number)=>NextResponse.json({message},
    {status,headers:noStore});
  if(request.method!=="POST")return fail("درخواست معتبر نیست.",405);
  if(!isSameOrigin(request))return fail("مبدأ نامعتبر است.",403);
  if(request.nextUrl.search)return fail("پارامتر اضافی مجاز نیست.",400);
  if(!request.headers.get("content-type")?.startsWith("application/json"))
    return fail("نوع درخواست معتبر نیست.",400);
  const token=request.cookies.get(sessionCookieName)?.value;
  if(!token||!accessTokenPattern.test(token))return fail("ابتدا وارد شوید.",401);
  const input=await request.text().catch(()=>"");
  if(!input||input.length>1000)return fail("انتخاب‌ها معتبر نیستند.",400);
  let raw:unknown;
  try {raw=JSON.parse(input);}catch{return fail("درخواست نامعتبر است.",400);}
  if(!validPeerSelection(raw))return fail("چهار شناسه صریح معتبر لازم است.",400);
  const target=hanaAuthApiUrl(
    "/api/v1/admin/allocation-proposals/research/cross-model-source-alignment/preview");
  if(!target)return fail("سرویس در دسترس نیست.",503);
  try {
    const res=await fetch(target,{method:"POST",cache:"no-store",
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify(raw),signal:AbortSignal.timeout(30000)});
    if(!res.ok)return fail(res.status===403?"دسترسی مدیر لازم است.":
      res.status===401?"نشست معتبر نیست.":
      res.status===400?"انتخاب دو مدل معتبر نیست.":
      "بازبینی مقایسه‌ای داده‌های ذخیره‌شده ممکن نشد.",
      [400,401,403].includes(res.status)?res.status:503);
    const body=await res.text();
    if(body.length>12000)return fail("پاسخ بیش از اندازه است.",503);
    const parsed=parsePeerAlignment(JSON.parse(body),raw);
    if(!parsed)return fail("پاسخ مقایسه با هویت موردنظر منطبق نیست.",503);
    return NextResponse.json(parsed,{headers:noStore});
  }catch{return fail("مقایسه ناموفق است؛ هیچ مدل یا Dataset پذیرفته نشده.",503);}
}
