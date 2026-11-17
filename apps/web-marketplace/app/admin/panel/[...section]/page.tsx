import Image from "next/image";
import Link from "next/link";
import styles from "../admin-panel.module.css";
import AdminSidebar from "../admin-sidebar";
import AdminUsersListing from "../admin-users-listing";
import AdminOrganizationsListing from "../admin-organizations-listing";
import AdminOrganizationDetail from "../admin-organization-detail";
import AdminUserDetail from "../admin-user-detail";
import AdminSellersListing from "../admin-sellers-listing";
import AdminSellerDetail from "../admin-seller-detail";
import { adminGridTemplate, adminSections, findAdminSection, type AdminRow } from "../admin-pages";

type PageProps = { params: Promise<{ section: string[] }> };
const detailAliases: Record<string, string> = {
  "sample-account": "کاربر نمونه اول", "sample-business": "کاربر نمونه دوم", "sample-org": "سازمان نمونه یک", "second-org": "سازمان نمونه دو",
  "sample-seller": "فروشگاه نمونه حنا", "second-seller": "فروشگاه نمونه دوم", "sample-product": "روغن آفتابگردان نمونه", "second-product": "پنیر ایرانی نمونه",
  "HN-9021": "مشتری نمونه یک", "HN-9022": "مشتری نمونه دو", "sample-program": "طرح نمونه حمایت خرید", "sample-credit": "اعتبار خرید نمونه",
  "sample-report": "گزارش مشارکت نمونه", "second-report": "برنامه نمونه دوم", "mono": "مونو", "pickup": "تحویل حضوری", "TX-701": "تراکنش TX-۷۰۱", "TX-702": "تراکنش TX-۷۰۲",
  "TK-3001": "تیکت TK-۳۰۰۱", "TK-3002": "تیکت TK-۳۰۰۲", "sample-notice": "به‌روزرسانی بازارگاه", "order-notice": "اطلاع‌رسانی سفارش",
  "orders": "گزارش سفارش‌ها", "sellers": "گزارش فروشگاه‌ها", "home-banner": "بنر صفحه اصلی", "buying-guide": "راهنمای خرید", "admin-user": "مدیر نمونه", operator: "کارشناس نمونه",
  marketplace: "اطلاعات بازارگاه", notifications: "تنظیمات اعلان", dairy: "لبنیات", grocery: "روغن و خواربار", new: "دسته‌بندی جدید",
};
const orgTabs = [
  ["جزئیات سازمان", ""], ["طرح‌ها و اعتبارها", "/programs"], ["منابع داده", "/data-sources"], ["تخصیص و استفاده", "/allocation"],
] as const;
function findRow(section: string, pathname: string): AdminRow | undefined {
  const config = findAdminSection(section);
  return config?.rows.find(item => item.href === pathname);
}
function nice(value: string) { return detailAliases[value] ?? value.replaceAll("-", " "); }

export default async function AdminSectionPage({ params }: PageProps) {
  const { section: parts } = await params;
  const sectionSlug = parts[0] ?? "";
  const config = findAdminSection(sectionSlug);
  if (!config) return <main className={styles.shell} dir="rtl"><section className={styles.app}><header className={styles.top}><span>پنل مدیریت حنا</span></header><div className="admin-content"><div className="admin-page-heading"><h1>صفحه پیدا نشد</h1><p>مسیر در پنل مدیریت تعریف نشده است.</p></div><Link className="admin-back-link" href="/admin/panel">بازگشت به داشبورد</Link></div></section><AdminSidebar active="" /></main>;

  const detail = parts.length > 1;
  const pathname = `/admin/panel/${parts.join("/")}`;
  const row = detail ? findRow(sectionSlug, sectionSlug === "organizations" ? `/admin/panel/organizations/${parts[1]}` : pathname) : undefined;
  const itemName = row?.cells[sectionSlug === "users" ? 1 : 0] ?? detailAliases[parts[1] ?? ""] ?? nice(parts.slice(1).join(" "));
  const title = detail ? (sectionSlug === "products" ? "جزئیات کالا" : sectionSlug === "users" ? "شناسنامه و جزئیات حساب کاربر" : `جزئیات ${config.title.replace(/ها$/, "")}`) : config.title;
  const extraActions = config.actions ?? [];
  const hasRowActions = config.columns.at(-1) === "عملیات";
  return <main className={styles.shell} dir="rtl">
    <section className={styles.app}>
      <header className={styles.top}><div className={styles.user}><button className={styles.notification} aria-label="اعلان‌ها"><Image src="/admin-assets/list-imgNotifBtn.svg" alt="" width={36} height={36} /></button><span className={styles.divider} /><span className={styles.profile}><span className={styles.userInfo}><b>کاربر پنل</b><small>دسترسی مدیریت</small></span><span className={styles.avatar}>م</span></span></div></header>
      <div className="admin-content">
        {detail && sectionSlug === "organizations" && parts.length >= 2 ? <AdminOrganizationDetail slug={parts[1]} name={row?.cells[0] ?? itemName} status={row?.cells[3] ?? "فعال"} organizationType={row?.cells[1] ?? (parts[1] === "sample-org" ? "سازمان حمایتگر" : "سازمان معمولی")} activeTab={parts[2] ? `/${parts[2]}` : ""} /> : detail && sectionSlug === "users" && parts[1] === "sample-account" ? <AdminUserDetail /> : detail && sectionSlug === "sellers" ? <AdminSellerDetail name={itemName} slug={parts[1]} /> : <>
        <header className={detail ? "admin-detail-heading" : sectionSlug === "users" ? "admin-page-heading admin-page-heading--users" : "admin-page-heading"}>
          <div className="admin-detail-heading__copy"><h1>{title}</h1><p>{detail ? `${itemName} · اطلاعات نمونه برای نمایش ساختار پنل` : sectionSlug === "users" ? "نمایش و فیلتر حساب‌های کاربری حقیقی و حقوقی در سامانه حنا" : config.description}</p></div>
          {detail && <Link className="admin-back-link" href={`/admin/panel/${sectionSlug}`}>بازگشت به {config.title}</Link>}
        </header>
        {!detail && sectionSlug === "users" ? <AdminUsersListing /> : !detail && sectionSlug === "organizations" ? <AdminOrganizationsListing columns={config.columns} rows={config.rows} /> : !detail && sectionSlug === "sellers" ? <AdminSellersListing /> : !detail ? <>
          <div className="admin-filters" aria-label="فیلترهای صفحه"><button className="admin-filter admin-filter--active" type="button">همه</button><button className="admin-filter" type="button">فعال</button><button className="admin-filter" type="button">در انتظار بررسی</button><input className="admin-search" aria-label="جستجو" placeholder={`جستجو در ${config.title}...`} /></div>
          {extraActions.length > 0 && <div className="admin-page-actions">{extraActions.map(action => <Link className="admin-primary-button" href={action.href} key={action.href}>{action.label}</Link>)}</div>}
          <section className="admin-table-card"><div className="admin-table-scroll"><div className="admin-table admin-generic-table">
            <div className="admin-table__row admin-table__head" style={{ gridTemplateColumns: adminGridTemplate(sectionSlug, config.columns.length) }}>{config.columns.map(column => <span key={column}>{column}</span>)}</div>
            {config.rows.map((item, index) => <div className="admin-table__row" key={item.href} style={{ gridTemplateColumns: adminGridTemplate(sectionSlug, config.columns.length) }}>
              {item.cells.slice(0, hasRowActions ? -1 : undefined).map((cell, cellIndex) => <span className={cellIndex === 0 ? "admin-generic-table__primary" : ""} key={`${index}-${cellIndex}`}>
                {!hasRowActions && cellIndex === 0 ? <Link className="admin-row-link" href={item.href}>{cell}</Link> : cell}
              </span>)}
              {hasRowActions && <span><Link className="admin-row-link" href={item.href}>{item.cells.at(-1)}</Link></span>}
            </div>)}
          </div></div><p className="admin-sample-note">اطلاعات این صفحه نمونه‌ای است و به داده‌های واقعی سامانه متصل نیست.</p></section>
        </> : <>
          {sectionSlug === "organizations" && <nav className="admin-tabs" aria-label="بخش‌های سازمان">{orgTabs.map(([label, suffix]) => <Link className={parts.length === 2 ? (suffix === "" ? "admin-tab admin-tab--active" : "admin-tab") : pathname.endsWith(suffix) ? "admin-tab admin-tab--active" : "admin-tab"} href={`/admin/panel/organizations/${parts[1]}${suffix}`} key={suffix || "overview"}>{label}</Link>)}</nav>}
          <section className="admin-detail-grid">
            <article className="admin-detail-card"><h2>اطلاعات اصلی</h2><dl className="admin-detail-list">{(row?.cells.slice(0, -1) ?? [itemName, "دادهٔ نمونه", "ثبت نشده", "فعال"]).map((value, index) => <div className="admin-detail-field" key={index}><dt>{config.columns[index] ?? "وضعیت"}</dt><dd>{value}</dd></div>)}</dl></article>
            <article className="admin-detail-card"><h2>وضعیت و پیگیری</h2><p className="admin-no-documents">این بخش در نسخهٔ نمایشی با دادهٔ نمونه نمایش داده می‌شود. اتصال عملیات واقعی این صفحه در مرحلهٔ بعد انجام می‌شود.</p></article>
            {sectionSlug === "users" && <article className="admin-detail-card"><h2>سفارش‌های اخیر</h2><p className="admin-no-documents">سفارش‌های نمونهٔ این حساب</p><Link className="admin-row-link" href="/admin/panel/orders/HN-9021">مشاهده سفارش نمونه</Link></article>}
            {sectionSlug === "sellers" && <article className="admin-detail-card"><h2>کالاهای فروشگاه</h2><p className="admin-no-documents">فهرست نمونهٔ کالاهای ثبت‌شده</p><Link className="admin-row-link" href="/admin/panel/products/sample-product">مشاهده کالای نمونه</Link></article>}
            {sectionSlug === "programs" && <article className="admin-detail-card"><h2>اعتبارهای طرح</h2><p className="admin-no-documents">تخصیص اعتبار در این نمونه نمایشی است.</p><Link className="admin-row-link" href="/admin/panel/programs/credit-assignment">مشاهده تخصیص اعتبار</Link></article>}
          </section>
          <p className="admin-sample-note">مقادیر این صفحه برای نمایش چیدمان پنل نمونه‌سازی شده‌اند.</p>
        </>}
        </>}
      </div>
    </section>
    <AdminSidebar active={`/admin/panel/${sectionSlug}`} />
  </main>;
}
