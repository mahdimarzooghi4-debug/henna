import Link from "next/link";
import styles from "./figma-buyer-account.module.css";
export const buyerAccountTabs = [
 ["account","اطلاعات حساب","/buyer/account?mode=preview"],
 ["addresses","آدرس‌های من","/account/addresses"],
 ["orders","سفارش‌های من","/buyer/orders?mode=preview"],
 ["payments","روش‌های پرداخت","/buyer/payments?mode=preview"],
 ["credits","اعتبارهای من","/benefits?section=credits"],
 ["social","مشارکت اجتماعی","/social"],
 ["support","پشتیبانی","/support"],
 ["settings","تنظیمات","/buyer/settings?mode=preview"],
] as const;
export type BuyerAccountTab = typeof buyerAccountTabs[number][0];
export function BuyerAccountNav({active}:{active:BuyerAccountTab}){
 return <aside className={styles.navCard} aria-label="بخش‌های حساب کاربری" data-testid="buyer-account-nav">
  {buyerAccountTabs.map(([key,label,href])=><Link key={key} href={href} aria-current={key===active?"page":undefined}><span>{label}</span><svg className={styles.navChevron} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></Link>)}
 </aside>;
}
