import Link from "next/link";
import { LandingFooter, LandingHeader } from "./landing-chrome";
import styles from "./public-guide.module.css";

export type GuideLink = { label: string; href: string };
export type GuideAnswer = { question: string; answer: string; link?: GuideLink };
export type GuideSection = {
  id: string;
  title: string;
  description?: string;
  paragraphs?: string[];
  bullets?: string[];
  answers?: GuideAnswer[];
  links?: GuideLink[];
  note?: string;
};

export function PublicGuide({
  eyebrow, title, description, sections, actions = [], notice,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: GuideSection[];
  actions?: GuideLink[];
  notice?: string;
}) {
  return (
    <div className={styles.page} dir="rtl">
      <LandingHeader />
      <main className={styles.main} data-testid="public-guide">
        <nav className={styles.breadcrumb} aria-label="موقعیت در سایت">
          <Link href="/">خانه</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span>
        </nav>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
            {actions.length>0 && <div className={styles.actions}>
              {actions.map(link => <Link href={link.href} key={link.href}>{link.label}<span aria-hidden="true">←</span></Link>)}
            </div>}
          </div>
          <div className={styles.heroDecor} aria-hidden="true"><span /><span /><span /></div>
        </header>
        {notice && <div className={styles.notice} role="note">{notice}</div>}
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <nav aria-label="فهرست بخش‌های راهنما" className={styles.toc}>
              <strong>در این صفحه</strong>
              {sections.map((section,index)=><a href={`#${section.id}`} key={section.id}>
                <span>{new Intl.NumberFormat("fa-IR").format(index+1)}</span>{section.title}
              </a>)}
            </nav>
            <div className={styles.help}>
              <strong>به راهنمایی بیشتری نیاز دارید؟</strong>
              <p>برای پرسش‌های مربوط به حساب، سفارش و خدمات حنا از مسیر پشتیبانی استفاده کنید.</p>
              <Link href="/support">مرکز پشتیبانی <span aria-hidden="true">←</span></Link>
            </div>
          </aside>
          <div className={styles.content}>
            {sections.map((section,index)=><section id={section.id} className={styles.section} key={section.id}>
              <div className={styles.sectionHead}>
                <span className={styles.sectionNumber}>{new Intl.NumberFormat("fa-IR").format(index+1)}</span>
                <div><h2>{section.title}</h2>{section.description&&<p>{section.description}</p>}</div>
              </div>
              {section.paragraphs?.map(p=><p className={styles.paragraph} key={p}>{p}</p>)}
              {section.bullets&&<ul className={styles.bullets}>{section.bullets.map(p=><li key={p}>{p}</li>)}</ul>}
              {section.answers && <div className={styles.questions}>
                {section.answers.map((item)=><details key={item.question} className={styles.question}>
                  <summary><span>{item.question}</span><span className={styles.plus} aria-hidden="true">+</span></summary>
                  <div className={styles.answer}><p>{item.answer}</p>
                    {item.link&&<Link href={item.link.href}>{item.link.label} <span aria-hidden="true">←</span></Link>}
                  </div>
                </details>)}
              </div>}
              {section.note&&<div className={styles.sectionNote}>{section.note}</div>}
              {section.links&&<div className={styles.sectionLinks}>{section.links.map(link=><Link href={link.href} key={link.href}>{link.label}<span aria-hidden="true">←</span></Link>)}</div>}
            </section>)}
          </div>
        </div>
        <div className={styles.end}>
          <div><strong>هنوز سؤالی دارید؟</strong><p>از طریق راه‌های ارتباطی رسمی حنا با ما در تماس باشید.</p></div>
          <Link href="/support">رفتن به پشتیبانی <span aria-hidden="true">←</span></Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
