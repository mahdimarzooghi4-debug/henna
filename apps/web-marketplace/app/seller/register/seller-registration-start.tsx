import Link from "next/link";
import Image from "next/image";
import styles from "./seller-registration-start.module.css";

export function SellerRegistrationStart() {
  return (
    <section className={styles.grid} data-testid="seller-register-start">
      <div className={styles.panel}>
        <Image
          className={styles.logo}
          src="/hana-logo.png"
          alt="حنا"
          width={147}
          height={82}
          unoptimized
        />
        <h1>ثبت‌نام فروشنده</h1>
        <p>
          برای فروش کالا در بازارگاه حنا، مراحل ثبت‌نام فروشگاه خود را تکمیل کنید.
        </p>
        <div className={styles.buttons}>
          <Link className={styles.primary} href="/seller/register/new">
            ثبت‌نام
          </Link>
          <Link className={styles.secondary} href="/seller/register/public-status">
            پیگیری ثبت‌نام
          </Link>
        </div>
      </div>
    </section>
  );
}
