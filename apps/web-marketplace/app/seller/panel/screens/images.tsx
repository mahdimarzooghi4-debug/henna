"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import styles from "./images.module.css";
type Picture={id:string;name:string;src:string;used:boolean;local?:boolean};
const initial:Picture[]=[
{id:'bread',name:'نان بربری سنتی',src:'/seller-panel/screens/products/imgImg.png',used:true},
{id:'oil',name:'روغن آفتابگردان',src:'/seller-panel/screens/products/imgImg1.png',used:true},
{id:'pattern1',name:'تصویر بسته‌بندی شماره ۱',src:'/seller-panel/screens/images/imgThumbnailArea.png',used:false},
{id:'pattern2',name:'تصویر بسته‌بندی شماره ۲',src:'/seller-panel/screens/images/imgThumbnailArea1.png',used:false},
{id:'pattern3',name:'تصویر بسته‌بندی شماره ۳',src:'/seller-panel/screens/images/imgThumbnailArea2.png',used:false},
{id:'pattern4',name:'تصویر بسته‌بندی شماره ۴',src:'/seller-panel/screens/images/imgThumbnailArea3.png',used:false}];
export function DesignScreen(){
 const [pictures,setPictures]=useState(initial),[query,setQuery]=useState(''),[tab,setTab]=useState('all'),[selected,setSelected]=useState<Picture|null>(null),[remove,setRemove]=useState(false),[notice,setNotice]=useState('');
 const file=useRef<HTMLInputElement>(null),urls=useRef<string[]>([]);
 useEffect(()=>()=>urls.current.forEach(url=>URL.revokeObjectURL(url)),[]);
 const visible=pictures.filter(p=>(tab==='all'||(tab==='used'?p.used:!p.used))&&p.name.includes(query.trim()));
 function upload(event:ChangeEvent<HTMLInputElement>){
  const files=Array.from(event.target.files||[]);const added:Picture[]=[];let invalid=false;
  for(const f of files){if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10*1024*1024){invalid=true;continue;}const src=URL.createObjectURL(f);urls.current.push(src);added.push({id:src,name:f.name,src,used:false,local:true});}
  setPictures(prev=>[...added,...prev]);if(added.length){setTab('all');setQuery('');}setNotice(invalid?'بعضی فایل‌ها پذیرفته نشدند. فرمت JPG، PNG یا WebP و حجم حداکثر ۱۰ مگابایت باشد.':'تصاویر فقط برای پیش‌نمایش در همین صفحه اضافه شدند و روی سرور ذخیره نشده‌اند.');event.target.value='';
 }
 return <div className={styles.page} dir="rtl">
  <header className={styles.heading}><div><h1>کتابخانه تصاویر</h1><p>تصاویر کالاها را یکجا ببینید و مدیریت کنید.</p></div><button className={styles.primary} onClick={()=>file.current?.click()}><span aria-hidden>＋</span> افزودن تصویر</button></header>
  <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload}/>
  <p className={styles.demo}>تصاویر نمونه هستند؛ تغییرات این صفحه فقط در همین نمایش اعمال می‌شوند.</p>
  {notice&&<div className={styles.notice} role="status"><span>{notice}</span><button aria-label="بستن پیام" onClick={()=>setNotice('')}>×</button></div>}
  <section className={styles.library} aria-label="تصاویر کتابخانه">
   <div className={styles.toolbar}><div className={styles.tabs} role="tablist" aria-label="فیلتر تصاویر">{[['all','همه تصاویر',pictures.length],['used','استفاده‌شده',pictures.filter(p=>p.used).length],['unused','استفاده‌نشده',pictures.filter(p=>!p.used).length]].map(([value,label,count])=><button key={value} role="tab" aria-selected={tab===value} onClick={()=>setTab(String(value))}>{label}<span>{Number(count).toLocaleString('fa-IR')}</span></button>)}</div><input type="search" aria-label="جست‌وجوی تصویر" placeholder="جست‌وجو در نام تصاویر…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
   <div className={styles.info}><span>{visible.length.toLocaleString('fa-IR')} تصویر</span><span>برای مشاهده جزئیات، تصویر را انتخاب کنید.</span></div>
   {visible.length?<div className={styles.grid}>{visible.map(p=><button key={p.id} className={styles.imageCard} onClick={()=>{setSelected(p);setRemove(false)}} aria-label={'مشاهده '+p.name}><div className={styles.thumbnail}><img src={p.src} alt={p.name}/></div><div className={styles.cardBody}><strong>{p.name}</strong><span className={p.used?styles.used:styles.unused}>{p.used?'در حال استفاده':'استفاده‌نشده'}</span>{p.local&&<small>پیش‌نمایش محلی</small>}</div></button>)}</div>:<div className={styles.empty}><strong>تصویری پیدا نشد</strong><p>عبارت جست‌وجو یا فیلتر را تغییر دهید.</p><button onClick={()=>{setQuery('');setTab('all')}}>نمایش همه تصاویر</button></div>}
  </section>
  <div className={styles.guidance}><strong>راهنمای تصویر کالا</strong><span>تصویر واضح با پس‌زمینه ساده انتخاب کنید.</span><span>فرمت JPG، PNG یا WebP · حداکثر ۱۰ مگابایت</span></div>
  {selected&&<div className={styles.overlay} onClick={()=>setSelected(null)}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="image-detail-title" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setSelected(null)}}><div className={styles.dialogHeading}><h2 id="image-detail-title">جزئیات تصویر</h2><button autoFocus aria-label="بستن جزئیات" onClick={()=>setSelected(null)}>×</button></div><img className={styles.preview} src={selected.src} alt={selected.name}/><h3>{selected.name}</h3><p>{selected.used?'این تصویر به یک کالای نمونه متصل است.':'این تصویر در هیچ کالایی استفاده نشده است.'}</p>{remove?<div className={styles.confirm}><p>{selected.used?'این تصویر در حال استفاده است. حذف آن از فهرست این نمایش تأیید شود؟':'تصویر از فهرست این نمایش حذف شود؟'}</p><div className={styles.buttons}><button className={styles.danger} onClick={()=>{setPictures(prev=>prev.filter(p=>p.id!==selected.id));setSelected(null);setNotice('تصویر از فهرست همین نمایش حذف شد؛ داده‌ای روی سرور تغییر نکرد.')}}>تأیید حذف</button><button onClick={()=>setRemove(false)}>انصراف</button></div></div>:<div className={styles.buttons}><button onClick={()=>setSelected(null)}>بستن</button><button className={styles.danger} onClick={()=>setRemove(true)}>حذف از کتابخانه</button></div>}</section></div>}
 </div>;
}
