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
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path[name]}</svg>;
}

export function OrganizationPortalShell({ active, title, children }: { active: PortalKey; title: string; children: ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState("");

  async function logout() {
    if (leaving) return;
    setLeaving(true);
    setLogoutNotice("");
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin", cache: "no-store" });
      if (response.ok || response.status === 401) {
        window.location.assign("/auth");
        return;
      }
      setLogoutNotice("خروج از حساب تأیید نشد؛ دوباره تلاش کنید.");
    } catch {
      setLogoutNotice("ارتباط برقرار نشد؛ دوباره برای خروج تلاش کنید.");
    }
    setLeaving(false);
  }

  return <main className={styles.shell} dir="rtl">
    <aside className={styles.sidebar}>
      <Link href="/organization" className={styles.brand} aria-label="داشبورد پرتال سازمانی"><img src="/hana-logo.png" alt="حنا"/></Link>
      <nav aria-label="منوی پرتال سازمانی">{navigation.map(item => <Link href={item.href} key={item.key} className={`${styles.navItem}${active === item.key ? ` ${styles.active}` : ""}`} aria-current={active === item.key ? "page" : undefined}><span className={styles.glyph}><Icon name={item.glyph}/></span><span>{item.label}</span></Link>)}</nav>
      <div className={styles.userFooter}><div><b>کد کاربری: ****۹۸۲</b><small>کاربر ارشد پرتال</small></div><span className={styles.avatar}>ن</span></div>
      {logoutNotice && <p className={styles.logoutNotice} role="status">{logoutNotice}</p>}
      <button type="button" className={styles.logoutButton} onClick={() => void logout()} disabled={leaving}>
        <Icon name="logout"/><span>{leaving ? "در حال خروج…" : "خروج از حساب"}</span>
      </button>
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
    dashboard: "داشبورد پرتال سازمانی", profile: "اطلاعات و پروفایل سازمان", "program-detail": "جزئیات طرح سازمانی", people: "افراد و مشمولان", "people-new": "ثبت و افزودن دستی مشمولان", api: "منابع داده و API", allocation: "مدیریت تخصیص اعتبار", "allocation-detail": "جزئیات تخصیص", usage: "وضعیت استفاده و عملکرد اعتبارات", reports: "گزارش‌ها و تحلیل طرح‌ها", notifications: "اعلان‌های پرتال سازمانی", support: "پشتیبانی و راهنمای پرتال", settings: "تنظیمات پورتال سازمانی",
  };
  const title = titles[screen];
  if (screen === "api") return <OrganizationApiDataSources title={title} />;
  if (screen === "allocation") return <OrganizationAllocationPreview title={title} />;
  if (screen === "allocation-detail") return <OrganizationAllocationDetailPreview title={title} />;
  if (screen === "usage") return <OrganizationUsagePreview title={title} />;
  if (screen === "reports") return <OrganizationReportsPreview title={title} />;
  if (screen === "notifications") return <OrganizationNotificationsPreview title={title} />;
  if (screen === "support") return <OrganizationSupportPreview title={title} />;
  if (screen === "settings") return <OrganizationSettingsPreview title={title} />;
  // The dashboard is a public, read-only Figma sample. Keep organization data
  // and every other portal screen behind the existing authenticated APIs.
  if (data.loading && screen !== "dashboard" && screen !== "profile" && screen !== "program-detail" && screen !== "people" && screen !== "people-new") return <OrganizationPortalShell active={active} title={title}><p role="status">در حال دریافت اطلاعات از سامانه حنا…</p></OrganizationPortalShell>;
  if (data.error && screen !== "dashboard" && screen !== "profile" && screen !== "program-detail" && screen !== "people" && screen !== "people-new") {
    const needsLogin = data.error.includes("وارد شوید") || data.error.includes("نشست معتبر نیست");
    const returnTo = ({
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
    {data.loading ? <p role="status">در حال دریافت اطلاعات سازمان…</p>
      : data.error ? <Notice tone="warning">{data.error}</Notice>
      : data.profiles.length === 0 ? <Notice>برای این حساب، پروفایل سازمانی در دسترس نیست.</Notice>
      : <div className={styles.profileGrid}>{data.profiles.map(profile => <Card key={profile.membershipId} title="شناسه و اطلاعات هویتی سازمان">
        <DataRows rows={[
          ["عنوان سازمان", profile.organizationName],
          ["شناسه عضویت سازمانی", profile.membershipId],
          ["نقش دسترسی", roleNames[profile.memberRole]],
          ["اطلاعات تماس سازمان", "در سرویس فعلی ثبت نشده است"],
        ]}/>
      </Card>)}</div>}
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

  return <OrganizationPortalShell active={active} title={title}><Notice>این بخش هنوز به سرویس سازمان متصل نشده است.</Notice></OrganizationPortalShell>;
}

function OrganizationApiDataSources({ title }: { title: string }) {
  const [message, setMessage] = useState("");
  return <OrganizationPortalShell active="api" title={title}>
    <section className={styles.apiInfoBanner}>
      <strong>اتصال به سامانه مرجع اطلاعات سازمان</strong>
      <p>اتصال منبع داده سازمان، همگام‌سازی رکوردها و تطبیق با حساب حنا مراحل مجزا هستند. ممکن است منبع متصل باشد اما برخی رکوردهای همگام‌سازی‌شده هنوز نیازمند بررسی باشند.</p>
      <small>وضعیت‌های این صفحه نمونه‌اند؛ سرویس اتصال هنوز راه‌اندازی نشده و هیچ داده‌ای همگام‌سازی نمی‌شود.</small>
    </section>
    <div className={styles.apiGrid}>
      <Card>
        <div className={styles.apiCardHeader}>
          <span className={`${styles.status} ${styles.status_gray}`}>نمونه</span>
          <h2>وضعیت اتصال درگاه سازمان</h2>
        </div>
        <div className={styles.apiDivider}/>
        <dl className={styles.apiDetails}>
          <div><dt>منبع داده سازمان</dt><dd>درگاه سازمان حمایتگر (نمونه)</dd></div>
          <div><dt>آخرین همگام‌سازی موفق</dt><dd>زمان نمونه</dd></div>
          <div><dt>وضعیت همگام‌سازی</dt><dd><span className={`${styles.status} ${styles.status_gray}`}>نمونه داده</span></dd></div>
        </dl>
        <div className={styles.apiDivider}/>
        <div className={styles.apiActions}>
          <button className={styles.outlineButton} type="button" onClick={() => setMessage("اتصال واقعی برقرار نشده؛ بررسی اتصال اجرا نشد.")}>بررسی تست اتصال</button>
          <button className={styles.primaryButton} type="button" onClick={() => setMessage("سرویس همگام‌سازی متصل نیست؛ هیچ داده‌ای ارسال یا دریافت نشد.")}>اجرای همگام‌سازی دستی</button>
        </div>
        {message && <p className={styles.apiMessage} role="status">{message}</p>}
      </Card>
      <Card title="خطاهای همگام‌سازی اخیر">
        <div className={styles.apiErrorList}>
          <article><time>زمان نمونه</time><strong>عدم تطابق ساختار شناسه در رکوردهای ارسالی</strong></article>
          <article><time>زمان نمونه</time><strong>خطای موقت همگام‌سازی با منبع داده سازمان</strong></article>
        </div>
      </Card>
    </div>
  </OrganizationPortalShell>;
}

function OrganizationAllocationDetailPreview({ title }: { title: string }) {
  return <OrganizationPortalShell active="allocation" title={title}>
    <div className={styles.backRow} style={{ direction: "ltr" }}>
      <Link className={styles.outlineButton} href="/organization/allocation">← بازگشت به مدیریت تخصیص‌ها</Link>
    </div>
    <div className={styles.detailTop} style={{ direction: "ltr" }}>
      <span className={styles.allocationDetailStatus}>وضعیت پردازش: تکمیل‌شده</span>
      <span dir="rtl">شناسه تخصیص: ALC-***۲۴</span>
    </div>
    <Notice>پردازش بر اساس قواعد و الگوی ثبت‌شده حنا انجام شده است. نتیجه نهایی تخصیص نیازمند بررسی جداگانه است.</Notice>
    <div className={`${styles.detailGrid} ${styles.allocationDetailGrid}`}>
      <Card title="اطلاعات پایه تخصیص">
        <DataRows rows={[
          ["طرح مرتبط", "طرح نمونه ۱"],
          ["روش تخصیص فعال", "الگوی تخصیص حنا"],
          ["تعداد رکوردهای ورودی", "داده نمونه"],
          ["وضعیت پردازش", "پردازش‌شده"],
        ]}/>
      </Card>
      <div className={styles.stack}>
        <Card title="نتیجه نهایی تخصیص">
          <DataRows rows={[
            ["نتیجه تخصیص", "در انتظار بررسی نهایی"],
            ["رکوردهای تخصیص‌یافته", "—"],
            ["وضعیت تخصیص", "داده نمونه"],
          ]}/>
        </Card>
        <Card title="موارد نیازمند بررسی">
          <div className={styles.allocationReviewRows}>
            <div><span>داده نمونه</span><strong>اطلاعات حساب حنا نیازمند تطبیق</strong></div>
            <div><span>داده نمونه</span><strong>اطلاعات منبع نیازمند بررسی یا همگام‌سازی مجدد است.</strong></div>
          </div>
        </Card>
      </div>
    </div>
  </OrganizationPortalShell>;
}

function OrganizationUsagePreview({ title }: { title: string }) {
  const stats = [
    { label: "کل اعتبارات تخصیص یافته", value: "مقدار نمونه", tone: "ink" },
    { label: "اعتبار فعال در حال استفاده", value: "مقدار نمونه", tone: "teal" },
    { label: "اعتبار مصرف شده", value: "مقدار نمونه", tone: "terracotta" },
    { label: "اعتبار راکد یا استفاده نشده", value: "مقدار نمونه", tone: "ink" },
  ] as const;
  const rows = [
    { name: "فرد نمونه ۱", id: "***۰۰۷۲۱۶", status: "استفاده شده", tone: "used", allocated: "مقدار نمونه", used: "مقدار نمونه", date: "تاریخ نمونه" },
    { name: "فرد نمونه ۲", id: "***۰۱۲۵۴۴", status: "بخشی استفاده شده", tone: "partial", allocated: "مقدار نمونه", used: "مقدار نمونه", date: "تاریخ نمونه" },
    { name: "فرد نمونه ۳", id: "***۰۴۳۹۸۱", status: "استفاده نشده", tone: "unused", allocated: "مقدار نمونه", used: "مقدار نمونه", date: "-" },
    { name: "فرد نمونه ۴", id: "***۰۰۹۶۱۲", status: "پایان‌یافته / غیرفعال", tone: "inactive", allocated: "مقدار نمونه", used: "مقدار نمونه", date: "تاریخ نمونه" },
  ] as const;

  return <OrganizationPortalShell active="usage" title={title}>
    <div className={styles.usagePage}>
      <section className={styles.usageStats} aria-label="خلاصه اعتبارات">
        {stats.map((stat) => <article className={styles.usageStatCard} key={stat.label}>
          <span>{stat.label}</span>
          <strong className={styles[`usageStat_${stat.tone}`]}>{stat.value}</strong>
        </article>)}
      </section>
      <section className={styles.usageTableCard}>
        <header className={styles.usageTableTitle}><h2>لیست وضعیت مصرف مشمولان</h2></header>
        <div className={styles.usageTableScroll}>
          <table className={styles.usageTable}>
            <colgroup><col className={styles.usageDateCol}/><col className={styles.usageAmountCol}/><col className={styles.usageAmountCol}/><col className={styles.usageStatusCol}/><col className={styles.usageIdCol}/><col/></colgroup>
            <thead><tr>
              <th scope="col">آخرین وضعیت ثبت‌شده</th>
              <th scope="col">میزان استفاده</th>
              <th scope="col">اعتبار تخصیص یافته</th>
              <th scope="col">وضعیت مصرف</th>
              <th scope="col">شناسه مشمول</th>
              <th scope="col">نام مشمول</th>
            </tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id}>
              <td>{row.date}</td>
              <td>{row.used}</td>
              <td>{row.allocated}</td>
              <td><span className={`${styles.usageStatus} ${styles[`usageStatus_${row.tone}`]}`}>{row.status}</span></td>
              <td dir="ltr">{row.id}</td>
              <th scope="row">{row.name}</th>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  </OrganizationPortalShell>;
}

function OrganizationReportsPreview({ title }: { title: string }) {
  const periods = [
    { label: "دوره نمونه ۱", height: 140 },
    { label: "دوره نمونه ۲", height: 110 },
    { label: "دوره مرداد", height: 160 },
    { label: "دوره تیر", height: 80 },
  ];

  return <OrganizationPortalShell active="reports" title={title}>
    <div className={styles.reportsPage}>
      <section className={styles.reportsGrid} aria-label="خلاصه گزارش‌های طرح">
        <Card title="وضعیت تطبیق افراد">
          <div className={styles.reportMetricRow}>
            <strong className={styles.reportMetricTeal}>وضعیت تطبیق: داده نمونه</strong>
            <span>کل مشمولان متصل</span>
          </div>
          <div className={styles.reportProgress} role="progressbar" aria-label="وضعیت تطبیق افراد" aria-valuemin={0} aria-valuemax={100} aria-valuenow={64}>
            <span className={styles.reportProgressTeal}/>
          </div>
        </Card>
        <Card title="وضعیت مصرف طرح‌ها">
          <div className={styles.reportMetricRow}>
            <strong className={styles.reportMetricTerracotta}>وضعیت استفاده: داده نمونه</strong>
            <span>بودجه استفاده‌شده</span>
          </div>
          <div className={styles.reportProgress} role="progressbar" aria-label="وضعیت مصرف طرح‌ها" aria-valuemin={0} aria-valuemax={100} aria-valuenow={48}>
            <span className={styles.reportProgressTerracotta}/>
          </div>
        </Card>
      </section>
      <Card title="روند کلی تخصیص و توزیع طرح">
        <div className={styles.reportBarChart} aria-label="نمودار نمونه روند تخصیص">
          {periods.map((period) => <div className={styles.reportBarItem} key={period.label}>
            <span className={styles.reportBar} style={{ height: `${period.height}px` }}/>
            <span className={styles.reportBarLabel}>{period.label}</span>
          </div>)}
        </div>
      </Card>
    </div>
  </OrganizationPortalShell>;
}

function OrganizationNotificationsPreview({ title }: { title: string }) {
  const notifications = [
    { heading: "همگام‌سازی منبع داده سازمان", body: "اطلاعات منبع داده سازمان همگام‌سازی شد.", tone: "teal" },
    { heading: "ثبت یک طرح نمونه", body: "یک طرح نمونه در پرتال ثبت شد.", tone: "teal" },
    { heading: "وضعیت یک طرح ثبت‌شده تغییر کرده است.", body: "جزئیات وضعیت در صفحه همان طرح قابل مشاهده است.", tone: "sand" },
  ] as const;

  return <OrganizationPortalShell active="notifications" title={title}>
    <section className={styles.portalNotifications} aria-label="فهرست اعلان‌های پرتال">
      {notifications.map((notification) => <article className={styles.portalNotificationItem} key={notification.heading}>
        <time>زمان نمونه</time>
        <div className={styles.portalNotificationMain}>
          <div className={styles.portalNotificationCopy}>
            <strong>{notification.heading}</strong>
            <p>{notification.body}</p>
          </div>
          <span className={`${styles.portalNotificationDot} ${styles[`portalNotificationDot_${notification.tone}`]}`} aria-hidden="true" />
        </div>
      </article>)}
    </section>
  </OrganizationPortalShell>;
}

function OrganizationSupportPreview({ title }: { title: string }) {
  const [query, setQuery] = useState("");
  const topics = [
    { heading: "منابع داده و API", body: "راهنمای اتصال API / منبع داده سازمان", href: "/organization/data-sources" },
    { heading: "تخصیص و مدل حنا", body: "راهنمای روش‌های تخصیص در پرتال سازمانی", href: "/organization/allocation" },
    { heading: "افراد و مشمولان", body: "نحوه مدیریت اطلاعات هویتی و افزودن مشمولان جدید به طرح‌ها", href: "/organization/people" },
    { heading: "طرح‌ها و اعتبارها", body: "راهنمای جامع ایجاد، ویرایش و مدیریت دوره‌های اعتباری سازمان", href: "/organization/programs" },
  ];
  const tickets = [
    { title: "درخواست پشتیبانی — بررسی تطبیق شناسه برخی مشمولان", status: "پاسخ داده شده", tone: "answered" },
    { title: "درخواست پشتیبانی — بررسی وضعیت اتصال API", status: "در حال بررسی", tone: "review" },
  ];
  const normalizedQuery = query.trim().toLocaleLowerCase("fa-IR");
  const visibleTopics = topics.filter((topic) => `${topic.heading} ${topic.body}`.toLocaleLowerCase("fa-IR").includes(normalizedQuery));
  const visibleTickets = tickets.filter((ticket) => `${ticket.title} ${ticket.status}`.toLocaleLowerCase("fa-IR").includes(normalizedQuery));

  return <OrganizationPortalShell active="support" title={title}>
    <div className={styles.supportPage}>
      <section className={styles.supportSearchCard} aria-labelledby="support-search-title">
        <h2 id="support-search-title">جستجو در راهنمای پرتال حنا</h2>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="عبارت مورد نظر خود را تایپ کنید (مثلاً: ثبت طرح، الگوی تخصیص)..."
          aria-label="جستجو در راهنمای پرتال حنا"
        />
      </section>

      <section className={styles.supportTopics} aria-label="دسته‌های راهنمای پرتال">
        {visibleTopics.map((topic) => <Link key={topic.heading} href={topic.href} className={styles.supportTopic}>
          <b>{topic.heading}</b>
          <small>{topic.body}</small>
        </Link>)}
        {visibleTopics.length === 0 && <p className={styles.supportEmpty}>دسته‌ای مطابق جست‌وجوی شما پیدا نشد.</p>}
      </section>

      <section className={styles.supportHistory} aria-labelledby="support-history-title">
        <h2 id="support-history-title">تاریخچه تیکت‌های پشتیبانی سازمان</h2>
        <div className={styles.supportDivider} />
        <div className={styles.supportTicketList}>
          {visibleTickets.map((ticket) => <article className={styles.supportTicket} key={ticket.title}>
            <span className={`${styles.supportTicketStatus} ${ticket.tone === "answered" ? styles.supportTicketAnswered : styles.supportTicketReview}`}>{ticket.status}</span>
            <p>{ticket.title}</p>
          </article>)}
          {visibleTickets.length === 0 && <p className={styles.supportEmpty}>تیکتی مطابق جست‌وجوی شما پیدا نشد.</p>}
        </div>
      </section>
    </div>
  </OrganizationPortalShell>;
}

function OrganizationSettingsPreview({ title }: { title: string }) {
  const [notificationSettings, setNotificationSettings] = useState([true, true, false]);
  const notificationOptions = [
    "ارسال پیامک تایید تخصیص اعتبار به مشمولان",
    "اعلام همگام‌سازی ناموفق مخزن داده در پرتال",
    "ارسال گزارش هفتگی به ایمیل نماینده سازمان",
  ];
  const users = [
    { id: "کد کاربری: ****۹۸۲", role: "نماینده رسمی سازمان", badge: "کاربر ارشد پرتال", lead: true },
    { id: "کد کاربری: ****۴۱۲", role: "بخش فناوری اطلاعات", badge: "اپراتور فنی طرح", lead: false },
  ];

  return <OrganizationPortalShell active="settings" title={title}>
    <div className={styles.organizationSettingsPage}>
      <section className={styles.organizationPrivacyBanner} aria-labelledby="organization-privacy-title">
        <h2 id="organization-privacy-title">حریم خصوصی و دسترسی اعتباری</h2>
        <p>توجه: این سازمان صرفاً مجاز به مشاهده و مدیریت داده‌های مربوط به طرح‌ها، برنامه‌های اعتباری و مشمولان تعریف‌شده در پورتال خود می‌باشد. دسترسی به تراکنش‌های شخصی خارج از چهارچوب طرح‌های سازمان امکان‌پذیر نیست.</p>
      </section>

      <div className={styles.organizationSettingsGrid}>
        <section className={styles.organizationSettingsCard} aria-labelledby="organization-users-title">
          <h2 id="organization-users-title">کاربران و دسترسی‌های مجاز سازمان</h2>
          <div className={styles.organizationSettingsDivider}/>
          <div className={styles.organizationUserList}>
            {users.map((user) => <article className={styles.organizationUser} key={user.id}>
              <span className={`${styles.organizationUserBadge}${user.lead ? ` ${styles.organizationUserBadgeLead}` : ""}`}>{user.badge}</span>
              <div className={styles.organizationUserIdentity}>
                <strong>{user.id}</strong>
                <small>{user.role}</small>
              </div>
            </article>)}
          </div>
        </section>

        <section className={styles.organizationSettingsCard} aria-labelledby="organization-notification-settings-title">
          <h2 id="organization-notification-settings-title">تنظیمات دریافت اعلان‌ها</h2>
          <div className={styles.organizationSettingsDivider}/>
          <div className={styles.organizationNotificationSettings}>
            {notificationOptions.map((option, index) => <label className={styles.organizationNotificationOption} key={option}>
              <input
                type="checkbox"
                role="switch"
                aria-label={option}
                checked={notificationSettings[index]}
                onChange={() => setNotificationSettings((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))}
              />
              <span>{option}</span>
            </label>)}
          </div>
        </section>
      </div>
    </div>
  </OrganizationPortalShell>;
}

function OrganizationAllocationPreview({ title }: { title: string }) {
  const [message, setMessage] = useState("");
  return <OrganizationPortalShell active="allocation" title={title}>
    <section className={styles.allocationContext}>
      <span className={styles.allocationContextBadge}>روش تخصیص سازمان معمولی: انتخاب توسط سازمان</span>
      <strong>نوع سازمان فعال: سازمان حمایتگر | روش تخصیص: الگوی حنا</strong>
    </section>
    <div className={styles.allocationPreviewBoard}>
      <div className={styles.allocationPreviewColumn}>
        <Card title="قوانین و الگوهای فعال تخصیص">
          <div className={styles.allocationRule}><strong>الگوی تخصیص حنا</strong><span>تخصیص اعتبار بر اساس قواعد ثبت‌شده و الگوی تخصیص حنا انجام می‌شود.</span></div>
          <div className={styles.allocationRule}><strong>دوره فعال هدف</strong><span>بازه نمونه</span></div>
        </Card>
        <section className={styles.allocationControl}>
          <h2>تخصیص بر اساس الگوی حنا</h2>
          <p>تخصیص اعتبار بر اساس قواعد ثبت‌شده و الگوی تخصیص حنا انجام می‌شود. جزئیات قواعد داخلی تخصیص در این پنل نمایش داده نمی‌شود.</p>
          <div className={styles.allocationControlDivider}/>
          <div className={styles.allocationControlActions}>
            <button className={styles.outlineButton} type="button" onClick={() => setMessage("پیش‌نمایش فقط داده‌های نمونه را نشان می‌دهد؛ محاسبه تخصیص انجام نشد.")}>مرور ورودی و وضعیت تخصیص</button>
            <button className={styles.primaryButton} type="button" onClick={() => setMessage("فرایند تخصیص اجرا نشد؛ اتصال سرویس و تأیید انسانی لازم است.")}>شروع فرایند تخصیص</button>
          </div>
          {message && <p className={styles.allocationMessage} role="status">{message}</p>}
        </section>
      </div>
      <div className={styles.allocationPreviewColumn}>
        <Card title="جمعیت ثبت‌شده و منبع افراد">
          <div className={styles.allocationPopulation}>
            <div><strong>جمعیت ثبت‌شده: داده نمونه</strong><span>اطلاعات دریافت‌شده از منبع داده سازمان</span></div>
            <div><strong>رکوردهای آماده: داده نمونه</strong><span>رکوردهای آماده برای بررسی تخصیص</span></div>
            <div><strong>نیازمند بررسی: داده نمونه</strong><span>نیازمند بررسی یا تطبیق اطلاعات</span></div>
          </div>
        </Card>
        <Card title="وضعیت آخرین فرآیندهای تخصیص">
          <div className={styles.allocationHistory}>
            <div><span className={`${styles.status} ${styles.status_sand}`}>توزیع شده</span><span>تاریخ نمونه — طرح نمونه ۱</span></div>
            <div><span className={`${styles.status} ${styles.status_sand}`}>در حال پردازش</span><span>تاریخ نمونه — طرح نمونه ۲</span></div>
          </div>
        </Card>
      </div>
    </div>
  </OrganizationPortalShell>;
}
