import Link from "next/link";

// The card action opens the detail page; only the confirmation on that page mutates the demo cart.
export function LandingAddButton({ productId, className }: {
  productId: string;
  className: string;
}) {
  return <Link className={className} href={"/products/" + productId}
    data-testid="preview-product-add">افزودن +</Link>;
}
