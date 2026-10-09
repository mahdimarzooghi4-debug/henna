import Link from "next/link";
import { BuyerCommerceError } from "../lib/buyer-commerce";
export function BuyerCommerceStatus({ error, returnTo, retry }: { error: Error; returnTo: string; retry: () => void }) {
  return <div className="commerce-card commerce-status" role="alert">
    <h2>{error instanceof BuyerCommerceError && error.status === 401 ? "ورود به حساب" : "دریافت اطلاعات تأیید نشد"}</h2>
    <p>{error.message}</p>
    {error instanceof BuyerCommerceError && error.status === 401 ? <Link className="commerce-button" href={"/auth?returnTo=" + encodeURIComponent(returnTo)}>ورود و ادامه خرید</Link> : <button className="commerce-button" onClick={retry}>تلاش دوباره</button>}
  </div>;
}
