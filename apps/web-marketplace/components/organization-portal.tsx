import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { OrganizationProgramDraftForm } from "./organization-program-draft-form";
import { OrganizationProgramRegisterAction } from "./organization-program-register-action";
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
import {
  defaultProgramListQuery,
  organizationProgramStatusLabels,
  programListQueryString,
  type OrganizationProgramDetailState,
  type OrganizationProgramListQuery,
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
  "allocation/detail": "allocation-detail",
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
}: {
  state: OrganizationRecipientsState;
  query: OrganizationRecipientListQuery;
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
        <button
          className="org-button org-button--primary"
          type="button"
          disabled
          title="افزودن مشمول بعد از قرارداد mutation فعال می‌شود."
        >
          افزودن مشمول
        </button>
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
        افزودن/ویرایش مشمول، تخصیص اعتبار و وضعیت مصرف در این مرحله به backend
        متصل نشده‌اند و از روی این فهرست استنتاج نمی‌شوند.
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

function AddPeople() {
  return (
    <>
      <div className="org-toolbar">
        <Link className="org-button" href="/organization/people">
          بازگشت به لیست مشمولان
        </Link>
      </div>
      <Card className="org-access-state">
        <h2>افزودن مشمول هنوز فعال نشده است</h2>
        <p>
          Backend 040 فقط قرارداد خواندن افراد و مشمولان را اضافه کرده است.
          تا زمانی که قرارداد mutation، اعتبارسنجی شناسه و رفتار رکوردهای
          تکراری تعریف نشود، فرم نمونه Figma درخواست واقعی ارسال نمی‌کند.
        </p>
      </Card>
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

function Allocation() {
  return (
    <>
      <div className="org-banner"><strong>نوع سازمان فعال: سازمان حمایتگر | روش تخصیص: الگوی حنا</strong><span>روش تخصیص سازمان معمولی: انتخاب توسط سازمان</span></div>
      <div className="org-grid org-grid--2">
        <Card title="قوانین و الگوهای فعال تخصیص">
          <Pair label="الگوی فعال" value="الگوی تخصیص حنا" />
          <Pair label="دوره فعال هدف" value="بازه نمونه" />
          <p className="org-note">تخصیص اعتبار بر اساس قواعد ثبت‌شده و الگوی تخصیص حنا انجام می‌شود. جزئیات قواعد داخلی تخصیص در این پنل نمایش داده نمی‌شود.</p>
        </Card>
        <Card title="مرور ورودی و وضعیت تخصیص">
          <Pair label="جمعیت ثبت‌شده و منبع افراد" value="جمعیت ثبت‌شده: داده نمونه" />
          <Pair label="رکوردهای آماده برای بررسی تخصیص" value="رکوردهای آماده: داده نمونه" />
          <Pair label="نیازمند بررسی یا تطبیق اطلاعات" value="نیازمند بررسی: داده نمونه" />
          <div className="org-actions"><Link className="org-button org-button--primary" href="/organization/allocation/detail">شروع فرایند تخصیص</Link></div>
        </Card>
      </div>
      <Card title="وضعیت آخرین فرآیندهای تخصیص">
        <div className="org-list"><Pair label="تاریخ نمونه — طرح نمونه ۱" value={<Badge>توزیع شده</Badge>} /><Pair label="تاریخ نمونه — طرح نمونه ۲" value={<Badge tone="neutral">در حال پردازش</Badge>} /></div>
      </Card>
    </>
  );
}

function AllocationDetail() {
  return (
    <>
      <div className="org-toolbar"><Link className="org-button" href="/organization/allocation">بازگشت به مدیریت تخصیص‌ها</Link><div><Badge>وضعیت پردازش: تکمیل‌شده</Badge> <span className="org-code">شناسه تخصیص: ALC-***۲۴</span></div></div>
      <div className="org-banner org-banner--muted">پردازش بر اساس قواعد و الگوی ثبت‌شده حنا انجام شده است. نتیجه نهایی تخصیص نیازمند بررسی جداگانه است.</div>
      <div className="org-grid org-grid--2">
        <Card title="نتیجه نهایی تخصیص">
          <Pair label="نتیجه تخصیص" value={<Badge tone="warn">در انتظار بررسی نهایی</Badge>} />
          <Pair label="رکوردهای تخصیص‌یافته" value="داده نمونه" />
          <Pair label="موارد نیازمند بررسی" value="—" />
          <p className="org-note">اطلاعات حساب حنا نیازمند تطبیق؛ اطلاعات منبع نیازمند بررسی یا همگام‌سازی مجدد است.</p>
        </Card>
        <Card title="اطلاعات پایه تخصیص">
          <Pair label="طرح مرتبط" value="طرح نمونه ۱" />
          <Pair label="روش تخصیص فعال" value="الگوی تخصیص حنا" />
          <Pair label="تعداد رکوردهای ورودی" value="رکوردهای ورودی: داده نمونه" />
          <Pair label="وضعیت پردازش" value={<Badge>پردازش‌شده</Badge>} />
        </Card>
      </div>
    </>
  );
}

function Usage() {
  const rows: ReactNode[][] = [
    ["تاریخ نمونه", "مقدار نمونه", "مقدار نمونه", <Badge key="a">استفاده شده</Badge>, "***۰۰۷۲۱۶", "فرد نمونه ۱"],
    ["تاریخ نمونه", "مقدار نمونه", "مقدار نمونه", <Badge key="b" tone="neutral">بخشی استفاده شده</Badge>, "***۰۱۲۵۴۴", "فرد نمونه ۲"],
    ["-", "مقدار نمونه", "مقدار نمونه", <Badge key="c" tone="warn">استفاده نشده</Badge>, "***۰۴۳۹۸۱", "فرد نمونه ۳"],
    ["تاریخ نمونه", "مقدار نمونه", "مقدار نمونه", <Badge key="d" tone="neutral">پایان‌یافته / غیرفعال</Badge>, "***۰۰۹۶۱۲", "فرد نمونه ۴"],
  ];
  return (
    <>
      <div className="org-stats">
        <Card><strong>مقدار نمونه</strong><span>کل اعتبارات تخصیص یافته</span></Card>
        <Card><strong>مقدار نمونه</strong><span>اعتبار فعال در حال استفاده</span></Card>
        <Card><strong>مقدار نمونه</strong><span>اعتبار مصرف شده</span></Card>
        <Card><strong>مقدار نمونه</strong><span>اعتبار راکد یا استفاده نشده</span></Card>
      </div>
      <Card title="لیست وضعیت مصرف مشمولان"><Table headers={["آخرین وضعیت ثبت‌شده", "میزان استفاده", "اعتبار تخصیص یافته", "وضعیت مصرف", "شناسه مشمول", "نام مشمول"]} rows={rows} /></Card>
    </>
  );
}

function Reports() {
  return (
    <>
      <div className="org-stats org-stats--3">
        <Card><strong>وضعیت تطبیق: داده نمونه</strong><span>کل مشمولان متصل</span></Card>
        <Card><strong>وضعیت استفاده: داده نمونه</strong><span>بودجه استفاده‌شده</span></Card>
        <Card><strong>داده نمونه</strong><span>وضعیت مصرف طرح‌ها</span></Card>
      </div>
      <Card title="روند کلی تخصیص و توزیع طرح">
        <div className="org-chart" aria-label="نمودار نمونه روند تخصیص"><span style={{height:"42%"}}>دوره تیر</span><span style={{height:"65%"}}>دوره مرداد</span><span style={{height:"55%"}}>دوره نمونه ۱</span><span style={{height:"78%"}}>دوره نمونه ۲</span></div>
      </Card>
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
}: {
  screen: OrgScreenKey;
  profileState: OrganizationProfileState;
  programsState?: OrganizationProgramsState;
  programsQuery?: OrganizationProgramListQuery;
  programDetailState?: OrganizationProgramDetailState;
  recipientsState?: OrganizationRecipientsState;
  recipientsQuery?: OrganizationRecipientListQuery;
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
      />
    );
    case "add-people": return <AddPeople />;
    case "data-sources": return <DataSources />;
    case "allocation": return <Allocation />;
    case "allocation-detail": return <AllocationDetail />;
    case "usage": return <Usage />;
    case "reports": return <Reports />;
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
}: {
  screen: OrgScreenKey;
  profileState: OrganizationProfileState;
  programsState?: OrganizationProgramsState;
  programsQuery?: OrganizationProgramListQuery;
  programDetailState?: OrganizationProgramDetailState;
  recipientsState?: OrganizationRecipientsState;
  recipientsQuery?: OrganizationRecipientListQuery;
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
