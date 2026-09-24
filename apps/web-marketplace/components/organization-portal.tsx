import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { OrganizationProgramDraftForm } from "./organization-program-draft-form";
import { OrganizationProgramRegisterAction } from "./organization-program-register-action";
import { OrganizationRecipientCreateForm } from "./organization-recipient-create-form";
import { OrganizationRecipientBulkImportForm } from "./organization-recipient-bulk-import-form";
import type {
  OrganizationProfile,
  OrganizationProfileState,
} from "../lib/organization-profile";
import {
  defaultRecipientListQuery,
  organizationRecipientMatchLabels,
  organizationRecipientSourceLabels,
  recipientListQueryString,
  type OrganizationRecipientListQuery,
  type OrganizationRecipientMatchStatus,
  type OrganizationRecipientsState,
} from "../lib/organization-recipients";
import type {
  OrganizationAllocationProgramState,
  OrganizationAllocationReadinessState,
} from "../lib/organization-allocation";
import type {
  OrganizationUsageStatusState,
} from "../lib/organization-usage";
import type {
  OrganizationReportsOverviewState,
} from "../lib/organization-reports";
import {
  defaultProgramListQuery,
  organizationProgramStatusLabels,
  programListQueryString,
  type OrganizationProgramDetailState,
  type OrganizationProgramListQuery,
  type OrganizationProgramOptionsState,
  type OrganizationProgramsState,
  type OrganizationProgramStatus,
} from "../lib/organization-programs";

export type OrgScreenKey =
  | "dashboard"
  | "profile"
  | "programs"
  | "program-detail"
  | "create-program"
  | "people"
  | "add-people"
  | "data-sources"
  | "allocation"
  | "allocation-detail"
  | "usage"
  | "reports"
  | "notifications"
  | "support"
  | "settings";

export const organizationRouteMap: Record<string, OrgScreenKey> = {
  profile: "profile",
  programs: "programs",
  "programs/detail": "program-detail",
  "programs/new": "create-program",
  people: "people",
  "people/add": "add-people",
  "data-sources": "data-sources",
  allocation: "allocation",
  usage: "usage",
  reports: "reports",
  notifications: "notifications",
  support: "support",
  settings: "settings",
};

const nav = [
  ["dashboard", "داشبورد", "/organization", "⌂"],
  ["programs", "طرح‌ها و اعتبارها", "/organization/programs", "▣"],
  ["people", "افراد و مشمولان", "/organization/people", "♙"],
  ["allocation", "تخصیص", "/organization/allocation", "⇄"],
  ["usage", "وضعیت استفاده", "/organization/usage", "▥"],
  ["data-sources", "منابع داده و API", "/organization/data-sources", "◫"],
  ["reports", "گزارش‌ها", "/organization/reports", "▤"],
  ["notifications", "اعلان‌ها", "/organization/notifications", "◌"],
  ["profile", "اطلاعات سازمان", "/organization/profile", "ⓘ"],
  ["support", "پشتیبانی", "/organization/support", "?"],
  ["settings", "تنظیمات", "/organization/settings", "⚙"],
] as const;

const titles: Record<OrgScreenKey, string> = {
  dashboard: "داشبورد پرتال سازمانی",
  profile: "اطلاعات و پروفایل سازمان",
  programs: "مدیریت طرح‌ها و اعتبارها",
  "program-detail": "جزئیات طرح سازمانی",
  "create-program": "ثبت طرح سازمانی جدید",
  people: "افراد و مشمولان",
  "add-people": "ثبت و افزودن دستی مشمولان",
  "data-sources": "اتصال به سامانه مرجع اطلاعات سازمان",
  allocation: "مدیریت تخصیص اعتبار",
  "allocation-detail": "جزئیات تخصیص اعتبار",
  usage: "وضعیت استفاده و عملکرد اعتبارات",
  reports: "گزارش‌ها و تحلیل طرح‌ها",
  notifications: "اعلان‌های پرتال سازمانی",
  support: "پشتیبانی و راهنمای پرتال",
  settings: "تنظیمات پورتال سازمانی",
};

function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`org-card ${className}`}>
      {title ? <h2 className="org-card__title">{title}</h2> : null}
      {title ? <div className="org-divider" /> : null}
      {children}
    </section>
  );
}

function Badge({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "neutral" | "warn" }) {
  return <span className={`org-badge org-badge--${tone}`}>{children}</span>;
}

function Pair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="org-pair">
      <span className="org-pair__value">{value}</span>
      <span className="org-pair__label">{label}</span>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="org-table-wrap">
      <table className="org-table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Dashboard({ profile }: { profile: OrganizationProfile | null }) {
  return (
    <>
      <div className="org-banner">
        {profile ? (
          <>
            <strong>{profile.name} | {profile.organizationType}</strong>
            <span>روش تخصیص پیش‌فرض: {profile.defaultAllocationMethod}</span>
          </>
        ) : (
          <>
            <strong>اطلاعات هویتی سازمان هنوز تأیید نشده است</strong>
            <span>داده‌های عملیاتی این صفحه در این مرحله همان نمونه‌های Figma هستند.</span>
          </>
        )}
      </div>
      <div className="org-grid org-grid--2">
        <div className="org-stack">
          <Card title="وضعیت همگام‌سازی افراد">
            <Pair label="دریافت افراد از منبع داده سازمان" value={<Badge>فعال و متصل</Badge>} />
            <div className="org-mini-grid">
              <Pair label="تعداد مشمولان فعال" value="تعداد افراد: داده نمونه" />
              <Pair label="آخرین به‌روزرسانی منبع" value="زمان نمونه" />
            </div>
          </Card>
          <Card title="فعالیت‌های اخیر پرتال">
            <ul className="org-activity">
              <li><span>تعریف طرح اعتباری جدید برای بررسی مشمولان</span><small>زمان نمونه</small></li>
              <li><span>وضعیت یک طرح ثبت‌شده تغییر کرده است.</span><small>زمان نمونه</small></li>
              <li><span>همگام‌سازی دوره ای لیست افراد از سامانه مرجع سازمان</span><small>زمان نمونه</small></li>
            </ul>
          </Card>
        </div>
        <div className="org-stack">
          <Card title="وضعیت آخرین تخصیص">
            <Pair label="وضعیت توزیع" value={<Badge>فعال</Badge>} />
            <Pair label="روش تخصیص فعال" value="الگوی تخصیص حنا" />
            <Pair label="دوره هدف تخصیص" value="بازه نمونه" />
          </Card>
          <Card title="طرح‌های فعال و ثبت‌شده">
            <div className="org-list">
              <Pair label="طرح نمونه ۱ · تخصیص عمومی" value={<Badge>فعال</Badge>} />
              <Pair label="برنامه ارتقای سلامت پرسنل · تخصیص هدفمند" value={<Badge tone="neutral">ثبت‌شده</Badge>} />
              <Pair label="اعتبار نمونه · الگوی حنا" value={<Badge tone="warn">پیش‌نویس</Badge>} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Profile({ state }: { state: OrganizationProfileState }) {
  if (state.status !== "ready") {
    const content = state.status === "unauthenticated"
      ? {
          title: "برای مشاهده اطلاعات سازمان وارد شوید",
          body: "نشست معتبر سازمانی پیدا نشد.",
          action: <Link className="org-button org-button--primary" href="/auth">ورود به حنا</Link>,
        }
      : state.status === "forbidden"
        ? {
            title: "دسترسی سازمانی فعال نیست",
            body: "این حساب وارد شده است، اما عضویت فعال در یک سازمان برای آن ثبت نشده است.",
            action: null,
          }
        : {
            title: "اطلاعات سازمان موقتاً در دسترس نیست",
            body: "برای جلوگیری از نمایش داده قدیمی یا ساختگی، پروفایل نمونه جایگزین نمی‌شود.",
            action: null,
          };
    return (
      <Card className="org-access-state">
        <h2>{content.title}</h2>
        <p>{content.body}</p>
        {content.action}
      </Card>
    );
  }

  const profile = state.profile;
  return (
    <div className="org-grid org-grid--2">
      <div className="org-stack">
        <Card title="اطلاعات تماس ثبت‌شده">
          <Pair label="تلفن ثابت سازمان" value={profile.phone ?? "ثبت نشده"} />
          <Pair label="پست الکترونیکی رسمی" value={profile.email ?? "ثبت نشده"} />
          <Pair label="نشانی فیزیکی ثبت‌شده" value={profile.address ?? "ثبت نشده"} />
        </Card>
        <Card title="اطلاعات نماینده سازمان">
          <Pair label="نام و نام خانوادگی نماینده" value={profile.representativeName ?? "ثبت نشده"} />
          <Pair label="نقش کاربر فعلی" value={profile.memberRole} />
          <Pair label="شماره تماس نماینده" value={profile.representativePhone ?? "ثبت نشده"} />
        </Card>
      </div>
      <Card title="شناسه و اطلاعات هویتی سازمان">
        <Pair label="عنوان سازمان" value={profile.name} />
        <Pair label="نوع سازمان" value={profile.organizationType} />
        <Pair label="روش تخصیص پیش‌فرض" value={profile.defaultAllocationMethod} />
        <Pair label="شناسه سازمان" value={<bdi>{profile.organizationId}</bdi>} />
        <Pair
          label="وضعیت حساب سازمانی"
          value={profile.verified
            ? <Badge>تایید شده و فعال</Badge>
            : <Badge tone="warn">فعال، در انتظار تایید</Badge>}
        />
      </Card>
    </div>
  );
}

function programBadge(status: OrganizationProgramStatus) {
  const tone = status === "ACTIVE"
    ? "teal"
    : status === "DRAFT" || status === "PAUSED"
      ? "warn"
      : "neutral";
  return <Badge tone={tone}>{organizationProgramStatusLabels[status]}</Badge>;
}

function programDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function programSource(value: string) {
  return value === "API_OR_MANUAL" ? "API / ورود دستی" : value;
}

function programPageHref(
  page: number,
  query: OrganizationProgramListQuery,
) {
  const params = programListQueryString({ ...query, page });
  return "/organization/programs" + (params ? "?" + params : "");
}

function Programs({
  state,
  query,
}: {
  state: OrganizationProgramsState;
  query: OrganizationProgramListQuery;
}) {
  if (state.status !== "ready") {
    const message = state.status === "unauthenticated"
      ? "برای مشاهده طرح‌های سازمانی ابتدا وارد شوید."
      : state.status === "forbidden"
        ? "این حساب عضویت فعال برای مشاهده طرح‌های سازمانی ندارد."
        : state.status === "invalid"
          ? "فیلتر یا صفحه‌بندی واردشده معتبر نیست."
          : "فهرست طرح‌های سازمانی موقتاً در دسترس نیست.";
    return (
      <Card className="org-access-state">
        <h2>طرح‌های سازمانی نمایش داده نشد</h2>
        <p>{message}</p>
        {state.status === "unauthenticated"
          ? <Link className="org-button org-button--primary" href="/auth">ورود به حنا</Link>
          : state.status === "invalid"
            ? <Link className="org-button" href="/organization/programs">پاک‌کردن فیلترها</Link>
            : null}
      </Card>
    );
  }

  const rows: ReactNode[][] = state.data.items.map((item) => [
    <Link key={item.id} href={`/organization/programs/${item.id}`}>مشاهده جزئیات</Link>,
    programDate(item.createdAtUtc),
    programBadge(item.status),
    item.allocationMethod,
    item.kind,
    item.name,
  ]);
  const hasPrevious = state.data.page > 1;
  const hasNext = state.data.page * state.data.pageSize < state.data.total;

  return (
    <>
      <div className="org-toolbar">
        <Link className="org-button" href="/organization/programs/new">فرم ثبت طرح</Link>
        <form className="org-filter-form" action="/organization/programs" method="get">
          {query.pageSize !== 20
            ? <input type="hidden" name="pageSize" value={query.pageSize} />
            : null}
          <label>
            فیلتر وضعیت
            <select name="status" defaultValue={query.status ?? ""}>
              <option value="">همه وضعیت‌ها</option>
              <option value="ACTIVE">فعال</option>
              <option value="REGISTERED">ثبت‌شده</option>
              <option value="DRAFT">پیش‌نویس</option>
              <option value="PAUSED">متوقف</option>
              <option value="ENDED">پایان‌یافته</option>
            </select>
          </label>
          <button className="org-button" type="submit">اعمال</button>
        </form>
      </div>
      <Card title="لیست طرح‌های سازمانی">
        {rows.length > 0 ? (
          <Table
            headers={["عملیات", "تاریخ ثبت", "وضعیت", "روش تخصیص", "نوع طرح", "نام طرح"]}
            rows={rows}
          />
        ) : (
          <div className="org-empty-state">
            <strong>طرحی با این وضعیت ثبت نشده است.</strong>
            <span>این نتیجه از داده واقعی سازمان فعلی خوانده شده است.</span>
          </div>
        )}
        <div className="org-pagination">
          <span>
            صفحه {state.data.page} · {state.data.total} طرح
          </span>
          <div>
            {hasPrevious
              ? <Link className="org-button" href={programPageHref(state.data.page - 1, query)}>صفحه قبل</Link>
              : null}
            {hasNext
              ? <Link className="org-button" href={programPageHref(state.data.page + 1, query)}>صفحه بعد</Link>
              : null}
          </div>
        </div>
      </Card>
    </>
  );
}

function ProgramDetail({
  state,
  profile,
}: {
  state: OrganizationProgramDetailState;
  profile: OrganizationProfile | null;
}) {
  if (state.status !== "ready") {
    const message = state.status === "unauthenticated"
      ? "برای مشاهده جزئیات طرح ابتدا وارد شوید."
      : state.status === "forbidden"
        ? "این حساب دسترسی فعال به طرح‌های سازمانی ندارد."
        : state.status === "not_found"
          ? "این طرح وجود ندارد یا متعلق به سازمان فعلی نیست."
          : "جزئیات طرح موقتاً در دسترس نیست.";
    return (
      <Card className="org-access-state">
        <h2>جزئیات طرح نمایش داده نشد</h2>
        <p>{message}</p>
        <Link className="org-button" href="/organization/programs">بازگشت به طرح‌ها</Link>
      </Card>
    );
  }

  const program = state.program;
  return (
    <>
      <div className="org-toolbar">
        <Link className="org-button" href="/organization/programs">بازگشت به طرح‌ها</Link>
        <div>{programBadge(program.status)} <span className="org-code"><bdi>{program.id}</bdi></span></div>
      </div>
      <div className="org-grid org-grid--2">
        <Card title="دامنه و تعریف طرح">
          <Pair label="نوع اعتبار / برنامه" value={program.kind} />
          <Pair label="منبع افراد و مشمولان" value={programSource(program.beneficiarySource)} />
          <Pair label="تاریخ ثبت" value={programDate(program.createdAtUtc)} />
          <Pair label="آخرین به‌روزرسانی" value={programDate(program.updatedAtUtc)} />
          {program.registeredAtUtc
            ? <Pair label="زمان ثبت نهایی" value={programDate(program.registeredAtUtc)} />
            : null}
        </Card>
        <Card title="اطلاعات پایه طرح">
          <Pair label="نام کامل طرح سازمانی" value={program.name} />
          <Pair label="سازمان ثبت‌کننده" value={profile?.name ?? "سازمان فعلی"} />
          <Pair label="روش تخصیص" value={program.allocationMethod} />
          <Pair label="وضعیت کنونی طرح" value={programBadge(program.status)} />
          <Pair label="توضیحات" value={program.description ?? "ثبت نشده"} />
        </Card>
      </div>
      {profile?.memberRole === "PORTAL_ADMIN" &&
      program.status === "DRAFT" ? (
        <>
          <Card title="ویرایش پیش‌نویس" className="org-form-card">
            <p className="org-muted">
              فقط پیش‌نویس قابل ویرایش است. کنترل نسخه از بازنویسی تغییرات همزمان جلوگیری می‌کند.
            </p>
            <OrganizationProgramDraftForm
              mode="edit"
              program={program}
              defaultAllocationMethod={program.allocationMethod}
            />
          </Card>
          <Card title="ثبت نهایی طرح" className="org-form-card org-register-card">
            <p className="org-muted">
              ثبت نهایی فقط وضعیت را از پیش‌نویس به ثبت‌شده تغییر می‌دهد؛ فعال‌سازی و تخصیص اعتبار همچنان جدا هستند.
            </p>
            <OrganizationProgramRegisterAction
              programId={program.id}
              revision={program.revision}
            />
          </Card>
        </>
      ) : null}
      <div className="org-banner org-banner--muted">
        <strong>مرز داده این مرحله</strong>
        <span>اطلاعات تخصیص، مصرف و مشمولان هنوز به این صفحه متصل نشده‌اند؛ هیچ مقدار نمونه‌ای به‌جای آن‌ها نمایش داده نمی‌شود.</span>
      </div>
    </>
  );
}

function CreateProgram({ profile }: { profile: OrganizationProfile | null }) {
  if (!profile) {
    return (
      <Card className="org-access-state">
        <h2>پروفایل سازمانی در دسترس نیست</h2>
        <p>برای ثبت پیش‌نویس، نشست و عضویت فعال سازمانی لازم است.</p>
        <Link className="org-button" href="/organization/programs">بازگشت به طرح‌ها</Link>
      </Card>
    );
  }
  if (profile.memberRole !== "PORTAL_ADMIN") {
    return (
      <Card className="org-access-state">
        <h2>مجوز ثبت طرح ندارید</h2>
        <p>در قرارداد فعلی فقط نقش PORTAL_ADMIN مجاز به ایجاد یا ویرایش پیش‌نویس طرح است.</p>
        <Link className="org-button" href="/organization/programs">بازگشت به طرح‌ها</Link>
      </Card>
    );
  }
  return (
    <>
      <div className="org-banner">
        <strong>ثبت پیش‌نویس واقعی</strong>
        <span>سازمان و روش تخصیص از نشست و پروفایل سازمان تعیین می‌شوند و قابل ارسال از مرورگر نیستند.</span>
      </div>
      <Card className="org-form-card">
        <div className="org-form-head">
          <h2>فرم راه‌اندازی و پیکربندی طرح اعتباری</h2>
          <p>این مرحله فقط Draft می‌سازد؛ فعال‌سازی یا تخصیص اعتبار انجام نمی‌شود.</p>
        </div>
        <OrganizationProgramDraftForm
          mode="create"
          defaultAllocationMethod={profile.defaultAllocationMethod}
        />
        <div className="org-actions">
          <Link className="org-button" href="/organization/programs">بازگشت به طرح‌ها</Link>
        </div>
      </Card>
    </>
  );
}

function recipientMatchBadge(status: OrganizationRecipientMatchStatus) {
  const tone = status === "MATCHED"
    ? "teal"
    : status === "NEEDS_MATCH"
      ? "warn"
      : "neutral";
  return <Badge tone={tone}>{organizationRecipientMatchLabels[status]}</Badge>;
}

function recipientPageHref(
  page: number,
  query: OrganizationRecipientListQuery,
) {
  const params = recipientListQueryString({ ...query, page });
  return "/organization/people" + (params ? "?" + params : "");
}

function People({
  state,
  query,
  profile,
}: {
  state: OrganizationRecipientsState;
  query: OrganizationRecipientListQuery;
  profile: OrganizationProfile | null;
}) {
  if (state.status !== "ready") {
    const message = state.status === "unauthenticated"
      ? "برای مشاهده افراد و مشمولان ابتدا وارد شوید."
      : state.status === "forbidden"
        ? "این حساب عضویت فعال برای مشاهده مشمولان سازمان ندارد."
        : state.status === "invalid"
          ? "فیلتر یا صفحه‌بندی واردشده معتبر نیست."
          : "فهرست افراد و مشمولان موقتاً در دسترس نیست.";
    return (
      <Card className="org-access-state">
        <h2>افراد و مشمولان نمایش داده نشد</h2>
        <p>{message}</p>
        {state.status === "unauthenticated"
          ? <Link className="org-button org-button--primary" href="/auth">ورود به حنا</Link>
          : state.status === "invalid"
            ? <Link className="org-button" href="/organization/people">پاک‌کردن فیلترها</Link>
            : null}
      </Card>
    );
  }

  const rows: ReactNode[][] = state.data.items.map((item) => [
    "—",
    <Badge key={item.id + "-usage"} tone="neutral">هنوز متصل نشده</Badge>,
    <Badge key={item.id + "-allocation"} tone="neutral">هنوز متصل نشده</Badge>,
    item.program.name,
    organizationRecipientSourceLabels[item.source],
    recipientMatchBadge(item.matchStatus),
    <span className="org-recipient-identity" key={item.id}>
      <strong>{item.displayName}</strong>
      <small>شناسه: <bdi>{item.referenceMasked}</bdi></small>
    </span>,
  ]);

  const programOptions = new Map<string, string>();
  for (const item of state.data.items)
    programOptions.set(item.program.id, item.program.name);
  if (query.programId && !programOptions.has(query.programId))
    programOptions.set(query.programId, "طرح انتخاب‌شده");

  const hasPrevious = state.data.page > 1;
  const hasNext =
    state.data.page * state.data.pageSize < state.data.total;
  const hasFilters = Boolean(
    query.programId || query.source || query.matchStatus || query.search,
  );

  return (
    <>
      <div className="org-banner org-people-banner">
        ثبت فرد در منبع داده سازمان به معنای تخصیص اعتبار نیست. در صورت وجود
        حساب حنا، اطلاعات فرد با همان حساب تطبیق داده می‌شود.
      </div>
      <form
        className="org-toolbar org-toolbar--filters org-recipient-filters"
        action="/organization/people"
        method="get"
      >
        {profile?.memberRole === "PORTAL_ADMIN" ? (
          <Link
            className="org-button org-button--primary"
            href="/organization/people/add"
          >
            افزودن مشمول
          </Link>
        ) : <span />}
        <input
          aria-label="جستجوی مشمول"
          name="search"
          defaultValue={query.search ?? ""}
          placeholder="نام یا شناسه ماسک‌شده..."
          maxLength={120}
        />
        <select
          aria-label="وضعیت تطبیق حنا"
          name="matchStatus"
          defaultValue={query.matchStatus ?? ""}
        >
          <option value="">همه وضعیت‌های تطبیق</option>
          <option value="MATCHED">حساب حنا شناسایی شده</option>
          <option value="NEEDS_MATCH">نیازمند تطبیق</option>
          <option value="PENDING_REVIEW">در انتظار بررسی</option>
        </select>
        <select
          aria-label="طرح مرتبط"
          name="programId"
          defaultValue={query.programId ?? ""}
        >
          <option value="">همه طرح‌های این نتیجه</option>
          {[...programOptions].map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select
          aria-label="منبع ثبت"
          name="source"
          defaultValue={query.source ?? ""}
        >
          <option value="">همه منابع (API / دستی)</option>
          <option value="API">API / منبع داده سازمان</option>
          <option value="MANUAL">ورود دستی</option>
        </select>
        {query.pageSize !== 20
          ? <input type="hidden" name="pageSize" value={query.pageSize} />
          : null}
        <div className="org-recipient-filter-actions">
          <button className="org-button" type="submit">اعمال فیلتر</button>
          {hasFilters
            ? <Link className="org-button" href="/organization/people">پاک‌کردن</Link>
            : null}
        </div>
      </form>
      <p className="org-recipient-boundary">
        افزودن انفرادی و import گروهی برای مدیر پرتال متصل است. ویرایش،
        تخصیص اعتبار و وضعیت مصرف هنوز قرارداد مستقل دارند و از این فهرست
        استنتاج نمی‌شوند.
      </p>
      <Card>
        {rows.length > 0 ? (
          <Table
            headers={[
              "عملیات",
              "وضعیت مصرف",
              "وضعیت تخصیص",
              "طرح مرتبط",
              "منبع ثبت",
              "وضعیت تطبیق با حنا",
              "شخص / شناسه موردنیاز",
            ]}
            rows={rows}
          />
        ) : (
          <div className="org-empty-state">
            <strong>مشمولی با این فیلترها پیدا نشد.</strong>
            <span>این نتیجه از داده واقعی سازمان فعلی خوانده شده است.</span>
          </div>
        )}
        <div className="org-pagination">
          <span>
            صفحه {state.data.page} · {state.data.total} مشمول
          </span>
          <div>
            {hasPrevious
              ? <Link className="org-button" href={recipientPageHref(state.data.page - 1, query)}>صفحه قبل</Link>
              : null}
            {hasNext
              ? <Link className="org-button" href={recipientPageHref(state.data.page + 1, query)}>صفحه بعد</Link>
              : null}
          </div>
        </div>
      </Card>
    </>
  );
}

function AddPeople({
  profile,
  programsState,
}: {
  profile: OrganizationProfile | null;
  programsState: OrganizationProgramOptionsState;
}) {
  if (!profile) {
    return (
      <Card className="org-access-state">
        <h2>فرم افزودن مشمول در دسترس نیست</h2>
        <p>برای ثبت مشمول باید نشست و عضویت فعال سازمانی داشته باشید.</p>
        <Link className="org-button org-button--primary" href="/auth">
          ورود به حنا
        </Link>
      </Card>
    );
  }

  if (profile.memberRole !== "PORTAL_ADMIN") {
    return (
      <Card className="org-access-state">
        <h2>مجوز افزودن مشمول فعال نیست</h2>
        <p>این عملیات فقط برای مدیر پرتال سازمان فعال است.</p>
        <Link className="org-button" href="/organization/people">
          بازگشت به لیست مشمولان
        </Link>
      </Card>
    );
  }

  if (programsState.status !== "ready") {
    const message = programsState.status === "unauthenticated"
      ? "نشست معتبر نیست؛ دوباره وارد شوید."
      : programsState.status === "forbidden"
        ? "دسترسی سازمانی فعال برای خواندن طرح‌ها وجود ندارد."
        : "فهرست طرح‌های قابل انتخاب موقتاً در دسترس نیست.";
    return (
      <Card className="org-access-state">
        <h2>طرح‌های مجاز بارگذاری نشد</h2>
        <p>{message}</p>
        <Link className="org-button" href="/organization/people/add">
          تلاش مجدد برای بارگذاری
        </Link>
      </Card>
    );
  }

  return (
    <>
      <div className="org-toolbar">
        <Link className="org-button" href="/organization/people">
          بازگشت به لیست مشمولان
        </Link>
      </div>
      <div className="org-grid org-grid--2 org-add-people-grid">
        <Card className="org-recipient-bulk-card">
          <OrganizationRecipientBulkImportForm
            programs={programsState.programs}
          />
        </Card>
        <Card className="org-recipient-create-card">
          <OrganizationRecipientCreateForm
            programs={programsState.programs}
          />
        </Card>
      </div>
    </>
  );
}

function DataSources() {
  return (
    <>
      <div className="org-banner">اتصال منبع داده سازمان، همگام‌سازی رکوردها و تطبیق با حساب حنا مراحل مجزا هستند. ممکن است منبع متصل باشد اما برخی رکوردهای همگام‌سازی‌شده هنوز نیازمند بررسی باشند.</div>
      <div className="org-grid org-grid--2">
        <Card title="وضعیت اتصال درگاه سازمان">
          <Pair label="منبع داده سازمان" value="درگاه فعال سازمان حمایتگر" />
          <Pair label="آخرین همگام‌سازی موفق" value="زمان نمونه" />
          <Pair label="وضعیت همگام‌سازی" value={<Badge>همگام‌سازی شده</Badge>} />
          <div className="org-actions"><button className="org-button" type="button">بررسی تست اتصال</button><button className="org-button org-button--primary" type="button">اجرای همگام‌سازی دستی</button></div>
        </Card>
        <Card title="خطاهای همگام‌سازی اخیر">
          <ul className="org-activity"><li><span>عدم تطابق ساختار شناسه در رکوردهای ارسالی</span><small>زمان نمونه</small></li><li><span>خطای موقت همگام‌سازی با منبع داده سازمان</span><small>زمان نمونه</small></li></ul>
        </Card>
      </div>
    </>
  );
}

function AllocationAccessState({
  state,
}: {
  state: Exclude<OrganizationAllocationReadinessState, { status: "ready" }>;
}) {
  const content = state.status === "unauthenticated"
    ? {
        title: "برای مشاهده آمادگی تخصیص وارد شوید",
        body: "نشست معتبر سازمانی پیدا نشد.",
        action: (
          <Link className="org-button org-button--primary" href="/auth">
            ورود به حنا
          </Link>
        ),
      }
    : state.status === "forbidden"
      ? {
          title: "دسترسی سازمانی فعال نیست",
          body: "این حساب عضویت فعال در سازمانی برای مشاهده آمادگی تخصیص ندارد.",
          action: null,
        }
      : {
          title: "وضعیت آمادگی تخصیص موقتاً در دسترس نیست",
          body: "برای جلوگیری از نمایش داده قدیمی یا ساختگی، داده نمونه جایگزین نمی‌شود.",
          action: (
            <Link className="org-button" href="/organization/allocation">
              تلاش مجدد
            </Link>
          ),
        };

  return (
    <Card className="org-access-state">
      <h2>{content.title}</h2>
      <p>{content.body}</p>
      {content.action}
    </Card>
  );
}

function allocationProgramBadge(status: "REGISTERED" | "ACTIVE") {
  return status === "ACTIVE"
    ? <Badge>فعال</Badge>
    : <Badge tone="neutral">ثبت‌شده</Badge>;
}

function Allocation({
  state,
}: {
  state: OrganizationAllocationReadinessState;
}) {
  if (state.status !== "ready")
    return <AllocationAccessState state={state} />;

  const data = state.data;
  return (
    <>
      <div className="org-banner org-allocation-context">
        <strong>
          نوع سازمان فعال: {data.organizationType} | روش تخصیص: {data.allocationMethod}
        </strong>
        <span>
          این صفحه فقط آمادگی ورودی را نمایش می‌دهد؛ اجرای مالی تخصیص هنوز فعال نیست.
        </span>
      </div>

      <div className="org-grid org-grid--2 org-allocation-board">
        <div className="org-stack">
          <Card title="جمعیت ثبت‌شده و منبع افراد">
            <div className="org-allocation-stats">
              <Pair
                label="اطلاعات دریافت‌شده از رکوردهای طرح‌های مجاز"
                value={data.inputRecordCount.toLocaleString("fa-IR") + " رکورد"}
              />
              <Pair
                label="رکوردهای آماده برای بررسی تخصیص"
                value={
                  <strong className="org-allocation-ready">
                    {data.readyRecordCount.toLocaleString("fa-IR")} رکورد
                  </strong>
                }
              />
              <Pair
                label="نیازمند بررسی یا تطبیق اطلاعات"
                value={
                  <strong className="org-allocation-review">
                    {data.needsReviewRecordCount.toLocaleString("fa-IR")} رکورد
                  </strong>
                }
              />
            </div>
            <div className="org-allocation-sources">
              <span>ثبت دستی: {data.sources.manualRecordCount.toLocaleString("fa-IR")}</span>
              <span>منبع API: {data.sources.apiRecordCount.toLocaleString("fa-IR")}</span>
            </div>
          </Card>

          <Card title="وضعیت آخرین فرآیندهای تخصیص">
            <div className="org-allocation-history-empty">
              <Badge tone="neutral">تاریخچه فعال نیست</Badge>
              <p>
                هنوز مدل فرآیند مالی تخصیص در هسته حنا فعال نشده است؛
                بنابراین هیچ سابقه نمونه‌ای به‌عنوان سابقه واقعی نمایش داده نمی‌شود.
              </p>
            </div>
          </Card>
        </div>

        <div className="org-stack">
          <Card title="قوانین و الگوهای فعال تخصیص">
            <Pair label="الگوی فعال ثبت‌شده" value={data.allocationMethod} />
            <Pair
              label="دوره فعال هدف"
              value={data.targetPeriod ?? "هنوز تعریف نشده"}
            />
            <p className="org-note">
              این پرتال فقط روش تخصیص ثبت‌شده را نمایش می‌دهد. جزئیات قواعد
              مالی داخلی تا تعریف و تصویب قرارداد اجرایی در این صفحه ساخته یا
              استنتاج نمی‌شود.
            </p>
          </Card>

          <Card
            title={"تخصیص بر اساس " + data.allocationMethod}
            className="org-allocation-control"
          >
            <p className="org-allocation-control__copy">
              ورودی طرح‌ها و وضعیت تطبیق مشمولان قابل مرور است، اما ایجاد
              اعتبار، مبلغ، مانده یا ثبت ledger در این نسخه انجام نمی‌شود.
            </p>
            <div className="org-divider" />
            <div className="org-actions">
              <a className="org-button" href="#allocation-programs">
                مرور ورودی و وضعیت تخصیص
              </a>
              <button
                className="org-button org-button--primary"
                type="button"
                disabled
                aria-disabled="true"
                title="قرارداد مالی تخصیص هنوز در هسته حنا فعال نشده است."
              >
                شروع فرایند تخصیص
              </button>
            </div>
            <small className="org-allocation-boundary">
              execution: NOT_CONFIGURED — هیچ عملیات مالی از این صفحه قابل اجرا نیست.
            </small>
          </Card>
        </div>
      </div>

      <Card title="طرح‌های قابل مرور برای تخصیص" className="org-allocation-programs">
        <div id="allocation-programs" className="org-allocation-program-list">
          {data.programs.length === 0 ? (
            <p className="org-muted">
              هیچ طرح ثبت‌شده یا فعالی برای مرور آمادگی تخصیص وجود ندارد.
            </p>
          ) : data.programs.map(program => (
            <article className="org-allocation-program-row" key={program.id}>
              <div>
                <strong>{program.name}</strong>
                <span>
                  {program.inputRecordCount.toLocaleString("fa-IR")} ورودی ·{" "}
                  {program.readyRecordCount.toLocaleString("fa-IR")} آماده ·{" "}
                  {program.needsReviewRecordCount.toLocaleString("fa-IR")} نیازمند بررسی
                </span>
              </div>
              <div className="org-allocation-program-actions">
                {allocationProgramBadge(program.status)}
                <Link
                  className="org-button"
                  href={"/organization/allocation/" + program.id}
                >
                  مشاهده جزئیات آمادگی
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </>
  );
}

function AllocationDetailAccessState({
  state,
}: {
  state: Exclude<OrganizationAllocationProgramState, { status: "ready" }>;
}) {
  const content = state.status === "unauthenticated"
    ? {
        title: "برای مشاهده جزئیات آمادگی وارد شوید",
        body: "نشست معتبر سازمانی پیدا نشد.",
        action: (
          <Link className="org-button org-button--primary" href="/auth">
            ورود به حنا
          </Link>
        ),
      }
    : state.status === "forbidden"
      ? {
          title: "دسترسی سازمانی فعال نیست",
          body: "این حساب مجوز مشاهده آمادگی این سازمان را ندارد.",
          action: null,
        }
      : state.status === "not_found"
        ? {
            title: "طرح قابل مرور پیدا نشد",
            body: "این طرح وجود ندارد یا در وضعیت قابل بررسی تخصیص نیست.",
            action: (
              <Link className="org-button" href="/organization/allocation">
                بازگشت به مدیریت تخصیص
              </Link>
            ),
          }
        : {
            title: "جزئیات آمادگی موقتاً در دسترس نیست",
            body: "داده نمونه جایگزین پاسخ واقعی نمی‌شود.",
            action: (
              <Link className="org-button" href="/organization/allocation">
                بازگشت به مدیریت تخصیص
              </Link>
            ),
          };

  return (
    <Card className="org-access-state">
      <h2>{content.title}</h2>
      <p>{content.body}</p>
      {content.action}
    </Card>
  );
}

function AllocationDetail({
  state,
}: {
  state: OrganizationAllocationProgramState;
}) {
  if (state.status !== "ready")
    return <AllocationDetailAccessState state={state} />;

  const { program, execution, result } = state.data;
  const shortId = program.id.slice(0, 8) + "…";

  return (
    <>
      <div className="org-toolbar org-allocation-detail-toolbar">
        <Link className="org-button" href="/organization/allocation">
          بازگشت به مدیریت تخصیص‌ها
        </Link>
        <div>
          <Badge tone="warn">اجرای مالی غیرفعال</Badge>
          <span className="org-code">شناسه طرح: {shortId}</span>
        </div>
      </div>

      <div className="org-banner org-allocation-readiness-banner">
        <strong>این صفحه وضعیت آمادگی ورودی را نشان می‌دهد.</strong>
        <span>
          هیچ تخصیص اعتباری اجرا نشده و نتیجه مالی یا رکورد تخصیص قطعی وجود ندارد.
        </span>
      </div>

      <div className="org-grid org-grid--2">
        <Card title="اطلاعات پایه تخصیص">
          <Pair label="طرح مرتبط" value={program.name} />
          <Pair label="روش تخصیص فعال" value={program.allocationMethod} />
          <Pair
            label="تعداد رکوردهای ورودی"
            value={program.inputRecordCount.toLocaleString("fa-IR") + " رکورد"}
          />
          <Pair
            label="وضعیت طرح"
            value={allocationProgramBadge(program.status)}
          />
        </Card>

        <Card title="نتیجه نهایی تخصیص">
          <Pair
            label="نتیجه تخصیص"
            value={<Badge tone="warn">تخصیص اجرا نشده</Badge>}
          />
          <Pair label="رکوردهای تخصیص‌یافته" value="—" />
          <Pair
            label="رکوردهای آماده برای بررسی"
            value={program.readyRecordCount.toLocaleString("fa-IR") + " رکورد"}
          />
          <Pair
            label="موارد نیازمند بررسی"
            value={result.needsReviewRecordCount.toLocaleString("fa-IR") + " رکورد"}
          />
          <p className="org-note">
            آماده‌بودن یک رکورد فقط به معنی تکمیل تطبیق حساب در مدل فعلی است؛
            این وضعیت به معنی ایجاد اعتبار یا تأیید واجدشرایط‌بودن مالی نیست.
          </p>
        </Card>
      </div>

      <Card title="موارد نیازمند بررسی">
        <div className="org-allocation-review-grid">
          <Pair
            label="رکوردهای نیازمند تطبیق یا بررسی"
            value={program.needsReviewRecordCount.toLocaleString("fa-IR")}
          />
          <Pair
            label="رکوردهای آماده مرور"
            value={program.readyRecordCount.toLocaleString("fa-IR")}
          />
          <Pair
            label="ثبت دستی"
            value={program.sources.manualRecordCount.toLocaleString("fa-IR")}
          />
          <Pair
            label="منبع API"
            value={program.sources.apiRecordCount.toLocaleString("fa-IR")}
          />
        </div>
      </Card>

      <div className="org-allocation-execution-note" role="status">
        <strong>{execution.state}</strong>
        <span>
          قابلیت ایجاد مبلغ، مانده، entitlement یا ledger از این صفحه پشتیبانی نمی‌شود.
        </span>
      </div>
    </>
  );
}

function UsageAccessState({
  state,
}: {
  state: Exclude<OrganizationUsageStatusState, { status: "ready" }>;
}) {
  const content = state.status === "unauthenticated"
    ? {
        title: "برای مشاهده وضعیت استفاده وارد شوید",
        body: "نشست معتبر سازمانی پیدا نشد.",
        action: (
          <Link className="org-button org-button--primary" href="/auth">
            ورود به حنا
          </Link>
        ),
      }
    : state.status === "forbidden"
      ? {
          title: "دسترسی سازمانی فعال نیست",
          body: "این حساب عضویت فعال برای مشاهده وضعیت استفاده سازمان ندارد.",
          action: null,
        }
      : {
          title: "وضعیت استفاده موقتاً در دسترس نیست",
          body: "برای جلوگیری از نمایش مبلغ یا وضعیت ساختگی، داده نمونه جایگزین پاسخ واقعی نمی‌شود.",
          action: (
            <Link className="org-button" href="/organization/usage">
              تلاش مجدد
            </Link>
          ),
        };

  return (
    <Card className="org-access-state">
      <h2>{content.title}</h2>
      <p>{content.body}</p>
      {content.action}
    </Card>
  );
}

function Usage({
  state,
}: {
  state: OrganizationUsageStatusState;
}) {
  if (state.status !== "ready")
    return <UsageAccessState state={state} />;

  const data = state.data;
  const unavailable = "در دسترس نیست";

  return (
    <>
      <div className="org-usage-context">
        <Badge tone="neutral">{data.organizationType}</Badge>
        <span className="org-usage-sync">
          آخرین همگام‌سازی مالی ثبت‌شده:{" "}
          <strong>هنوز پیکربندی نشده</strong>
        </span>
      </div>

      <div className="org-stats org-usage-stats">
        <Card>
          <span>کل اعتبارات تخصیص یافته</span>
          <strong className="org-usage-unavailable">{unavailable}</strong>
        </Card>
        <Card>
          <span>اعتبار فعال در حال استفاده</span>
          <strong className="org-usage-unavailable org-usage-unavailable--teal">
            {unavailable}
          </strong>
        </Card>
        <Card>
          <span>اعتبار مصرف شده</span>
          <strong className="org-usage-unavailable org-usage-unavailable--warn">
            {unavailable}
          </strong>
        </Card>
        <Card>
          <span>اعتبار راکد یا استفاده نشده</span>
          <strong className="org-usage-unavailable">{unavailable}</strong>
        </Card>
      </div>

      <div className="org-banner org-banner--muted org-usage-boundary">
        <strong>داده مالی وضعیت استفاده هنوز در هسته حنا فعال نشده است.</strong>
        <span>
          null در این صفحه به معنی صفر نیست. تا زمانی که مدل ledger و مصرف
          واقعی تعریف نشود، مبلغ یا وضعیت مصرف از طرح‌ها و مشمولان استنتاج
          نمی‌شود.
        </span>
      </div>

      <Card title="لیست وضعیت مصرف مشمولان" className="org-usage-table-card">
        <Table
          headers={[
            "آخرین وضعیت ثبت‌شده",
            "میزان استفاده",
            "اعتبار تخصیص یافته",
            "وضعیت مصرف",
            "شناسه مشمول",
            "نام مشمول",
          ]}
          rows={[]}
        />
        <div className="org-usage-empty">
          <Badge tone="neutral">داده مصرف موجود نیست</Badge>
          <strong>هیچ ردیف مصرف مالی قابل نمایش نیست.</strong>
          <span>
            Backend 048 عمداً enrollment مشمولان را به مصرف یا اعتبار
            تخصیص‌یافته تبدیل نمی‌کند.
          </span>
        </div>
      </Card>

      <div className="org-usage-capability" role="status">
        <strong>{data.capability.state}</strong>
        <span>
          monetary usage read model: unavailable · ledger: unavailable
        </span>
      </div>
    </>
  );
}

function ReportsAccessState({
  state,
}: {
  state: Exclude<OrganizationReportsOverviewState, { status: "ready" }>;
}) {
  const content = state.status === "unauthenticated"
    ? {
        title: "برای مشاهده گزارش‌ها وارد شوید",
        body: "نشست معتبر سازمانی پیدا نشد.",
        action: (
          <Link className="org-button org-button--primary" href="/auth">
            ورود به حنا
          </Link>
        ),
      }
    : state.status === "forbidden"
      ? {
          title: "دسترسی سازمانی فعال نیست",
          body: "این حساب عضویت فعال برای مشاهده گزارش‌های سازمان ندارد.",
          action: null,
        }
      : {
          title: "گزارش‌های سازمان موقتاً در دسترس نیست",
          body: "برای جلوگیری از نمایش KPI یا نمودار ساختگی، داده نمونه جایگزین پاسخ واقعی نمی‌شود.",
          action: (
            <Link className="org-button" href="/organization/reports">
              تلاش مجدد
            </Link>
          ),
        };

  return (
    <Card className="org-access-state">
      <h2>{content.title}</h2>
      <p>{content.body}</p>
      {content.action}
    </Card>
  );
}

function Reports({
  state,
}: {
  state: OrganizationReportsOverviewState;
}) {
  if (state.status !== "ready")
    return <ReportsAccessState state={state} />;

  const data = state.data;
  const rate = data.matching.matchRatePercent;

  return (
    <>
      <div className="org-reports-context">
        <Badge tone="neutral">{data.organizationType}</Badge>
        <span>
          آخرین همگام‌سازی ثبت‌شده:{" "}
          <strong>هنوز پیکربندی نشده</strong>
        </span>
      </div>

      <div className="org-grid org-grid--2 org-reports-grid">
        <Card title="وضعیت تطبیق افراد" className="org-report-card">
          <div className="org-report-metric">
            <span>کل رکوردهای مشمول طرح‌های مجاز</span>
            <strong className="org-report-real">
              {data.matching.totalEnrollmentRecordCount.toLocaleString("fa-IR")} رکورد
            </strong>
          </div>
          <div className="org-report-metric org-report-metric--secondary">
            <span>
              {data.matching.matchedRecordCount.toLocaleString("fa-IR")} تطبیق‌شده ·{" "}
              {data.matching.needsReviewRecordCount.toLocaleString("fa-IR")} نیازمند بررسی
            </span>
            <strong>
              {rate === null
                ? "نرخ قابل محاسبه نیست"
                : rate.toLocaleString("fa-IR", {
                    maximumFractionDigits: 2,
                  }) + "٪ تطبیق"}
            </strong>
          </div>
          <div
            className="org-report-progress"
            role="progressbar"
            aria-label="نرخ تطبیق رکوردهای مشمول"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rate ?? undefined}
            aria-valuetext={
              rate === null
                ? "بدون رکورد ورودی"
                : rate.toLocaleString("fa-IR", {
                    maximumFractionDigits: 2,
                  }) + " درصد"
            }
          >
            <span style={{ width: (rate ?? 0) + "%" }} />
          </div>
          <small>
            دامنه: رکوردهای مشمول طرح‌های ثبت‌شده و فعال ·{" "}
            {data.matching.eligibleProgramCount.toLocaleString("fa-IR")} طرح
          </small>
        </Card>

        <Card title="وضعیت مصرف طرح‌ها" className="org-report-card">
          <div className="org-report-metric">
            <span>بودجه استفاده‌شده</span>
            <strong className="org-report-unavailable">
              در دسترس نیست
            </strong>
          </div>
          <div className="org-report-unavailable-bar" aria-hidden="true" />
          <p className="org-note">
            مدل مالی مصرف و بودجه هنوز پیکربندی نشده است؛ مقدار null به
            معنی صفر درصد یا صفر ریال نیست.
          </p>
        </Card>
      </div>

      <Card
        title="روند کلی تخصیص و توزیع طرح"
        className="org-report-trend-card"
      >
        <div className="org-report-trend-empty">
          <div className="org-report-axis" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
          <Badge tone="neutral">روند مالی در دسترس نیست</Badge>
          <strong>هیچ ستون یا دوره نمونه‌ای نمایش داده نمی‌شود.</strong>
          <p>
            تا زمانی که اجرای واقعی تخصیص و تاریخچه توزیع تعریف نشود،
            این نمودار از داده enrollment یا readiness استنتاج نمی‌شود.
          </p>
        </div>
      </Card>

      <div className="org-reports-capability" role="status">
        <span>
          financial reporting: unavailable · allocation/distribution trend: unavailable
        </span>
      </div>
    </>
  );
}

function Notifications() {
  const items = [
    ["همگام‌سازی منبع داده سازمان", "اطلاعات منبع داده سازمان همگام‌سازی شد."],
    ["ثبت یک طرح نمونه", "یک طرح نمونه در پرتال ثبت شد."],
    ["وضعیت یک طرح ثبت‌شده تغییر کرده است.", "جزئیات وضعیت در صفحه همان طرح قابل مشاهده است."],
  ];
  return <Card>{items.map(([t,d]) => <article className="org-notification" key={t}><div><h2>{t}</h2><p>{d}</p></div><small>زمان نمونه</small></article>)}</Card>;
}

function Support() {
  return (
    <>
      <label className="org-search">جستجو در راهنمای پرتال حنا<input placeholder="عبارت مورد نظر خود را تایپ کنید (مثلاً: ثبت طرح، الگوی تخصیص)..." /></label>
      <div className="org-grid org-grid--2">
        <Card title="راهنمای پرتال">
          <div className="org-guide-list">
            <Pair label="راهنمای جامع ایجاد، ویرایش و مدیریت دوره‌های اعتباری سازمان" value="طرح‌ها و اعتبارها" />
            <Pair label="نحوه مدیریت اطلاعات هویتی و افزودن مشمولان جدید به طرح‌ها" value="افراد و مشمولان" />
            <Pair label="راهنمای روش‌های تخصیص در پرتال سازمانی" value="تخصیص و مدل حنا" />
            <Pair label="راهنمای اتصال API / منبع داده سازمان" value="منابع داده و API" />
          </div>
        </Card>
        <Card title="تاریخچه تیکت‌های پشتیبانی سازمان">
          <Pair label="درخواست پشتیبانی — بررسی تطبیق شناسه برخی مشمولان" value={<Badge>پاسخ داده شده</Badge>} />
          <Pair label="درخواست پشتیبانی — بررسی وضعیت اتصال API" value={<Badge tone="neutral">در حال بررسی</Badge>} />
        </Card>
      </div>
    </>
  );
}

function Settings() {
  return (
    <>
      <div className="org-banner org-banner--privacy"><strong>حریم خصوصی و دسترسی اعتباری</strong><span>توجه: این سازمان صرفاً مجاز به مشاهده و مدیریت داده‌های مربوط به طرح‌ها، برنامه‌های اعتباری و مشمولان تعریف‌شده در پورتال خود می‌باشد. دسترسی به تراکنش‌های شخصی خارج از چهارچوب طرح‌های سازمان امکان‌پذیر نیست.</span></div>
      <div className="org-grid org-grid--2">
        <Card title="تنظیمات دریافت اعلان‌ها">
          <label className="org-toggle"><input type="checkbox" defaultChecked /> ارسال پیامک تایید تخصیص اعتبار به مشمولان</label>
          <label className="org-toggle"><input type="checkbox" defaultChecked /> اعلام همگام‌سازی ناموفق مخزن داده در پرتال</label>
          <label className="org-toggle"><input type="checkbox" /> ارسال گزارش هفتگی به ایمیل نماینده سازمان</label>
        </Card>
        <Card title="کاربران و دسترسی‌های مجاز سازمان">
          <Pair label="نماینده رسمی سازمان · کد کاربری: ****۹۸۲" value={<Badge>کاربر ارشد پرتال</Badge>} />
          <Pair label="بخش فناوری اطلاعات · کد کاربری: ****۴۱۲" value={<Badge tone="neutral">اپراتور فنی طرح</Badge>} />
        </Card>
      </div>
    </>
  );
}

function Screen({
  screen,
  profileState,
  programsState,
  programsQuery,
  programDetailState,
  recipientsState,
  recipientsQuery,
  recipientProgramOptionsState,
  allocationReadinessState,
  allocationProgramState,
  usageStatusState,
  reportsOverviewState,
}: {
  screen: OrgScreenKey;
  profileState: OrganizationProfileState;
  programsState?: OrganizationProgramsState;
  programsQuery?: OrganizationProgramListQuery;
  programDetailState?: OrganizationProgramDetailState;
  recipientsState?: OrganizationRecipientsState;
  recipientsQuery?: OrganizationRecipientListQuery;
  recipientProgramOptionsState?: OrganizationProgramOptionsState;
  allocationReadinessState?: OrganizationAllocationReadinessState;
  allocationProgramState?: OrganizationAllocationProgramState;
  usageStatusState?: OrganizationUsageStatusState;
  reportsOverviewState?: OrganizationReportsOverviewState;
}) {
  const profile = profileState.status === "ready"
    ? profileState.profile : null;
  switch (screen) {
    case "dashboard": return <Dashboard profile={profile} />;
    case "profile": return <Profile state={profileState} />;
    case "programs": return (
      <Programs
        state={programsState ?? { status: "unavailable" }}
        query={programsQuery ?? defaultProgramListQuery}
      />
    );
    case "program-detail": return (
      <ProgramDetail
        state={programDetailState ?? { status: "unavailable" }}
        profile={profile}
      />
    );
    case "create-program": return <CreateProgram profile={profile} />;
    case "people": return (
      <People
        state={recipientsState ?? { status: "unavailable" }}
        query={recipientsQuery ?? defaultRecipientListQuery}
        profile={profile}
      />
    );
    case "add-people": return (
      <AddPeople
        profile={profile}
        programsState={
          recipientProgramOptionsState ?? { status: "unavailable" }
        }
      />
    );
    case "data-sources": return <DataSources />;
    case "allocation": return (
      <Allocation
        state={allocationReadinessState ?? { status: "unavailable" }}
      />
    );
    case "allocation-detail": return (
      <AllocationDetail
        state={allocationProgramState ?? { status: "unavailable" }}
      />
    );
    case "usage": return (
      <Usage
        state={usageStatusState ?? { status: "unavailable" }}
      />
    );
    case "reports": return (
      <Reports
        state={reportsOverviewState ?? { status: "unavailable" }}
      />
    );
    case "notifications": return <Notifications />;
    case "support": return <Support />;
    case "settings": return <Settings />;
  }
}

function activeNav(screen: OrgScreenKey) {
  if (screen === "program-detail" || screen === "create-program") return "programs";
  if (screen === "add-people") return "people";
  if (screen === "allocation-detail") return "allocation";
  return screen;
}

export function OrganizationPortal({
  screen,
  profileState,
  programsState,
  programsQuery,
  programDetailState,
  recipientsState,
  recipientsQuery,
  recipientProgramOptionsState,
  allocationReadinessState,
  allocationProgramState,
  usageStatusState,
  reportsOverviewState,
}: {
  screen: OrgScreenKey;
  profileState: OrganizationProfileState;
  programsState?: OrganizationProgramsState;
  programsQuery?: OrganizationProgramListQuery;
  programDetailState?: OrganizationProgramDetailState;
  recipientsState?: OrganizationRecipientsState;
  recipientsQuery?: OrganizationRecipientListQuery;
  recipientProgramOptionsState?: OrganizationProgramOptionsState;
  allocationReadinessState?: OrganizationAllocationReadinessState;
  allocationProgramState?: OrganizationAllocationProgramState;
  usageStatusState?: OrganizationUsageStatusState;
  reportsOverviewState?: OrganizationReportsOverviewState;
}) {
  const active = activeNav(screen);
  const profile = profileState.status === "ready"
    ? profileState.profile : null;
  const accessText = profileState.status === "ready"
    ? "پروفایل سازمانی متصل"
    : profileState.status === "unauthenticated"
      ? "نشست سازمانی معتبر نیست"
      : profileState.status === "forbidden"
        ? "دسترسی سازمانی فعال نیست"
        : "سرویس سازمان در دسترس نیست";

  return (
    <main className="org-shell" dir="rtl">
      <section className="org-content">
        <header className="org-header">
          <div className="org-header__meta">
            <Badge tone={profile ? "neutral" : "warn"}>
              {profile?.organizationType ?? "پرتال سازمانی"}
            </Badge>
            <span>{profile?.name ?? accessText}</span>
          </div>
          <h1>{titles[screen]}</h1>
        </header>
        <div className="org-body">
          <Screen
            screen={screen}
            profileState={profileState}
            programsState={programsState}
            programsQuery={programsQuery}
            programDetailState={programDetailState}
            recipientsState={recipientsState}
            recipientsQuery={recipientsQuery}
            recipientProgramOptionsState={recipientProgramOptionsState}
            allocationReadinessState={allocationReadinessState}
            allocationProgramState={allocationProgramState}
            usageStatusState={usageStatusState}
            reportsOverviewState={reportsOverviewState}
          />
        </div>
      </section>
      <aside className="org-sidebar">
        <div className="org-brand"><Image src="/hana-logo.png" alt="حنا" width={82} height={38} /><strong>پنل سازمان‌ها</strong></div>
        <nav aria-label="ناوبری پرتال سازمانی">
          {nav.map(([key,label,href,icon]) => <Link key={key} href={href} className={active === key ? "is-active" : ""}><span>{label}</span><b aria-hidden>{icon}</b></Link>)}
        </nav>
        <div className="org-user">
          <div>
            <strong>{profile?.name ?? "حساب سازمانی"}</strong>
            <small>{profile?.memberRole ?? accessText}</small>
          </div>
          <span>{profile?.name.trim().charAt(0) || "ح"}</span>
        </div>
      </aside>
    </main>
  );
}
