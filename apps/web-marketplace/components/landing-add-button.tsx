"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addLandingPreviewProduct,
  LANDING_PREVIEW_CART_EVENT,
} from "../lib/landing-preview-products";

// Homepage adds in place; other approved catalog flows retain direct-cart navigation.
// No real order or payment is created.
export function LandingAddButton({ productId, className, messageClassName, stayOnPage = false }: {
  productId: string;
  className?: string;
  messageClassName: string;
  stayOnPage?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const navigating = useRef(false);

  function addToCart() {
    if (navigating.current) return;
    setMessage("");
    const result = addLandingPreviewProduct(productId);
    if (result === "added") {
      window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
      if (stayOnPage) return;
      navigating.current = true;
      setPending(true);
      router.push("/buyer/cart?mode=preview");
    } else if (result === "limit") {
      setMessage("حداکثر تعداد این کالا در سبد ۹۹ عدد است.");
    } else {
      setMessage("ذخیرهٔ سبد در این مرورگر ممکن نشد؛ تنظیمات ذخیره‌سازی را بررسی کن.");
    }
  }

  return <>
    <button type="button" className={className} onClick={addToCart}
      disabled={pending} data-testid="preview-product-add" data-product-id={productId}>
      افزودن +
    </button>
    {message && <span role="status" className={messageClassName}>{message}</span>}
  </>;
}
