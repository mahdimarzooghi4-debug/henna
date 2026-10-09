"use client";
import { useEffect, useState } from "react";
import {
  BuyerCommerceError, buyerGet, rial, type BuyerServiceListing,
} from "../lib/buyer-commerce";

export function BuyerServiceListings({ productId }: { productId: string }) {
  const [items,setItems]=useState<BuyerServiceListing[]|null>(null);
  const [error,setError]=useState<Error|null>(null);
  const [retry,setRetry]=useState(0);

  useEffect(()=>{
    const abort=new AbortController();
    setItems(null);setError(null);
    buyerGet<BuyerServiceListing[]>(
      "service-listings?productId="+productId,abort.signal)
      .then(setItems)
      .catch(e=>{
        if(!abort.signal.aborted)
          setError(e instanceof Error?e:new BuyerCommerceError(503));
      });
    return()=>abort.abort();
  },[productId,retry]);

  return <section className="commerce-card commerce-offers"
    aria-label="ارائه‌دهندگان این خدمت">
    <h2>ارائه‌دهندگان این خدمت</h2>
    {items===null&&!error&&<p role="status">در حال دریافت ارائه‌دهندگان…</p>}
    {items?.length===0&&
      <p>در حال حاضر ارائه‌دهنده‌ای برای این خدمت منتشر نشده است.</p>}
    {items?.map(item=><article className="commerce-item" key={item.id}>
      <h3>{item.storeName}</h3>
      <p>قیمت پایه: {rial(item.priceRial)}</p>
      <p>{item.availabilityNote}</p>
    </article>)}
    <p className="commerce-muted">
      این اطلاعات، دسترس‌پذیری اعلام‌شده است؛ رزرو زمان، پرداخت بانکی و
      هماهنگی لجستیک در این مسیر انجام نمی‌شود.
    </p>
    {error&&<div role="alert">
      <p>{error.message}</p>
      <button className="commerce-button"
        onClick={()=>setRetry(n=>n+1)}>
        دریافت دوباره ارائه‌دهندگان
      </button>
    </div>}
  </section>;
}
