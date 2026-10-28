"use client";

import { useState } from "react";
import {
  addLandingPreviewProduct,
  LANDING_PREVIEW_CART_EVENT,
} from "../lib/landing-preview-products";

export function LandingAddButton({ productId, className, messageClassName }: {
  productId: string;
  className: string;
  messageClassName: string;
}) {
  const [message, setMessage] = useState("");

  function addToCart() {
    const result = addLandingPreviewProduct(productId);
    if (result === "added") {
      window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
      setMessage("به سبد خرید اضافه شد.");
    } else if (result === "limit") {
      setMessage("حداکثر تعداد این کالا در سبد ۹۹ عدد است.");
    } else {
      setMessage("ذخیرهٔ سبد در این مرورگر ممکن نشد؛ تنظیمات ذخیره‌سازی را بررسی کن.");
    }
  }

  return <>
    <button type="button" className={className} onClick={addToCart}>
      افزودن +
    </button>
    {message && <span role="status" className={messageClassName}>{message}</span>}
  </>;
}
