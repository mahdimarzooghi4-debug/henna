"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addLandingPreviewProduct,
  LANDING_PREVIEW_CART_EVENT,
} from "../lib/landing-preview-products";

// Owner-approved journey: add one sample item, then open the existing preview cart.
// No intervening product-detail page and no real order/payment.
export function LandingAddButton({ productId, className, messageClassName }: {
  productId: string;
  className?: string;
  messageClassName: string;
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
      navigating.current = true;
      setPending(true);
      window.dispatchEvent(new Event(LANDING_PREVIEW_CART_EVENT));
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
