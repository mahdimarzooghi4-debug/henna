"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { LANDING_PREVIEW_PRODUCTS,type LandingPreviewCartItem } from "../lib/landing-preview-products";
import styles from "./figma-order-tracking.module.css";
type OrderSummary={total:number;sellerName:string;address:string;legal?:boolean;items:LandingPreviewCartItem[]};
const orderKey="henna:figma-preview-order:v1";
const format=(value:number)=>new Intl.NumberFormat("fa-IR").format(value);
export function FigmaOrderTracking(){
 const [order,setOrder]=useState<OrderSummary>({total:0,sellerName:"فروشگاه نمونه ۱",address:"نشانی نمونه",items:[]});
 useEffect(()=>{try{const raw=window.sessionStorage.getItem(orderKey);if(raw){const parsed=JSON.parse(raw) as Partial<OrderSummary>;setOrder({total:typeof parsed.total==="number"?parsed.total:0,sellerName:typeof parsed.sellerName==="string"?parsed.sellerName:"فروشگاه نمونه ۱",address:typeof parsed.address==="string"?parsed.address:"نشانی نمونه",legal:Boolean(parsed.legal),items:Array.isArray(parsed.items)?parsed.items:[]});}}catch{/* Figma sample values */}},[]);
 const stages=["ثبت سفارش","تأیید فروشگاه","آماده‌سازی","ارسال","تحویل"];
 return <main className={styles.page} dir="rtl"><div className={styles.layout}>
  <aside className={styles.sidebar}>
   <section className={styles.card}><h2>مشخصات فروشگاه</h2><div className={styles.divider}/><strong>{order.sellerName}</strong><p className={styles.muted}>فاصله تا مقصد: ۱.۲ کیلومتر</p><a className={styles.contact} href="tel:02100000000">تماس با فروشگاه</a></section>
   <section className={styles.card}><h2>اقلام این سفارش</h2><div className={styles.divider}/>
    {order.items.map(item=>{const product=LANDING_PREVIEW_PRODUCTS.find(p=>p.id===item.productId);return product?<div className={styles.item} key={item.productId}><span>{product.title} × {format(item.quantity)}</span><b>{product.price} تومان</b></div>:null;})}
    <div className={styles.total}><span>مبلغ کل</span><strong>{format(order.total)} تومان</strong></div>
   </section>
  </aside>
  <section className={styles.core}>
   <div className={styles.heading}><div><h1>وضعیت سفارش</h1><p>کد پیگیری سفارش: نمونه</p></div><span className={styles.legal}>{order.legal?"خرید حقوقی":"فاکتور رسمی: به نام شرکت ثبت‌شده"}</span></div>
   <section className={styles.timeline} aria-label="مراحل سفارش">
    {stages.map((stage,index)=><div className={styles.stage} key={stage}>
     <span className={[styles.node,index<3?styles.done:""].filter(Boolean).join(" ")}>{index<3?"✓":""}</span><strong className={index===2?styles.active:""}>{stage}</strong>
     {index<stages.length-1&&<span className={[styles.connector,index<2?styles.connectorDone:""].filter(Boolean).join(" ")}/>}
    </div>)}
   </section>
   <section className={styles.card}><h2>اطلاعات تحویل گیرنده</h2><div className={styles.divider}/><dl className={styles.recipient}>
    <div><dt>تحویل‌گیرنده:</dt><dd>گیرنده نمونه (۰۹۱۰۰۰۰۰۰۰۰)</dd></div><div><dt>نشانی تحویل:</dt><dd>{order.address}</dd></div>
   </dl></section>
   <Link href="/buyer/success?mode=preview" className={styles.back}>بازگشت به سفارش‌ها</Link>
  </section>
 </div></main>;
}