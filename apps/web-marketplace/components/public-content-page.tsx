import { SiteHeader } from "./site-header";
import { publishedContent } from "../lib/server-public-content";

export async function PublicContentPage({
  slug,fallbackTitle,
}:{slug:string;fallbackTitle:string}){
  const result=await publishedContent(slug);
  return <>
    <SiteHeader backHref="/" backLabel="بازگشت به صفحه اصلی"/>
    <main dir="rtl" className="public-content">
      <p className="public-content__eyebrow">اطلاعات حنا</p>
      {result.status==="ok"?<>
        <h1>{result.content.title}</h1>
        <div className="public-content__body">
          {result.content.text.split(/\r?\n/).map((line,index)=>
            line.trim()?<p key={index}>{line}</p>:<br key={index}/>)}
        </div>
      </>:result.status==="missing"?<>
        <h1>{fallbackTitle}</h1>
        <div className="buyer-panel">
          <p>این محتوا هنوز توسط ادمین حنا منتشر نشده است.</p>
        </div>
      </>:<>
        <h1>{fallbackTitle}</h1>
        <div className="buyer-panel buyer-panel--error" role="alert">
          <p>دریافت محتوای منتشرشده از سرور تأیید نشد. بعداً دوباره تلاش کنید.</p>
        </div>
      </>}
    </main>
  </>;
}
