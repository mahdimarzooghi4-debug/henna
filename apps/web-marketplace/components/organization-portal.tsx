"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./organization-portal.module.css";
import { OrganizationPeopleDirectory } from "./organization-people-directory";
import { OrganizationPeopleIntake } from "./organization-people-intake";

type PortalKey = "dashboard" | "programs" | "people" | "allocation" | "usage" | "api" | "reports" | "notifications" | "profile" | "support" | "settings";
type AllocationMode = "HENNA_NEEDS_BASED" | "ORGANIZATION_DEFINED";
type Role = "ORG_LEAD" | "ORG_REPRESENTATIVE" | "ORG_TECHNICAL_OPERATOR";
type Profile = { organizationId: string; organizationName: string; memberRole: Role; membershipId: string };
type Program = { programId: string; organizationId: string; organizationName: string; name: string; allocationMode: AllocationMode; description: string; state: "DRAFT"; revision: number; createdAtUtc: string };
type PortalData = { profiles: Profile[]; programs: Program[]; loading: boolean; error?: string };

const navigation: { key: PortalKey; label: string; href: string; glyph: string }[] = [
  { key: "dashboard", label: "داشبورد", href: "/organization", glyph: "home" },
  { key: "programs", label: "طرح‌ها و اعتبارها", href: "/organization/programs", glyph: "package" },
  { key: "people", label: "افراد و مشمولان", href: "/organization/people", glyph: "users" },
  { key: "allocation", label: "تخصیص", href: "/organization/allocation", glyph: "allocation" },
  { key: "usage", label: "وضعیت استفاده", href: "/organization/usage", glyph: "chart" },
  { key: "api", label: "منابع داده و API", href: "/organization/data-sources", glyph: "database" },
  { key: "reports", label: "گزارش‌ها", href: "/organization/reports", glyph: "file" },
  { key: "notifications", label: "اعلان‌ها", href: "/organization/notifications", glyph: "bell" },
  { key: "profile", label: "اطلاعات سازمان", href: "/organization/profile", glyph: "info" },
  { key: "support", label: "پشتیبانی", href: "/organization/support", glyph: "help" },
  { key: "settings", label: "تنظیمات", href: "/organization/settings", glyph: "settings" },
];

function Icon({ name }: { name: string }) {
  const path: Record<string, ReactNode> = {
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"/></>,
    award: <><circle cx="12" cy="8" r="6"/><path d="m8.2 13-1 8 4.8-2.7 4.8 2.7-1-8"/></>,
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    package: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    allocation: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h5a5 5 0 0 1 5 5v5M16 18h-5a5 5 0 0 1-5-5V8"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/></>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
    help: <><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4L7.9 15a8 8 0 0 1 0-2l-.2-.1-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path[name]}</svg>;
}

export function OrganizationPortalShell({ active, title, children }: { active: PortalKey; title: string; children: ReactNode }) {
  return <main className={styles.shell} dir="rtl">
    <aside className={styles.sidebar}>
      <Link href="/organization" className={styles.brand} aria-label="داشبورد پرتال سازمانی"><img src="/hana-logo.png" alt="حنا"/><b>پنل سازمان‌ها</b></Link>
      <nav aria-label="منوی پرتال سازمانی">{navigation.map(item => <Link href={item.href} key={item.key} className={`${styles.navItem}${active === item.key ? ` ${styles.active}` : ""}`} aria-current={active === item.key ? "page" : undefined}><span className={styles.glyph}><Icon name={item.glyph}/></span><span>{item.label}</span></Link>)}</nav>
      <div className={styles.userFooter}><div><b>کد کاربری: ****۹۸۲</b><small>کاربر ارشد پرتال</small></div><span className={styles.avatar}>ن</span></div>
    </aside>
    <div className={styles.main}><header className={styles.topbar}>
      <h1>{title}</h1>
      <div className={styles.headerMeta}>
        <span className={styles.organizationChip}>سازمان حمایتگر</span>
        <span className={styles.syncTime}>آخرین همگام‌سازی ثبت‌شده <Icon name="refresh" /></span>
      </div>
    </header><div className={styles.content}>{children}</div></div>
  </main>;
}

function Card({ title, children }: { title?: string; children: ReactNode }) { return <section className={styles.card}>{title && <h2 className={styles.cardTitle}>{title}</h2>}{children}</section>; }
function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) { return <div className={`${styles.banner} ${tone === "warning" ? styles.warning : ""}`}><p>{children}</p></div>; }
function DataRows({ rows }: { rows: [string, ReactNode][] }) { return <dl className={styles.dataRows}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>; }
const roleNames: Record<Role, string> = { ORG_LEAD: "مدیر سازمان", ORG_REPRESENTATIVE: "نماینده سازمان", ORG_TECHNICAL_OPERATOR: "اپراتور فنی" };
const modeNames: Record<AllocationMode, string> = { HENNA_NEEDS_BASED: "نیازمحور حنا", ORGANIZATION_DEFINED: "تعریف‌شده توسط سازمان" };

function usePortalData(): PortalData {
  const [data, setData] = useState<PortalData>({ profiles: [], programs: [], loading: true });
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/organization/profiles", { cache: "no-store", signal: controller.signal }),
      fetch("/api/organization/programs", { cache: "no-store", signal: controller.signal }),
    ]).then(async ([profileResponse, programResponse]) => {
      const [profileBody, programBody]: unknown[] = await Promise.all([profileResponse.json().catch(() => null), programResponse.json().catch(() => null)]);
      if (!profileResponse.ok || !programResponse.ok || !isRecord(profileBody) || !Array.isArray(profileBody.profiles) || !isRecord(programBody) || !Array.isArray(programBody.programs)) {
        throw new Error(readMessage(profileBody) ?? readMessage(programBody) ?? "اطلاعات پرتال سازمان در دسترس نیست.");
      }
      if (!controller.signal.aborted) setData({ profiles: profileBody.profiles as Profile[], programs: programBody.programs as Program[], loading: false });
    }).catch(error => { if (!controller.signal.aborted) setData({ profiles: [], programs: [], loading: false, error: error instanceof Error ? error.message : "ارتباط با سرویس سازمان برقرار نشد." }); });
    return () => controller.abort();
  }, []);
  return data;
}
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function readMessage(value: unknown): string | undefined { return isRecord(value) && typeof value.message === "string" ? value.message : undefined; }
function ProgramLinks({ program }: { program: Program }) {
  return <div className={styles.programLinks}><Link href={`/organization/programs/${program.programId}`}>{program.name}</Link><small>{modeNames[program.allocationMode]} · پیش‌نویس</small><div><Link href={`/organization/programs/${program.programId}/funding-instruction`}>دستور تأمین</Link><Link href={`/organization/programs/${program.programId}/household-referrals`}>ارجاع خانوار</Link></div></div>;
}

export function OrganizationPortalScreen({ screen, allocationId, programId }: { screen: Exclude<PortalKey, "programs"> | "program-detail" | "allocation-detail" | "people-new"; allocationId?: string; programId?: string }) {
  const data = usePortalData();
  const active: PortalKey = screen === "program-detail" ? "programs" : screen === "people-new" ? "people" : screen === "allocation-detail" ? "allocation" : screen;
  const titles: Record<typeof screen, string> = {
    dashboard: "داشبورد پرتال سازمانی", profile: "اطلاعات و پروفایل سازمان", "program-detail": "جزئیات طرح سازمانی", people: "افراد و مشمولان", "people-new": "ثبت و افزودن دستی مشمولان", api: "منابع داده و API", allocation: "وضعیت تخصیص", "allocation-detail": "جزئیات تخصیص", usage: "وضعیت استفاده", reports: "گزارش‌ها", notifications: "اعلان‌ها", support: "پشتیبانی", settings: "تنظیمات سازمان",
  };
  const title = titles[screen];
  // The dashboard is a public, read-only Figma sample. Keep organization data
  // and every other portal screen behind the existing authenticated APIs.
  if (data.loading && screen !== "dashboard" && screen !== "profile" && screen !== "program-detail" && screen !== "people" && screen !== "people-new") return <OrganizationPortalShell active={active} title={title}><p role="status">در حال دریافت اطلاعات از سامانه حنا…</p></OrganizationPortalShell>;
  if (data.error && screen !== "dashboard" && screen !== "profile" && screen !== "program-detail" && screen !== "people" && screen !== "people-new") {
    const needsLogin = data.error.includes("وارد شوید") || data.error.includes("نشست معتبر نیست");
    const returnTo = screen === "allocation-detail" && allocationId
      ? `/organization/allocation/${allocationId}`
      : ({
          dashboard: "/organization", profile: "/organization/profile",
          people: "/organization/people", api: "/organization/data-sources",
          allocation: "/organization/allocation", usage: "/organization/usage",
          reports: "/organization/reports", notifications: "/organization/notifications",
          support: "/organization/support", settings: "/organization/settings",
          "allocation-detail": "/organization/allocation",
        } as const)[screen];
    return <OrganizationPortalShell active={active} title={title}>
      {needsLogin ? <>
        <Notice tone="warning">برای نمایش اطلاعات این بخش باید وارد حساب حنا شوید.</Notice>
        <Card title="ورود به پنل سازمانی">
          <p>اطلاعات این صفحه پس از تأیید نشست، از سرویس سازمان دریافت می‌شود. دادهٔ نمایشی جایگزین اطلاعات واقعی نیست.</p>
          <Link className={styles.primaryButton} href={`/auth?returnTo=${encodeURIComponent(returnTo)}`}>ورود / ثبت‌نام با شماره موبایل</Link>
        </Card>
      </> : <>
        <Notice tone="warning">{data.error}</Notice>
        <Card title="اطلاعات فعلاً در دسترس نیست"><p>سرویس سازمان پاسخ کامل نداده است؛ صفحه دادهٔ ساختگی نمایش نمی‌دهد.</p><Link className={styles.outlineButton} href="/">بازگشت به فروشگاه</Link></Card>
      </>}
    </OrganizationPortalShell>;
  }

  if (screen === "dashboard") return <OrganizationPortalShell active="dashboard" title={title}>
    <section className={styles.orgBanner}>
      <strong><Icon name="award" />{data.profiles[0]?.organizationName ?? "سازمان حمایتگر"} | روش تخصیص: الگوی حنا</strong>
      <p>تخصیص اعتبار بر اساس قواعد ثبت‌شده و الگوی تخصیص حنا انجام می‌شود.</p>
    </section>
    <div className={styles.dashboardGrid}>
      <div className={styles.stack}>
        <Card title="وضعیت همگام‌سازی افراد">
          <div className={styles.rowBetween}><span>دریافت افراد از منبع داده سازمان</span><span className={styles.status}>فعال و متصل</span></div>
          <div className={styles.statSplit}><div><small>تعداد مشمولان فعال</small><b>تعداد افراد: داده نمونه</b></div><i/><div><small>آخرین به‌روزرسانی منبع</small><b>زمان نمونه</b></div></div>
        </Card>
        <Card title="فعالیت‌های اخیر پرتال">
          <ul className={styles.activityList}>
            <li><span>تعریف طرح اعتباری جدید برای بررسی مشمولان</span><span className={styles.dot}/><small>زمان نمونه</small></li>
            <li><span>وضعیت یک طرح ثبت‌شده تغییر کرده است.</span><span className={styles.dot}/><small>زمان نمونه</small></li>
            <li><span>همگام‌سازی دوره‌ای لیست افراد از سامانه مرجع سازمان</span><span className={styles.dot}/><small>زمان نمونه</small></li>
          </ul>
        </Card>
      </div>
      <div className={styles.stack}>
        <Card title="وضعیت آخرین تخصیص">
          <div className={styles.rowBetween}><span>وضعیت توزیع</span><span className={styles.status}>فعال</span></div>
          <DataRows rows={[["روش تخصیص فعال", "الگوی تخصیص حنا"], ["دوره هدف تخصیص", "بازه نمونه"]]}/>
        </Card>
        <Card title="طرح‌های فعال و ثبت‌شده">
          <div className={styles.programMiniList}>
            <div><span><b>طرح نمونه ۱</b><small>تخصیص عمومی</small></span><span className={styles.status}>فعال</span></div>
            <div><span><b>برنامه ارتقای سلامت پرسنل</b><small>تخصیص هدفمند</small></span><span className={styles.status}>ثبت‌نشده</span></div>
            <div><span><b>اعتبار نمونه</b><small>الگوی حنا</small></span><span className={styles.status}>پیش‌نویس</span></div>
          </div>
        </Card>
      </div>
    </div>
  </OrganizationPortalShell>;

  if (screen === "profile") return <OrganizationPortalShell active="profile" title={title}>
    <div className={styles.profileGrid}>
      <Card title="شناسه و اطلاعات هویتی سازمان">
        <DataRows rows={[
          ["عنوان سازمان", "سازمان حمایتگر نمونه"],
          ["نوع سازمان", "سازمان حمایتگر"],
          ["روش تخصیص پیش‌فرض", "الگوی تخصیص حنا"],
          ["وضعیت حساب کاربری", <span className={styles.profileStatus}>تأیید شده و فعال</span>],
        ]}/>
      </Card>
      <div className={styles.stack}>
        <Card title="اطلاعات تماس ثبت‌شده"><DataRows rows={[["تلفن ثابت سازمان", "۰۲۱-۸۸******"], ["پست الکترونیکی رسمی", "info@org-domain.ir"], ["نشانی فیزیکی ثبت‌شده", "تهران، بلوار نلسون ماندلا، کوچه ***"]]}/></Card>
        <Card title="اطلاعات نماینده سازمان"><DataRows rows={[["نام و نام خانوادگی نماینده", "جناب آقای محمدی"], ["شماره شناسایی کاربری", "کاربر ارشد پرتال"], ["شماره تماس نماینده", "۰۹۱۲******۴"]]}/></Card>
      </div>
    </div>
  </OrganizationPortalShell>;

  if (screen === "program-detail") {
    const sampleDetails = {
      "sample-plan-1": { name: "طرح نمونه ۱", status: "فعال", publicId: "PRG-***91", organizationName: "سازمان حمایتگر", allocation: "الگوی تخصیص حنا" },
      "sample-plan-2": { name: "طرح نمونه ۲", status: "ثبت‌شده", publicId: "PRG-***92", organizationName: "سازمان حمایتگر", allocation: "الگوی تخصیص حنا" },
      "sample-plan-3": { name: "برنامه حمایتی نمونه", status: "پیش‌نویس", publicId: "PRG-***93", organizationName: "سازمان حمایتگر", allocation: "الگوی تخصیص حنا" },
      "sample-plan-4": { name: "طرح نمونه ۱", status: "متوقف", publicId: "PRG-***94", organizationName: "سازمان حمایتگر", allocation: "الگوی تخصیص حنا" },
      "sample-plan-5": { name: "طرح نمونه ۲", status: "پایان‌یافته", publicId: "PRG-***95", organizationName: "سازمان حمایتگر", allocation: "الگوی تخصیص حنا" },
    };
    const demoProgram = sampleDetails[programId as keyof typeof sampleDetails] ?? sampleDetails["sample-plan-1"];
    return <OrganizationPortalShell active="programs" title={title}>
      <section className={styles.programDetailPage}>
        <div className={styles.programDetailBackRow}>
          <div className={styles.programDetailIdentity}>
            <span className={styles.programDetailStatus}>{demoProgram.status}</span>
            <span>شناسه طرح: {demoProgram.publicId}</span>
          </div>
          <Link className={`${styles.outlineButton} ${styles.programDetailBackLink}`} href="/organization/programs"><span aria-hidden="true">←</span><span>بازگشت به طرح‌ها</span></Link>
        </div>
        <div className={styles.programDetailGrid}>
          <Card title="اطلاعات پایه طرح">
            <DataRows rows={[
              ["نام کامل طرح سازمانی", demoProgram.name],
              ["سازمان ثبت‌کننده", demoProgram.organizationName],
              ["روش تخصیص پیش‌فرض", demoProgram.allocation],
              ["وضعیت کنونی طرح", <span className={styles.programDetailStatus}>{demoProgram.status}</span>],
            ]}/>
            <div className={styles.programDescription}>
              <b>توضیحات طرح حمایتی</b>
              <p>تخصیص اعتبار بر اساس قواعد ثبت‌شده و الگوی تخصیص حنا انجام می‌شود. جزئیات قواعد داخلی تخصیص در این پنل نمایش داده نمی‌شود.</p>
            </div>
          </Card>
          <div className={styles.stack}>
            <Card title="دامنه افراد و مشمولان">
              <DataRows rows={[
                ["منبع دریافت اطلاعات", "API / منبع داده سازمان"],
                ["جامعه هدف تعریف شده", "افراد ثبت‌شده در منبع داده سازمان"],
                ["تعداد تخصیص‌گیرندگان نهایی", "جمعیت ثبت‌شده: داده نمونه"],
              ]}/>
            </Card>
            <Card title="وضعیت تخصیص و استفاده">
              <DataRows rows={[
                ["وضعیت کلی توزیع اعتبار", "وضعیت استفاده مرتبط با طرح ثبت‌شده"],
                ["آخرین به‌روزرسانی ثبت‌شده", "زمان نمونه"],
                ["وضعیت همگام‌سازی اطلاعات", "وضعیت: تکمیل‌شده"],
              ]}/>
            </Card>
          </div>
        </div>
      </section>
    </OrganizationPortalShell>;
  }

  if (screen === "people") return <OrganizationPortalShell active="people" title={title}><OrganizationPeopleDirectory/></OrganizationPortalShell>;

  if (screen === "people-new") return <OrganizationPortalShell active="people" title={title}><OrganizationPeopleIntake/></OrganizationPortalShell>;

  if (screen === "allocation") return <OrganizationPortalShell active="allocation" title={title}>
    <div className={styles.toolbar}><select aria-label="نوع سازمان"><option>نوع سازمان: همه</option><option>سازمان حمایتی</option></select><select aria-label="روش تخصیص"><option>روش تخصیص: همه</option><option>الگوی تخصیص حنا</option></select><span className={styles.toolbarCaption}>دوره تخصیص: تعیین نشده</span></div>
    <Notice>اجرای تخصیص تا آماده‌شدن سرویس مربوط غیرفعال است. این صفحه مبلغ، اعتبار یا تعداد مشمولان را تخمین نمی‌زند.</Notice>
    <div className={styles.allocationGrid}>
      <Card title="جمعیت و منبع داده"><DataRows rows={[["افراد ثبت‌شده", "داده‌ای دریافت نشده"], ["منبع سازمانی", "متصل نشده"], ["آخرین همگام‌سازی", "ثبت نشده"]]}/></Card>
      <Card title="قواعد تخصیص"><DataRows rows={[["روش تخصیص", "الگوی تخصیص حنا"], ["معیارهای بررسی", "در انتظار تنظیم"], ["وضعیت قواعد", "نیازمند پیکربندی"]]}/></Card>
      <Card title="گردش کار تخصیص"><div className={styles.workflow}><span>ثبت درخواست</span><i/><span>بررسی</span><i/><span>تأیید</span><i/><span>اجرا</span></div><p>درخواست تخصیصی ثبت نشده است.</p></Card>
      <Card title="تخصیص اعتبار"><p>برای شروع، منبع داده و قواعد باید در سرویس سازمان ثبت و تأیید شوند.</p><button className={styles.primaryButton} disabled type="button">ثبت درخواست تخصیص</button></Card>
    </div>
  </OrganizationPortalShell>;

  if (screen === "allocation-detail") return <OrganizationPortalShell active="allocation" title={title}>
    <div className={styles.backRow}><Link className={styles.outlineButton} href="/organization/allocation">← بازگشت به مدیریت تخصیص‌ها</Link></div>
    <div className={styles.detailTop}><span className={styles.status}>در انتظار داده</span><span>شناسه تخصیص: {allocationId ?? "—"}</span></div>
    <Notice>پردازش بر اساس قواعد و الگوی تخصیص ثبت‌شده انجام می‌شود. نتیجه نهایی تخصیص نیازمند بررسی جداگانه است.</Notice>
    <div className={`${styles.detailGrid} ${styles.allocationDetailGrid}`}><Card title="اطلاعات پایه تخصیص"><DataRows rows={[["طرح مرتبط", "در سرویس ثبت نشده"], ["روش تخصیص فعال", "الگوی تخصیص حنا"], ["تعداد رکوردهای ورودی", "داده‌ای ثبت نشده"], ["وضعیت پردازش", "در انتظار بررسی"]]}/></Card><div className={styles.stack}><Card title="نتیجه نهایی تخصیص"><DataRows rows={[["نتیجه تخصیص", "در انتظار بررسی نهایی"], ["کدهای تخصیص‌یافته", "داده‌ای ثبت نشده"], ["وضعیت تخصیص", "ثبت نشده"]]}/></Card><Card title="موارد نیازمند بررسی"><div className={styles.reviewItem}><b>اطلاعات حساب حنا تطبیق نشده است.</b><small>اطلاعات حساب از سرویس دریافت نشده است.</small></div></Card></div></div>
  </OrganizationPortalShell>;

  if (screen === "api") return <OrganizationPortalShell active="api" title={title}>
    <Notice>اتصال منبع داده و همگام‌سازی افراد هنوز برای این سازمان پیکربندی نشده است. جزئیات خطا و وضعیت اتصال پس از دریافت از سرویس نمایش داده می‌شود.</Notice>
    <div className={styles.twoCards}>
      <Card title="خطاهای همگام‌سازی اخیر"><div className={styles.emptyTable}><Icon name="database"/><b>خطایی ثبت نشده است</b><span>وضعیت همگام‌سازی از سرویس سازمان دریافت نشده.</span></div></Card>
      <Card title="وضعیت اتصال درگاه سازمان"><div className={styles.connectionState}><span className={styles.status}>پیکربندی نشده</span><DataRows rows={[["نشانی درگاه", "ثبت نشده"], ["آخرین بررسی اتصال", "ثبت نشده"]]}/></div><div className={styles.buttonRow}><button className={styles.primaryButton} disabled type="button">بررسی اتصال</button><button className={styles.outlineButton} disabled type="button">تنظیم منبع داده</button></div></Card>
    </div>
  </OrganizationPortalShell>;

  if (screen === "usage") return <OrganizationPortalShell active="usage" title={title}>
    <div className={styles.statCards}>{[["اعتبار راکد یا استفاده‌نشده","دریافت نشده"],["اعتبار مصرف‌شده","دریافت نشده"],["اعتبار فعال در حال استفاده","دریافت نشده"],["کل اعتبارات تخصیص‌یافته","دریافت نشده"]].map(([label,value])=><Card key={label}><small>{label}</small><b>{value}</b></Card>)}</div>
    <Card title="لیست وضعیت مصرف مشمولان"><div className={styles.tableWrap}><table><thead><tr><th>نام مشمول</th><th>شناسه مشمول</th><th>وضعیت مصرف</th><th>اعتبار تخصیص‌یافته</th><th>میزان استفاده</th><th>آخرین وضعیت ثبت‌شده</th></tr></thead><tbody><tr><td colSpan={6}><div className={styles.emptyTable}><b>داده‌ای برای نمایش وجود ندارد</b><span>اطلاعات مصرف هنوز از سرویس سازمان دریافت نشده است.</span></div></td></tr></tbody></table></div></Card>
  </OrganizationPortalShell>;

  if (screen === "reports") return <OrganizationPortalShell active="reports" title={title}>
    <div className={styles.twoCards}><Card title="وضعیت مصرف طرح‌ها"><DataRows rows={[["بودجه استفاده‌شده", "دریافت نشده"], ["وضعیت استفاده", "داده‌ای ثبت نشده"]]}/><div className={styles.progress}><span style={{width:"0%"}}/></div></Card><Card title="وضعیت تطبیق افراد"><DataRows rows={[["کل مشمولان متصل", "دریافت نشده"], ["وضعیت تطبیق", "داده‌ای ثبت نشده"]]}/><div className={styles.progress}><span className={styles.progressTeal} style={{width:"0%"}}/></div></Card></div>
    <Card title="روند کلی تخصیص و توزیع طرح"><div className={styles.chartEmpty}><Icon name="chart"/><b>گزارشی برای نمایش وجود ندارد</b><span>نمودار پس از ثبت و دریافت داده‌های تخصیص، اینجا نمایش داده می‌شود.</span></div></Card>
  </OrganizationPortalShell>;

  if (screen === "notifications") return <OrganizationPortalShell active="notifications" title={title}>
    <div className={styles.notificationList}>{[["همگام‌سازی منبع داده سازمان","اعلان‌های همگام‌سازی پس از اتصال منبع داده نمایش داده می‌شوند."],["ثبت یک طرح جدید","تغییرهای طرح و وضعیت بررسی آن در این فهرست قرار می‌گیرند."],["تغییر وضعیت طرح","اعلان‌های مربوط به وضعیت طرح پس از اتصال سرویس نمایش داده می‌شوند."]].map(([heading,body])=><article className={`${styles.notification} ${styles.notificationCard}`} key={heading}><div><b>{heading}</b><p>{body}</p></div><small>زمان ثبت نشده</small><span className={styles.dotSand}/></article>)}</div>
  </OrganizationPortalShell>;

  if (screen === "support") return <OrganizationPortalShell active="support" title={title}>
    <Card title="جست‌وجو در راهنمای پرتال"><input className={styles.searchInput} placeholder="عبارت مورد نظر خود را تایپ کنید (مثلاً ثبت طرح، الگوی تخصیص)…" aria-label="جست‌وجو در راهنما"/></Card>
    <div className={styles.supportCards}>{[["منابع داده و API","راهنمای اتصال API، منبع داده سازمان"],["تخصیص و مدل حنا","راهنمای طرح‌های تخصیص در پرتال سازمانی"],["افراد و مشمولان","نحوه مدیریت اطلاعات افراد و ارجاع خانوار"],["طرح‌ها و اعتبارها","راهنمای جامع ایجاد، ویرایش و مدیریت دوره‌های اعتباری سازمان"]].map(([heading,body])=><a key={heading} href="#support-topics"><b>{heading}</b><small>{body}</small></a>)}</div>
    <Card title="تاریخچه تیکت‌های پشتیبانی سازمان"><div className={styles.emptyTable}><Icon name="help"/><b>تیکتی برای نمایش وجود ندارد</b><span>سوابق واقعی پس از اتصال سرویس پشتیبانی در این بخش قرار می‌گیرند.</span></div></Card>
  </OrganizationPortalShell>;

  if (screen === "settings") return <OrganizationPortalShell active="settings" title={title}>
    <Notice>حریم خصوصی و دسترسی اعتباری: این سازمان فقط مجاز به مشاهده و مدیریت داده‌های مربوط به طرح‌های اعتبار و مشمولان تخصیص‌یافته به خود می‌باشد. دسترسی به تراکنش‌های شخصی خارج از چارچوب طرح‌های سازمانی امکان‌پذیر نیست.</Notice>
    <div className={styles.twoCards}>
      <Card title="کاربران و دسترسی‌های مجاز سازمان"><div className={styles.emptyInline}><b>فهرست دسترسی‌ها دریافت نشده است</b><span>پس از اتصال سرویس مدیریت کاربران، نقش‌های مجاز در این بخش نمایش داده می‌شوند.</span></div></Card>
      <Card title="تنظیمات دریافت اعلان‌ها"><div className={styles.emptyInline}><b>تنظیماتی برای نمایش وجود ندارد</b><span>امکان تغییر اعلان‌ها پس از فعال‌شدن سرویس فراهم می‌شود.</span></div></Card>
    </div>
  </OrganizationPortalShell>;

  return <OrganizationPortalShell active={active} title={title}><Notice>این بخش هنوز به سرویس سازمان متصل نشده است.</Notice></OrganizationPortalShell>;
}
