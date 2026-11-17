import { NextRequest, NextResponse } from "next/server";
import { hanaAuthApiUrl,noStore } from "../../../../../lib/server-auth";
import { publicIntakeCookie, publicIntakeTokenPattern, validPublicIntakeReceipt } from "../../../../../lib/public-seller-intake";

export async function GET(request: NextRequest) {
  const secret=request.cookies.get(publicIntakeCookie)?.value;
  if (!secret || !publicIntakeTokenPattern.test(secret))
    return NextResponse.json({message:"رسید ثبت درخواست در این مرورگر موجود نیست."},
      {status:401,headers:noStore});
  const target=hanaAuthApiUrl("/api/v1/seller/public-registration/status");
  if (!target) return NextResponse.json({message:"خدمت پیگیری در دسترس نیست."},
    {status:503,headers:noStore});
  try {
    const result=await fetch(target,{
      headers:{"X-Hana-Seller-Intake-Token":secret},
      cache:"no-store",signal:AbortSignal.timeout(8000)
    });
    if(result.status===404) return NextResponse.json({message:"درخواستی پیدا نشد."},
      {status:404,headers:noStore});
    if(!result.ok) return NextResponse.json({message:"وضعیت درخواست قابل تأیید نیست."},
      {status:503,headers:noStore});
    const body:unknown=await result.json();
    if(!validPublicIntakeReceipt(body))
      return NextResponse.json({message:"پاسخ وضعیت معتبر نیست."},
        {status:503,headers:noStore});
    return NextResponse.json(body,{headers:noStore});
  }catch {
    return NextResponse.json({message:"وضعیت درخواست قابل تأیید نیست."},
      {status:503,headers:noStore});
  }
}
