import Link from "next/link";
import type { ReactNode } from "react";
import { MarketplaceChrome } from "./marketplace-chrome";
import styles from "./information-page.module.css";

export type InfoLink = { label: string; href: string; tone?: "primary" | "secondary" };
export type InfoSection = {
  id?: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  links?: InfoLink[];
  note?: string;
};

export function InformationPage({
  eyebrow = "حنا • راهنمای بازارگاه",
  title,
  description,
  actions = [],
  sections,
  closing,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: InfoLink[];
  sections: InfoSection[];
  closing?: ReactNode;
}) {
  return (
    <div className={styles.page} dir="rtl">
      <MarketplaceChrome />
      <main className={styles.main}>
        <div className={styles.breadcrumb}><Link href="/">خانه</Link><span aria-hidden="true">/</span><span>{title}</span></div>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          {actions.length > 0 && <div className={styles.actions}>
            {actions.map((action) => <Link className={action.tone === "secondary" ? styles.secondary : styles.primary} href={action.href} key={`${action.href}-${action.label}`}>{action.label}<span aria-hidden="true">←</span></Link>)}
          </div>}
        </header>
        <div className={styles.sections}>
          {sections.map((section, index) => <section className={styles.section} id={section.id} key={section.id ?? section.title}>
            <span className={styles.number}>{new Intl.NumberFormat("fa-IR").format(index + 1)}</span>
            <div className={styles.sectionBody}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
              {section.note && <p className={styles.note}>{section.note}</p>}
              {section.links && <div className={styles.sectionLinks}>{section.links.map((link) => <Link href={link.href} key={`${link.href}-${link.label}`}>{link.label}<span aria-hidden="true">←</span></Link>)}</div>}
            </div>
          </section>)}
        </div>
        {closing && <aside className={styles.closing}>{closing}</aside>}
      </main>
      <MarketplaceChrome footerOnly />
    </div>
  );
}
