"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buyerCatalogPath, parseBuyerPage } from "../lib/buyer-catalog";
import { parseReferenceCart } from "../lib/buyer-cart";

function normalizeName(value: string) {
  return value.normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[\s\u200cـ]+/g, "").trim();
}

export function LandingAddButton({ productName, className, messageClassName }: {
  productName: string;
  className: string;
  messageClassName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function addToCart() {
    setBusy(true);
    setMessage("");
    try {
      const catalogResponse = await fetch(
        buyerCatalogPath(1, null, productName), {
          method: "GET", cache: "no-store", credentials: "omit", redirect: "error",
          headers: { Accept: "application/json", "Cache-Control": "no-store" },
        },
      );
      if (catalogResponse.status !== 200 ||
        !catalogResponse.headers.get("content-type")?.includes("application/json"))
        throw Error("catalog-unavailable");
      const page = parseBuyerPage(await catalogResponse.json() as unknown, 1);
      if (!page) throw Error("catalog-unavailable");
      const exact = page.items.filter(item => normalizeName(item.name) === normalizeName(productName));
      if (exact.length !== 1 || exact[0].kind !== "GOOD" ||
        !exact[0].unitName || exact[0].quantityScale == null) {
        setMessage("این کالای نمونه در کاتالوگ منتشرشده پیدا نشد؛ از فهرست کالاها انتخابش کن.");
        return;
      }

      const cartResponse = await fetch("/api/buyer/cart", {
        method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error",
        headers: { Accept: "application/json", "Cache-Control": "no-store" },
      });
      if (cartResponse.status === 401) {
        router.push("/auth");
        return;
      }
      if (cartResponse.status !== 200) throw Error("cart-unavailable");
      const cart = parseReferenceCart(await cartResponse.json() as unknown);
      if (!cart) throw Error("cart-unavailable");
      const current = cart.items.find(item => item.productId === exact[0].id);
      const quantity = (current?.quantity ?? 0) + 1;
      const precision = 10 ** exact[0].quantityScale!;
      if (Math.abs(quantity * precision - Math.round(quantity * precision)) > 1e-7)
        throw Error("invalid-quantity");

      const saveResponse = await fetch(
        "/api/buyer/cart/items/" + encodeURIComponent(exact[0].id), {
          method: "PUT", cache: "no-store", credentials: "same-origin", redirect: "error",
          headers: {
            Accept: "application/json", "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
          body: JSON.stringify({ revision: cart.revision, quantity }),
        },
      );
      if (saveResponse.status === 401) {
        router.push("/auth");
        return;
      }
      if (saveResponse.status === 409) throw Error("cart-changed");
      if (saveResponse.status !== 200 ||
        !parseReferenceCart(await saveResponse.json() as unknown))
        throw Error("cart-unavailable");
      router.push("/buyer/cart");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(code === "cart-changed"
        ? "سبد خرید هم‌زمان تغییر کرد؛ دوباره دکمهٔ افزودن را بزن."
        : "اتصال کاتالوگ یا سبد خرید حنا در دسترس نیست؛ کمی بعد دوباره تلاش کن.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className={className} disabled={busy} onClick={() => void addToCart()}>
      {busy ? "در حال افزودن…" : "افزودن +"}
    </button>
    {message && <span role="status" className={messageClassName}>{message}</span>}
  </>;
}
