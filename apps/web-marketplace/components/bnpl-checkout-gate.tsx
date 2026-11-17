import Link from "next/link";
import { bnplProviderDirectory } from "../lib/bnpl-provider-directory";
import styles from "./buyer-bnpl-payments.module.css";

/** Directory-only disclosure; does not create, authorize or complete a payment. */
export function BnplCheckoutGate() {
  return (
    <aside className={styles.checkoutGate} data-testid="bnpl-checkout-unavailable" aria-label="پرداخت اعتباری از شرکت‌های BNPL">
      <h3>پرداخت اعتباری با شرکت‌های BNPL</h3>
      <div className={styles.checkoutNames}>
        {bnplProviderDirectory.map(p => <span key={p.id}>{p.name}</span>)}
      </div>
      <p>این شرکت‌ها هنوز به درگاه پرداخت حنا متصل نیستند؛ انتخاب آن‌ها برای پرداخت صورت‌حساب فعال نیست. می‌توانید در صفحه روش‌های پرداخت به سایت رسمی شرکت مراجعه و شرایط دریافت اعتبار را بررسی کنید.</p>
      <Link href="/buyer/payments?mode=preview">معرفی شرکت‌ها و دریافت اعتبار <span aria-hidden="true">←</span></Link>
    </aside>
  );
}
