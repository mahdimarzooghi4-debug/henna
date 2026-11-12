import { BuyerAccountNav } from "./buyer-account-nav";
import { bnplProviderDirectory } from "../lib/bnpl-provider-directory";
import account from "./figma-buyer-account.module.css";
import styles from "./buyer-bnpl-payments.module.css";
import { toPersianDigits } from "../lib/normalize-digits";

export function BuyerBnplPayments() {
  return (
    <main className={account.page} dir="rtl" data-testid="preview-payments">
      <div className={account.layout}>
        <BuyerAccountNav active="payments" />
        <section className={account.content} aria-label="روش‌های پرداخت">
          <header className={account.summary}>
            <h1>روش‌های پرداخت</h1>
            <p>آشنایی با شرکت‌های ارائه‌دهنده اعتبار خرید و مراجعه به سایت رسمی آن‌ها</p>
          </header>
          <section className={styles.intro} aria-labelledby="bnpl-intro-title">
            <div className={styles.eyebrow}>پرداخت اعتباری و اقساطی (BNPL)</div>
            <h2 id="bnpl-intro-title">اول اعتبارتان را بررسی کنید، بعد برای خرید تصمیم بگیرید</h2>
            <p>می‌توانید از طریق لینک‌های زیر وارد سایت شرکت‌های مستقل ارائه‌دهنده خدمات اعتباری شوید و شرایط را بررسی یا درخواست اعتبار ثبت کنید. تأیید اعتبار و شرایط بازپرداخت بر عهده همان شرکت است.</p>
          </section>
          <div className={styles.disclaimer} role="note" data-testid="bnpl-integration-notice">
            <strong>وضعیت استفاده در حنا</strong>
            <p>معرفی این شرکت‌ها به معنی همکاری رسمی یا امکان پرداخت از اعتبار آن‌ها در حنا نیست. درگاه اقساطی حنا هنوز به این شرکت‌ها متصل نشده است. دریافت اعتبار از آن‌ها فعلاً روش پرداخت قابل انتخاب در صورتحساب حنا ایجاد نمی‌کند.</p>
          </div>
          <section className={styles.providers} aria-label="شرکت‌های اعتباردهنده">
            <div className={styles.heading}>
              <h2>شرکت‌های ارائه‌دهنده اعتبار خرید</h2>
              <span>۳ وب‌سایت مستقل</span>
            </div>
            <div className={styles.cards} data-testid="bnpl-provider-cards">
              {bnplProviderDirectory.map((provider,index) => (
                <article key={provider.id} className={styles.card} data-testid="bnpl-provider-card">
                  <div className={styles.cardTop}>
                    <span className={styles.providerMark} aria-hidden="true">{provider.shortName}</span>
                    <span className={styles.cardCount}>{toPersianDigits(index+1)} / ۳</span>
                  </div>
                  <h3>{provider.name}</h3>
                  <p>{provider.description}</p>
                  <div className={styles.providerStatus}>هنوز روش پرداخت فعال در حنا نیست</div>
                  <a className={styles.providerLink} href={provider.website} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                    ورود به سایت {provider.name}
                    <span aria-hidden="true">↗</span>
                  </a>
                  <small>لینک خارجی؛ اطلاعات یا درخواست شما در سایت ارائه‌دهنده ثبت می‌شود.</small>
                </article>
              ))}
            </div>
          </section>
          <section className={styles.steps} aria-labelledby="bnpl-steps-title">
            <h2 id="bnpl-steps-title">مراحل دریافت و استفاده از اعتبار</h2>
            <ol>
              {[
                ["انتخاب ارائه‌دهنده","شرایط، هزینه‌ها، اقساط و مدارک لازم را در سایت رسمی شرکت بررسی کنید."],
                ["درخواست و ارزیابی","فرآیند اعتبارسنجی و تأیید یا رد درخواست توسط شرکت اعتباردهنده انجام می‌شود، نه حنا."],
                ["پرداخت صورتحساب حنا","تنها پس از قرارداد پذیرندگی و اتصال فنی تأییدشده، گزینه شرکت مربوطه در تسویه سفارش قابل انتخاب می‌شود. این قابلیت هنوز فعال نیست."],
              ].map(([title,description],index)=>(
                <li key={title}>
                  <span className={styles.stepNumber} data-testid="bnpl-step-number" aria-hidden="true">{toPersianDigits(index+1)}</span>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </li>
              ))}
            </ol>
          </section>
        </section>
      </div>
    </main>
  );
}
