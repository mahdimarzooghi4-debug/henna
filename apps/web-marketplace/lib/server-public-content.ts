import { hanaAuthApiUrl } from "./server-auth";

export type PublishedContent = {
  slug: string;
  title: string;
  text: string;
};

type PublishedContentResult =
  | { status: "ok"; content: PublishedContent }
  | { status: "missing" }
  | { status: "unavailable" };

const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const plain=(value:unknown,max:number):value is string=>
  typeof value==="string"&&value.trim().length>0&&value.length<=max&&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);

export async function publishedContent(
  slug:string,
):Promise<PublishedContentResult>{
  if(!slugPattern.test(slug)||slug.length>100)return{status:"missing"};
  const target=hanaAuthApiUrl("/api/v1/content/"+slug);
  if(!target)return{status:"unavailable"};
  try{
    const response=await fetch(target,{
      method:"GET",cache:"no-store",redirect:"error",
      headers:{Accept:"application/json"},
      signal:AbortSignal.timeout(8000),
    });
    if(response.status===404)return{status:"missing"};
    if(response.status!==200||
       !response.headers.get("content-type")?.includes("application/json")||
       Number(response.headers.get("content-length")??"0")>20000)
      return{status:"unavailable"};
    const raw=await response.text();
    if(raw.length>20000)return{status:"unavailable"};
    const value=JSON.parse(raw) as unknown;
    if(!value||typeof value!=="object"||Array.isArray(value))
      return{status:"unavailable"};
    const x=value as Record<string,unknown>;
    if(x.slug!==slug||!plain(x.title,200)||!plain(x.text,10000))
      return{status:"unavailable"};
    return{status:"ok",content:{slug,title:x.title,text:x.text}};
  }catch{return{status:"unavailable"};}
}
