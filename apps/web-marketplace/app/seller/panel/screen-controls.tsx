"use client";
import { createContext, useContext, useRef, useState, useEffect, type ReactNode, type HTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import styles from "./screen-frame.module.css";

type State = {section:string;query:string;setQuery:(s:string)=>void;values:Record<string,string>;setValue:(id:string,value:string)=>void;hidden:Set<string>;pressed:Set<string>;act:(label:string,name:string,id:string,row:string)=>void};
const Context=createContext<State|null>(null);
function useScreen(){const c=useContext(Context);if(!c)throw new Error("Seller screen context missing");return c;}
export function ScreenFrame({section,children}:{section:string;children:ReactNode}){
 const router=useRouter();const root=useRef<HTMLDivElement>(null),file=useRef<HTMLInputElement>(null);
 const [query,setQuery]=useState("");const [values,setValues]=useState<Record<string,string>>({});const [hidden,setHidden]=useState(new Set<string>());const [pressed,setPressed]=useState(new Set<string>());const [notice,setNotice]=useState("");
 const [dialog,setDialog]=useState<{title:string;kind:string;row:string}|null>(null);const [draft,setDraft]=useState("");const [preview,setPreview]=useState<string|null>(null);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 function toggle(id:string){setPressed(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next})}
 function setValue(id:string,value:string){setValues(prev=>({...prev,[id]:value}));}
 function act(label:string,name:string,id:string,row:string){
  if(/خروج از حساب/.test(label)){void fetch('/api/auth/session',{method:'DELETE',credentials:'same-origin',cache:'no-store'}).then(r=>{if(r.ok||r.status===401)window.location.assign('/auth');else setNotice('خروج تأیید نشد؛ دوباره تلاش کنید.')}).catch(()=>setNotice('ارتباط برقرار نشد؛ دوباره تلاش کنید.'));return;}
  if(/back-trigger|cancel-btn/.test(name)||/^بازگشت/.test(label)){router.push(section==='order-detail'?'/seller/orders':'/seller/panel/products');return;}
  if(/خوانده/.test(label)||/read-all/.test(name)){toggle(id);setNotice('اعلان‌های این نمایش به‌عنوان خوانده‌شده علامت‌گذاری شدند.');return;}
  if(/export/.test(name)||/خروجی/.test(label)){const rows=Array.from(root.current?.querySelectorAll('[data-name="th"], [data-row]')||[]).map(el=>Array.from(el.children).map(c=>'"'+(c.textContent||'').trim().replaceAll('"','""')+'"').join(','));const blob=new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`henna-${section}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('فایل CSV سازگار با اکسل از داده‌های نمونه دریافت شد.');return;}
  if(/select-indicator|option-|toggle|availability/.test(name)){toggle(id);return;}
  if(/crop/.test(name)){setDialog({title:'تنظیم برش تصویر',kind:'crop',row});setDraft('');return;}
  if(/cancel-del/.test(name)){setNotice('حذف تصویر لغو شد.');return;}
  if(/delete|action-del|confirm-del/.test(name)||label==='حذف'){setDialog({title:'حذف مورد انتخاب‌شده',kind:'delete',row});return;}
  if(/بارگذاری|انتخاب فایل|افزودن تصویر/.test(label)||/upload|select-file/.test(name)){file.current?.click();return;}
  if(/کتابخانه|استفاده از تصاویر/.test(label)){if(section==='images'){setNotice('تصاویر انتخاب‌شده در همین نمایش آماده استفاده‌اند.');return;}router.push('/seller/panel/images');return;}
  if(/ویرایش قیمت/.test(label)){setDialog({title:label,kind:'price',row});setDraft('');return;}
  if(section==='support'&&/ثبت|پاسخ|جزئیات/.test(label)){setDialog({title:label,kind:'ticket',row});setDraft('');return;}
  if(section==='business'&&/ویرایش/.test(label)){setDialog({title:'درخواست ویرایش اطلاعات',kind:'business',row});setDraft('');return;}
  if(/افزودن کالا|ثبت اولین کالا/.test(label)||(section==='products'&&/ویرایش/.test(label))){router.push('/seller/panel/listing');return;}
  if(/سفارش|تاریخچه/.test(label)&&section==='states'){router.push('/seller/orders');return;}
  if(/موجودی/.test(label)&&section==='states'){router.push('/seller/panel/inventory');return;}
  if(/قیمت/.test(label)&&section==='states'){router.push('/seller/panel/pricing');return;}
  if(/ذخیره|تأیید|موجود کردن|ناموجود/.test(label)){toggle(id);setNotice('تغییرات در این نمایش ثبت شد؛ دادهٔ عملیاتی به سرور ارسال نشده است.');return;}
  if(/تلاش مجدد|پاک کردن فیلتر/.test(label)){setQuery('');setNotice('نمایش تازه‌سازی شد.');return;}
  toggle(id);setNotice('انتخاب در همین نمایش اعمال شد.');
 }
 function confirm(){if(!dialog)return;if(dialog.kind==='delete'){if(dialog.row)setHidden(prev=>new Set([...prev,dialog.row]));setNotice('مورد انتخاب‌شده از این نمایش حذف شد.');}else if(dialog.kind==='price'){if(!/^\d+$/.test(draft)||Number(draft)<=0){setNotice('قیمت معتبر به تومان وارد کنید.');return;}setValue(dialog.row,new Intl.NumberFormat('fa-IR').format(Number(draft))+' تومان');setNotice('قیمت در این نمایش به‌روزرسانی شد.');}else{if(!draft.trim()&&dialog.kind!=='crop'){setNotice('لطفاً اطلاعات درخواست را وارد کنید.');return;}setNotice('درخواست نمونه در همین نمایش ثبت شد و به پشتیبانی ارسال نشده است.');}setDialog(null);}
 return <Context.Provider value={{section,query,setQuery,values,setValue,hidden,pressed,act}}><div ref={root} className={styles.root}>
 {notice&&<div className={styles.notice} role="status">{notice}<button aria-label="بستن پیام" onClick={()=>setNotice('')}>×</button></div>}
 <input ref={file} type="file" accept="image/*" hidden onChange={e=>{const selected=e.target.files?.[0];if(!selected)return;if(!selected.type.startsWith('image/')||selected.size>10*1024*1024){setNotice('تصویر معتبر با حجم حداکثر ۱۰ مگابایت انتخاب کنید.');return;}setPreview(URL.createObjectURL(selected));setNotice('تصویر برای پیش‌نمایش انتخاب شد؛ بارگذاری به سرور انجام نشده است.');}}/>
 {preview&&<figure className={styles.upload}><img src={preview} alt="تصویر انتخاب‌شده"/><figcaption>تصویر انتخاب‌شده</figcaption></figure>}{children}
 {dialog&&<div className={styles.overlay}><form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="seller-dialog-title" onSubmit={e=>{e.preventDefault();confirm()}}><h2 id="seller-dialog-title">{dialog.title}</h2>{dialog.kind==='delete'?<p>این مورد از داده‌های همین نمایش حذف شود؟</p>:dialog.kind==='crop'?<p>برای برش و ویرایش، یک تصویر جدید انتخاب کنید.</p>:<label>{dialog.kind==='price'?'قیمت جدید (تومان)':'شرح درخواست'}{dialog.kind==='price'?<input autoFocus type="number" min="1" required value={draft} onChange={e=>setDraft(e.target.value)}/>:<textarea autoFocus required value={draft} onChange={e=>setDraft(e.target.value)}/>}</label>}<div><button type="submit">تأیید</button><button type="button" onClick={()=>setDialog(null)}>انصراف</button></div></form></div>}
 </div></Context.Provider>;
}
export function ScreenButton({controlId,actionName,label,children,...props}:{controlId:string;actionName:string;label:string;children?:ReactNode}&HTMLAttributes<HTMLButtonElement>){const c=useScreen();const toggle=/toggle|option|select-indicator|availability/.test(actionName);return <button {...props} type="button" aria-label={label} aria-pressed={toggle?c.pressed.has(controlId):undefined} data-selected={c.pressed.has(controlId)||undefined} onClick={e=>c.act(label,actionName,controlId,e.currentTarget.closest('[data-row]')?.getAttribute('data-row')||'')}>{children}</button>}
export function ScreenField({fieldId,label,kind,...props}:{fieldId:string;label:string;kind:string}&HTMLAttributes<HTMLDivElement>){const c=useScreen();const search=kind==='search';const text=label.replace(/\s+/g,' ').trim();const placeholder=/مانند|وارد کنید|جستجو|جست‌وجو|انتخاب|توضیحات کلی/.test(text);const initial=placeholder?'':text;const value=search?c.query:c.values[fieldId]??initial;const change=(v:string)=>search?c.setQuery(v):c.setValue(fieldId,v);return <div {...props} className={`${props.className||''} ${styles.field}`}>{kind==='select'?<select aria-label={text} value={value} onChange={e=>change(e.target.value)}>{[text,'همه موارد','کالا','لبنیات','نوشیدنی','خواربار','فعال','غیرفعال'].filter((v,i,a)=>a.indexOf(v)===i).map(v=><option key={v}>{v}</option>)}</select>:kind==='textarea'?<textarea aria-label={text} placeholder={text} value={value} onChange={e=>change(e.target.value)}/>:<input aria-label={text} placeholder={text} type={/کلمه عبور|••/.test(text)?'password':kind==='number'?'text':search?'search':'text'} inputMode={kind==='number'?'numeric':undefined} value={value} onChange={e=>change(e.target.value)}/>}</div>}
export function ScreenRow({rowId,rowText,children,...props}:{rowId:string;rowText:string;children:ReactNode}&HTMLAttributes<HTMLDivElement>){const c=useScreen();if(c.hidden.has(rowId)||(c.query&&!rowText.includes(c.query)))return null;return <div {...props} data-row={rowId}>{children}</div>}
export function ScreenValue({rowId,children,...props}:{rowId:string;children:ReactNode}&HTMLAttributes<HTMLParagraphElement>){const c=useScreen();return <p {...props}>{c.values[rowId]??children}</p>}
