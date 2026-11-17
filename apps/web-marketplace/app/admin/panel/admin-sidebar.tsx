import Image from "next/image";
import Link from "next/link";
import styles from "./admin-panel.module.css";

const menu = [
  ["نمای کلی", [["داشبورد", "/admin/panel", "list-imgFrame.svg"]]],
  ["بازارگاه", [
    ["کاربران و حساب‌ها", "/admin/panel/users", "list-imgUsersIcon.svg"],
    ["سازمان‌ها", "/admin/panel/organizations", "dashboard-imgUsers2.svg"],
    ["فروشندگان", "/admin/panel/sellers", "list-imgStoreIcon.svg"],
    ["درخواست‌های ثبت‌نام فروشنده", "/admin/seller-applications", "list-imgClipboardIcon.svg"],
    ["کالاها", "/admin/panel/products", "list-imgFrame1.svg"],
    ["دسته‌بندی‌ها", "/admin/panel/categories", "list-imgFolderIcon.svg"],
    ["سفارش‌ها", "/admin/panel/orders", "list-imgFrame2.svg"],
  ]],
  ["عملیات و طرح‌ها", [
    ["طرح‌ها و اعتبارها", "/admin/panel/programs", "list-imgFrame3.svg"],
    ["مشارکت اجتماعی", "/admin/panel/social", "list-imgMessageIcon.svg"],
    ["لجستیک", "/admin/panel/logistics", "list-imgFrame4.svg"],
    ["تسویه‌ها و تراکنش‌ها", "/admin/panel/settlements", "list-imgFrame5.svg"],
    ["پشتیبانی", "/admin/panel/support", "list-imgHelpIcon.svg"],
    ["اعلان‌ها", "/admin/panel/notifications", "list-imgFrame6.svg"],
  ]],
  ["مدیریت سامانه", [
    ["گزارش‌ها", "/admin/panel/reports", "list-imgFrame7.svg"],
    ["محتوا", "/admin/panel/content", "list-imgFileIcon.svg"],
    ["کاربران پنل و دسترسی‌ها", "/admin/panel/access", "list-imgShieldIcon.svg"],
    ["تنظیمات", "/admin/panel/settings", "list-imgSettingsIcon.svg"],
  ]],
] as const;

export default function AdminSidebar({ active }: { active: string }) {
  return <aside className={styles.sidebar}>
    <div className={styles.sideBrand}>
      <span className={styles.logo}><Image src="/admin-assets/henna-admin-logo.png" alt="" width={82} height={48} priority /></span>
      <span><b>مدیریت حنا</b><small>پنل مدیریت بازارگاه</small></span>
    </div>
    <nav aria-label="ناوبری پنل مدیریت">
      {menu.map(([group, items]) => <section key={group}>
        <h2>{group}</h2>
        {items.map(([label, href, icon]) => {
          const isActive = href === "/admin/panel"
            ? active === href
            : active === href || active.startsWith(`${href}/`)
              || (active.startsWith("/admin/organization-funding-instructions") && href === "/admin/panel/settlements");
          const size = icon === "list-imgFrame.svg" ? 18 : icon === "dashboard-imgUsers2.svg" ? 18 : 16;
          return <Link aria-current={isActive ? "page" : undefined} className={isActive ? styles.active : ""} href={href} key={href}>
            <span className="admin-sidebar__icon"><Image src={`/admin-assets/${icon}`} alt="" width={size} height={size} /></span>
            {label}
          </Link>;
        })}
      </section>)}
    </nav>
  </aside>;
}
