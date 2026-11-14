import Link from "next/link";

type Props = {
  slug: string;
  name: string;
  status: string;
  organizationType: string;
  activeTab?: string;
};

const tabs = [
  { label: "جزئیات سازمان", suffix: "" },
  { label: "طرح‌ها و اعتبارها", suffix: "/programs" },
  { label: "منابع داده", suffix: "/data-sources" },
  { label: "تخصیص و استفاده", suffix: "/allocation" },
] as const;

const programs = [
  { name: "طرح نمونه ۱", type: "اعتبار نمونه", status: "فعال", href: "/admin/panel/programs/sample-program" },
  { name: "طرح نمونه ۲", type: "برنامه نمونه", status: "پیش‌نویس", href: "/admin/panel/programs/sample-credit" },
] as const;

export default function AdminOrganizationDetail({ slug, name, status, organizationType, activeTab = "" }: Props) {
  const statusClass = status === "فعال" ? "admin-organization-detail__badge--active" : "admin-organization-detail__badge--review";
  const isProgramsTab = activeTab === "/programs";

  return <div className="admin-organization-detail">
    <header className="admin-organization-detail__heading">
      <Link className="admin-organization-detail__back" href="/admin/panel/organizations">بازگشت به لیست</Link>
      <div>
        <h1>{isProgramsTab ? "طرح‌ها و اعتبارهای سازمان" : "جزئیات سازمان"}</h1>
        <p>{isProgramsTab ? `مشاهده طرح‌های ثبت‌شده متعلق به ${name}` : "مشاهده پروفایل، اطلاعات تماس و ساختار تخصیص سازمان در سامانه حنا"}</p>
      </div>
    </header>

    <nav className="admin-organization-detail__tabs" aria-label="بخش‌های سازمان">
      {tabs.map((tab) => <Link
        aria-current={tab.suffix === activeTab ? "page" : undefined}
        className={tab.suffix === activeTab ? "admin-organization-detail__tab admin-organization-detail__tab--active" : "admin-organization-detail__tab"}
        href={`/admin/panel/organizations/${slug}${tab.suffix}`}
        key={tab.suffix || "details"}
      >{tab.label}</Link>)}
    </nav>

    {isProgramsTab ? <section className="admin-organization-detail__program-card" aria-label="طرح‌ها و اعتبارهای سازمان">
      <div className="admin-organization-detail__program-table-scroll">
        <div className="admin-organization-detail__program-table" role="table" aria-label="فهرست طرح‌ها و اعتبارها">
          <div className="admin-organization-detail__program-row admin-organization-detail__program-row--head" role="row">
            <span role="columnheader">عملیات</span>
            <span role="columnheader">تاریخ ثبت</span>
            <span role="columnheader">وضعیت</span>
            <span role="columnheader">روش تخصیص</span>
            <span role="columnheader">نوع طرح</span>
            <span role="columnheader">نام طرح</span>
          </div>
          {programs.map((program) => <div className="admin-organization-detail__program-row" role="row" key={program.name}>
            <span className="admin-organization-detail__program-action" role="cell"><Link href={program.href}>{program.status === "فعال" ? "مشاهده جزئیات" : "بررسی"}</Link></span>
            <span role="cell">تاریخ نمونه</span>
            <span role="cell"><span className={`admin-organization-detail__program-badge ${program.status === "فعال" ? "admin-organization-detail__program-badge--active" : "admin-organization-detail__program-badge--draft"}`}>{program.status}</span></span>
            <span role="cell">الگوی تخصیص حنا</span>
            <span role="cell">{program.type}</span>
            <strong role="cell">{program.name}</strong>
          </div>)}
        </div>
      </div>
    </section> : <section className="admin-organization-detail__grid">
      <div className="admin-organization-detail__main">
        <article className="admin-organization-detail__card">
          <h2>اطلاعات سازمان</h2>
          <dl className="admin-organization-detail__info">
            <div><dt>نام سازمان</dt><dd>{name}</dd></div>
            <div><dt>نوع سازمان</dt><dd>{organizationType}</dd></div>
            <div><dt>وضعیت حساب</dt><dd><span className={`admin-organization-detail__badge ${statusClass}`}>{status}</span></dd></div>
            <div><dt>اطلاعات تماس ثبت‌شده</dt><dd dir="ltr">۰۲۱-۸۸****** | in***@example.com</dd></div>
            <div><dt>نماینده ثبت‌شده</dt><dd>نماینده نمونه</dd></div>
          </dl>
        </article>

        <article className="admin-organization-detail__card admin-organization-detail__allocation">
          <h2>مدل تخصیص اعتبار</h2>
          <div><span>روش تخصیص ثبت‌شده</span><strong>روش تخصیص: الگوی تخصیص حنا</strong></div>
          <p>جزئیات قواعد داخلی تخصیص در این پنل نمایش داده نمی‌شود.</p>
        </article>
      </div>

      <aside className="admin-organization-detail__side">
        <article className="admin-organization-detail__card admin-organization-detail__portal">
          <h2>وضعیت پورتال</h2>
          <div><span>وضعیت پورتال</span><span className={`admin-organization-detail__badge ${statusClass}`}>{status}</span></div>
        </article>

        <article className="admin-organization-detail__card admin-organization-detail__activity">
          <h2>خلاصه فعالیت</h2>
          {[
            ["طرح‌ها و اعتبارها", "داده نمونه", "طرح‌های مرتبط"],
            ["منبع افراد", "داده نمونه", "وضعیت منبع افراد"],
            ["وضعیت تخصیص", "داده نمونه", "وضعیت تخصیص"],
            ["وضعیت استفاده", "داده نمونه", "داده نمونه"],
          ].map(([title, value, note]) => <div className="admin-organization-detail__activity-item" key={title}>
            <strong>{title}</strong>
            <span>{value}</span>
            <small>{note}</small>
          </div>)}
        </article>
      </aside>
    </section>}
  </div>;
}
