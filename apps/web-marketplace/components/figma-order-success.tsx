"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./figma-order-success.module.css";
type OrderSummary = { total: number; sellerName: string; address: string };
const orderKey = "henna:figma-preview-order:v1";
const format = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
export function FigmaOrderSuccess() {
 const [order,setOrder]=useState<OrderSummary>({total:0,sellerName:"فروشگاه نمونه ۱",address:"نشانی تحویل نمونه"});
 useEffect(()=>{try{const raw=window.sessionStorage.getItem(orderKey);if(raw){const parsed=JSON.parse(raw) as Partial<OrderSummary>;setOrder({total:typeof parsed.total==="number"?parsed.total:0,sellerName:typeof parsed.sellerName==="string"?parsed.sellerName:"فروشگاه نمونه ۱",address:typeof parsed.address==="string"?parsed.address:"نشانی تحویل نمونه"});}}catch{/* sample values */}},[]);
 return <main className={styles.page} dir="rtl"><section className={styles.card} aria-labelledby="success-title">
  <div className={styles.icon} aria-hidden="true"><span>✓</span></div>
  <div className={styles.titleBlock}><h1 id="success-title">سفارش شما ثبت شد</h1><p>کد پیگیری سفارش: نمونه</p></div>
  <div className={styles.divider}/>
  <dl className={styles.details}>
   <div><dt>فروشگاه منتخب صادرکننده:</dt><dd>{order.sellerName}</dd></div>
   <div><dt>مبلغ کل پرداخت‌شده:</dt><dd>{format(order.total)} تومان</dd></div>
   <div><dt>نشانی تحویل سفارش:</dt><dd>{order.address}</dd></div>
  </dl>
  <div className={styles.note}>سفارش شما ثبت شد و در حال حاضر برای پیگیری و مشاهده جزئیات در دسترس است.</div>
  <div className={styles.actions}><Link href="/products" className={styles.secondary}>بازگشت به صفحه اصلی</Link><Link href="/buyer/tracking?mode=preview" className={styles.primary}>مشاهده جزئیات سفارش</Link></div>
  <p className={styles.disclosure}>این مسیر نمونه‌ی نمایشی است؛ پرداخت واقعی انجام نشده است.</p>
 </section></main>;
}