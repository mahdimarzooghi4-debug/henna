import styles from "./figma-buyer-services.module.css";

/** Public, aggregated report only. No fabricated social impact or personal donation claims. */
export function BuyerSocialReport() {
  const topics = [
    "خانواده‌های حمایت‌شده",
    "اعتبار تخصیص‌یافته",
    "مصرف اعتبار برای نیازهای اساسی",
    "برنامه‌های حمایتی اجراشده",
  ];
  return <>
    <section className={styles.socialHero}>
      <h2>ما با هم اثر می‌گذاریم</h2>
      <p>شما بخشی از جامعه حنا هستید؛ جامعه‌ای که امیدواریم با همراهی هم، فرصت‌های بیشتری برای حمایت از خانواده‌های کم‌برخوردار فراهم کند. این همراهی به معنای ثبت کمک مالی شخصی یا اثر قابل انتساب به خرید شما نیست.</p>
    </section>
    <section className={styles.socialReport} aria-labelledby="social-report-title" data-testid="buyer-social-report">
      <h2 id="social-report-title">گزارش عمومی عملکرد اجتماعی حنا</h2>
      <p>شاخص‌های زیر فقط از گزارش‌های تجمیعیِ تأییدشده منتشر خواهند شد. در حال حاضر داده قابل انتشار برای این شاخص‌ها در این صفحه متصل نشده است.</p>
      <div className={styles.socialReportGrid}>
        {topics.map(topic => <article key={topic} className={styles.socialMetric}>
          <strong>{topic}</strong>
          <span>در انتظار گزارش تأییدشده</span>
        </article>)}
      </div>
      <p>گزارش عمومی، بدون مشخصات هویتی خانوارها و بدون انتساب اثر مالی به کاربران منتشر می‌شود.</p>
    </section>
  </>;
}
