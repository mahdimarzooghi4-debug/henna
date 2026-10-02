"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./organization-portal.module.css";

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
    </aside>
    <div className={styles.main}><header className={styles.topbar}><h1>{title}</h1><Link href="/organization/profile" className={styles.profileLink}>پروفایل سازمان</Link></header><div className={styles.content}>{children}</div></div>
  </main>;
}

function Card({ title, children }: { title?: string; children: ReactNode }) { return <section className={styles.card}>{title && <h2 className={styles.cardTitle}>{title}</h2>}{children}</section>; }
function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) { return <div className={`${styles.banner} ${tone === "warning" ? styles.warning : ""}`}><p>{children}</p></div>; }
function DataRows({ rows }: { rows: [string, string][] }) { return <dl className={styles.dataRows}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>; }
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
    dashboard: "داشبورد پرتال سازمانی", profile: "اطلاعات سازمان", "program-detail": "جزئیات طرح سازمانی", people: "ارجاع خانوارها", "people-new": "ثبت ارجاع خانوارها", api: "منابع داده و API", allocation: "وضعیت تخصیص", "allocation-detail": "جزئیات تخصیص", usage: "وضعیت استفاده", reports: "گزارش‌ها", notifications: "اعلان‌ها", support: "پشتیبانی", settings: "تنظیمات سازمان",
  };
  const title = titles[screen];
  if (data.loading) return <OrganizationPortalShell active={active} title={title}><p role="status">در حال دریافت اطلاعات از سامانه حنا…</p></OrganizationPortalShell>;
  if (data.error) {
    const needsLogin = data.error.includes("وارد شوید") || data.error.includes("نشست معتبر نیست");
    const returnTo = screen === "program-detail" && programId
      ? `/organization/programs/${programId}`
      : screen === "allocation-detail" && allocationId
        ? `/organization/allocation/${allocationId}`
        : screen === "people-new"
          ? "/organization/people/new"
          : ({
              dashboard: "/organization", profile: "/organization/profile",
              people: "/organization/people", api: "/organization/data-sources",
              allocation: "/organization/allocation", usage: "/organization/usage",
              reports: "/organization/reports", notifications: "/organization/notifications",
              support: "/organization/support", settings: "/organization/settings",
              "program-detail": "/organization/programs",
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

  const selectedProgram = data.programs.find(program => program.programId === programId);
  if (screen === "dashboard") return <OrganizationPortalShell active="dashboard" title={title}>
    <Notice>این داشبورد فقط وضعیت ذخیره‌شدهٔ حساب و پیش‌نویس‌های سازمان را نشان می‌دهد. تخصیص مالی، موجودی و مصرف در سرویس فعلی پیاده‌سازی نشده‌اند.</Notice>
    {data.profiles.length === 0 ? <Card><p>برای این حساب عضویت فعال سازمانی ثبت نشده است.</p></Card> : data.profiles.map(profile => <Card key={profile.membershipId} title={profile.organizationName}><DataRows rows={[["نقش شما", roleNames[profile.memberRole]], ["پیش‌نویس‌های ثبت‌شده", String(data.programs.filter(x => x.organizationId === profile.organizationId).length)]]}/></Card>)}
    <Card title="طرح‌های ثبت‌شده">{data.programs.length ? <div className={styles.programList}>{data.programs.map(program => <ProgramLinks key={program.programId} program={program}/>)}</div> : <p>هنوز پیش‌نویسی ثبت نشده است. <Link href="/organization/programs/new">ایجاد پیش‌نویس</Link></p>}</Card>
  </OrganizationPortalShell>;

  if (screen === "profile") return <OrganizationPortalShell active="profile" title={title}>{data.profiles.length === 0 ? <Notice>برای این حساب پروفایل سازمانی فعال پیدا نشد.</Notice> : data.profiles.map(profile => <Card key={profile.membershipId} title={profile.organizationName}><DataRows rows={[["عنوان سازمان", profile.organizationName], ["نقش دسترسی", roleNames[profile.memberRole]], ["اطلاعات تماس و نماینده", "در سرویس فعلی ثبت نشده است"]]}/></Card>)}</OrganizationPortalShell>;

  if (screen === "program-detail") return <OrganizationPortalShell active="programs" title={title}>{!selectedProgram ? <Notice tone="warning">طرح پیدا نشد یا در فهرست قابل دسترس این سازمان نیست.</Notice> : <><Card title={selectedProgram.name}><DataRows rows={[["سازمان", selectedProgram.organizationName], ["وضعیت", "پیش‌نویس"], ["روش ثبت‌شده", modeNames[selectedProgram.allocationMode]], ["نسخه", String(selectedProgram.revision)], ["توضیحات", selectedProgram.description || "توضیحی ثبت نشده است"]]}/></Card><Notice>این پیش‌نویس اعتبار، موجودی یا تخصیص ایجاد نمی‌کند. ثبت مرجع تأمین نیز فقط برای بررسی ارسال می‌شود.</Notice><div className={styles.actionCards}><Card title="تأمین برنامه"><p>ثبت یا پیگیری مرجع دستور تأمین مالی. ثبت مرجع به‌تنهایی اثبات وصول وجه یا اختیار تأمین نیست.</p><Link className={styles.primaryButton} href={`/organization/programs/${selectedProgram.programId}/funding-instruction`}>پیگیری دستور تأمین</Link></Card><Card title="ارجاع خانوار"><p>اطلاعات کیفی خانوار را برای بررسی بعدی ثبت کنید. این کار تصمیم استحقاق یا تخصیص نیست.</p><Link className={styles.outlineButton} href={`/organization/programs/${selectedProgram.programId}/household-referrals`}>مشاهده و ثبت ارجاع‌ها</Link></Card></div></>}</OrganizationPortalShell>;

  if (screen === "people" || screen === "people-new") return <OrganizationPortalShell active="people" title={title}><Notice>این سامانه در حال حاضر ارجاع خانوار را به‌صورت وابسته به طرح ثبت می‌کند؛ فهرست افراد، حساب حنا یا نتیجهٔ استحقاق از آن استنباط نمی‌شود.</Notice>{data.programs.length === 0 ? <Card><p>برای ثبت ارجاع، ابتدا یک پیش‌نویس طرح ایجاد کنید.</p><Link className={styles.primaryButton} href="/organization/programs/new">ایجاد پیش‌نویس طرح</Link></Card> : <Card title="طرح‌های قابل ارجاع"><div className={styles.programList}>{data.programs.map(program => <ProgramLinks key={program.programId} program={program}/>)}</div></Card>}</OrganizationPortalShell>;

  if (screen === "allocation") return <OrganizationPortalShell active="allocation" title={title}><Notice>اجرای تخصیص هنوز سرویس ندارد. این فهرست فقط روش انتخاب‌شده و مسیرهای ثبت‌شده را نشان می‌دهد؛ هیچ مبلغ یا تعداد مشمولی محاسبه نشده است.</Notice>{data.programs.length ? <Card title="پیش‌نویس‌ها"><div className={styles.programList}>{data.programs.map(program => <ProgramLinks key={program.programId} program={program}/>)}</div></Card> : <Card><p>پیش‌نویسی برای نمایش وجود ندارد.</p></Card>}</OrganizationPortalShell>;

  if (screen === "allocation-detail") return <OrganizationPortalShell active="allocation" title={title}><Notice tone="warning">شناسه «{allocationId ?? ""}» به رکورد تخصیص متصل نیست؛ در سرویس فعلی رکورد یا API اجرای تخصیص وجود ندارد.</Notice><Link className={styles.outlineButton} href="/organization/allocation">بازگشت به وضعیت تخصیص</Link></OrganizationPortalShell>;

  const deferred: Partial<Record<typeof screen, string>> = {
    api: "اتصال منبع داده، همگام‌سازی و آزمون API هنوز به سرویس سازمان متصل نشده‌اند.",
    usage: "گزارش مصرف یا تراکنش در دسترس این پنل نیست.",
    reports: "گزارش تحلیلی تا اتصال سرویس تخصیص و مصرف تولید نمی‌شود.",
    notifications: "اعلان‌های سازمانی در API فعلی ذخیره نمی‌شوند.",
    support: "ثبت و پیگیری تیکت پشتیبانی هنوز به سرویس وصل نیست.",
    settings: "مدیریت کاربران و تنظیمات اعلان هنوز به API وصل نیست.",
  };
  return <OrganizationPortalShell active={active} title={title}><Notice>{deferred[screen] ?? "این بخش هنوز به سرویس متصل نشده است."}</Notice><Card><p>پس از آماده‌شدن سرویس مربوط، این صفحه با دادهٔ واقعی پر خواهد شد.</p></Card></OrganizationPortalShell>;
}
