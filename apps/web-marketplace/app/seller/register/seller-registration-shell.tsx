import Link from "next/link";
import { LandingFooter } from "../../../components/landing-chrome";
import styles from "./seller-registration-shell.module.css";

export function SellerRegistrationShell({children}: {children:React.ReactNode}) {
  return (
    <div className={styles.layout} dir="rtl">
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link
            href="/"
            className={styles.backHome}
            aria-label="بازگشت به صفحه اصلی"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>بازگشت به صفحه اصلی</span>
          </Link>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <LandingFooter />
    </div>
  );
}
