import Link from "next/link";
import styles from "./page.module.css";

const accessible = [
  {
    number: "۰۱",
    title: "ثبت ارزیابی و شواهد",
    description: "ثبت پژوهشی و مشاهده شواهد مبنا؛ فرم موجود شش‌شاخصی است و داده منتسب به انسان را خودکار وارد آموزش نمی‌کند.",
    href: "/admin/allocation-assessments",
    action: "مشاهده ارزیابی‌ها",
    state: "مسیر فعلی، شش‌شاخصی",
  },
  {
    number: "۰۲",
    title: "Outcome و پوشش نیاز ضروری",
    description: "مشاهده نتیجه پس از تخصیص، مستقل از شدت نیاز پیش از تخصیص؛ مقدار نامعلوم با صفر برابر نیست.",
    href: "/admin/allocation-outcomes",
    action: "مشاهده Outcome",
    state: "ثبت مستند، بدون برچسب خودکار",
  },
  {
    number: "۰۳",
    title: "آموزش و سوابق آزمایشی",
    description: "گردش‌کار آزمایشی شش‌شاخصی و سوابق اجرا؛ قرارداد هفت‌شاخصی را در این فرم فعال فرض نکنید.",
    href: "/admin/allocation-training",
    action: "ورود به آموزش آزمایشی",
    state: "نسخه موجود، نه v1.1",
  },
  {
    number: "۰۴",
    title: "مقایسه و ارزیابی مدل‌ها",
    description: "Profile، XGBoost Shadow و EBM را با Fingerprint ارزیابی مشترک و نسب‌نامه داده بررسی کنید؛ هیچ برنده‌ای خودکار انتخاب نمی‌شود.",
    href: "/admin/allocation-model-comparison",
    action: "مقایسه Evidence مدل‌ها",
    state: "نمای فقط‌خواندنی",
  },
] as const;

const evidence = [
  {
    title: "سوابق آموزش",
    description: "مشاهده اجرای آموزش و نتیجه ثبت‌شده؛ نبود سابقه، اجرای درخواست نامطمئن را رد نمی‌کند.",
    href: "/admin/allocation-training-runs",
  },
  {
    title: "XGBoost Shadow",
    description: "خطای مدل، Baseline و Fingerprint ارزیابی مستقل؛ بدون انتخاب خودکار.",
    href: "/admin/allocation-shadow-benchmarks",
  },
  {
    title: "پیشنهادها و بازبینی انسانی",
    description: "بررسی و ثبت تصمیم انسانی بر پیشنهادها؛ تأیید پیشنهاد معادل فعال‌شدن Runtime نیست.",
    href: "/admin/allocation-proposals",
  },
  {
    title: "Retention داده پژوهشی",
    description: "کنترل حذف با پیش‌نمایش، دلیل و اثرانگشت تأییدشده؛ مستقل از داده عملیاتی.",
    href: "/admin/allocation-retention",
  },
] as const;

export default function AllocationAiWorkspacePage() {
  return (
    <main className={styles.page} id="main-content">
      <nav aria-label="مسیر راهبری" className={styles.breadcrumb}>
        <Link href="/admin/operations">عملیات ادمین</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">فضای کاری هوش حنا</span>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>کنسول داخلی · راهبری مدل و شواهد</p>
          <h1>فضای کاری هوش حنا</h1>
          <p className={styles.lede}>
            از شواهد خانوار تا ارزیابی مستقل و تصمیم انسانی. این صفحه
            راهبر مسیرهای موجود است؛ مدل تازه، امتیاز نیاز یا ضریب تخصیص را
            خودکار فعال نمی‌کند.
          </p>
          <Link href="/admin/allocation-model-comparison" className={styles.heroLink}>
            مشاهده Evidence مدل‌ها <span aria-hidden="true">←</span>
          </Link>
        </div>
        <div className={styles.heroState} aria-label="تفکیک وضعیت نسخه‌ها">
          <p className={styles.stateTitle}>مرز نسخه‌ها</p>
          <div className={styles.stateLine}>
            <span className={styles.stateDot} aria-hidden="true" />
            <span>شش‌شاخصی</span><strong>مسیر آزمایشی موجود</strong>
          </div>
          <div className={styles.stateLine}>
            <span className={styles.stateDotMuted} aria-hidden="true" />
            <span>هفت‌شاخصی v1.1</span><strong>قرارداد و پیش‌بررسی پژوهشی</strong>
          </div>
          <p className={styles.stateHelp}>
            این‌ها وضعیت *قابلیت‌های نرم‌افزار* هستند، نه گزارش زنده مدل
            فعال Production. برای وضعیت یک مدل خاص باید سوابق معتبر آن بررسی شود.
          </p>
        </div>
      </header>

      <section className={styles.goals} aria-labelledby="goals-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>دو هدف جداگانه</p>
            <h2 id="goals-title">هوش حنا چه چیزی را بررسی می‌کند؟</h2>
          </div>
          <p>مقایسه این دو مفهوم، بدون یکی‌گرفتن آن‌ها</p>
        </div>
        <div className={styles.goalsGrid}>
          <article className={styles.goalCard}>
            <div className={styles.goalNumber}>۱</div>
            <h3>شدت نیاز، پیش از تخصیص</h3>
            <p>
              مقیاس پنج‌سطحی ۰، ۰٫۲۵، ۰٫۵، ۰٫۷۵ و ۱ فقط با
              شواهد و قضاوت بازبین مجاز معنا دارد.
            </p>
            <p className={styles.goalFoot}>شواهد ناکافی یا متعارض ← امتناع، نه صفر</p>
          </article>
          <article className={styles.goalCard}>
            <div className={styles.goalNumber}>۲</div>
            <h3>پوشش نیاز ضروری، پس از تخصیص</h3>
            <p>
              نتیجه مشاهده‌شده یا بازبینی‌شده مستقل ثبت می‌شود؛
              استفاده از اعتبار به‌تنهایی شدت نیاز را اثبات نمی‌کند.
            </p>
            <Link href="/admin/allocation-outcomes" className={styles.textLink}>
              مشاهده وضعیت Outcome <span aria-hidden="true">←</span>
            </Link>
          </article>
        </div>
      </section>

      <section aria-labelledby="journey-title" className={styles.workflow}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>مسیرهای متصل به سامانه</p>
            <h2 id="journey-title">از شواهد تا ارزیابی</h2>
          </div>
          <p>فقط لینک‌هایی که مقصد واقعی در Web دارند</p>
        </div>
        <ol className={styles.stepGrid}>
          {accessible.map(step => (
            <li key={step.number} className={styles.step}>
              <div className={styles.stepTop}>
                <span className={styles.stepNumber} aria-hidden="true">{step.number}</span>
                <span className={styles.stepState}>{step.state}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <Link href={step.href} className={styles.cardLink}>
                {step.action} <span aria-hidden="true">←</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.newContract} aria-labelledby="seven-title">
        <div className={styles.newContractHead}>
          <span className={styles.contractTag}>پژوهشی · فاقد رابط عملیاتی کامل</span>
          <h2 id="seven-title">قرارداد هفت‌شاخصی v1.1</h2>
          <p>
            سلامت، فشار اقتصادی بدون هزینه مسکن، سن، اندازه خانوار، مراقبت،
            تحصیلات و وضعیت مالک/مستأجر، با شواهد و نسب‌نامه نسخه‌دار.
          </p>
        </div>
        <div className={styles.contractGrid}>
          <div><strong>بازبینی انسانی</strong><span>ثبت هفت شاخص و قضاوت کیفی نیاز در Backend</span></div>
          <div><strong>سلامت داده</strong><span>پیش‌بررسی سه بخش و کنترل تعارض خانوار</span></div>
          <div><strong>ورود به آموزش</strong><span>فاقد مجوز پذیرش خودکار Dataset جدید</span></div>
        </div>
        <p className={styles.contractWarning}>
          این قابلیت‌ها هنوز صفحه عملیاتی برای ثبت یا حل تعارض در Web ندارند؛
          دکمه ساختگی برای آن‌ها نمایش داده نمی‌شود. قرارداد هفت‌شاخصی جایگزین
          فرم شش‌شاخصی موجود یا تأیید مستقل Production نشده است.
        </p>
      </section>

      <section aria-labelledby="evidence-title" className={styles.library}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>دسترسی‌های تکمیلی</p>
            <h2 id="evidence-title">دفتر شواهد و تصمیم‌ها</h2>
          </div>
        </div>
        <div className={styles.libraryGrid}>
          {evidence.map(item => (
            <article className={styles.libraryCard} key={item.href}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <Link href={item.href} className={styles.textLink}>
                بازکردن صفحه <span aria-hidden="true">←</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <aside className={styles.guardrail} aria-label="محدودیت تصمیم خودکار">
        <div className={styles.guardrailIcon} aria-hidden="true">!</div>
        <div>
          <h2>هوش مصنوعی پیشنهاد می‌دهد؛ تصمیم نهایی خودکار نیست.</h2>
          <p>
            سنجش خطا و مقایسه XGBoost یا EBM به‌معنای برنده‌شدن، تأیید
            Dataset، پایلوت یا فعال‌سازی نیست. تخصیص واقعی، ضرایب و
            وضعیت گذشته خانوارها در این صفحه تغییر نمی‌کنند.
          </p>
        </div>
      </aside>
    </main>
  );
}
