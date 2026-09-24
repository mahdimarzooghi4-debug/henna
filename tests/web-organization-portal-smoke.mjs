import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = new URL("../apps/web-marketplace/components/organization-portal.tsx", import.meta.url);
const dynamicPage = new URL("../apps/web-marketplace/app/organization/[...section]/page.tsx", import.meta.url);
const css = new URL("../apps/web-marketplace/app/organization/organization.css", import.meta.url);

test("organization portal exposes all 15 Figma screen contracts", async () => {
  const source = await readFile(component, "utf8");
  for (const marker of [
    "داشبورد پرتال سازمانی",
    "اطلاعات و پروفایل سازمان",
    "مدیریت طرح‌ها و اعتبارها",
    "جزئیات طرح سازمانی",
    "ثبت طرح سازمانی جدید",
    "افراد و مشمولان",
    "ثبت و افزودن دستی مشمولان",
    "اتصال به سامانه مرجع اطلاعات سازمان",
    "مدیریت تخصیص اعتبار",
    "جزئیات تخصیص اعتبار",
    "وضعیت استفاده و عملکرد اعتبارات",
    "گزارش‌ها و تحلیل طرح‌ها",
    "اعلان‌های پرتال سازمانی",
    "پشتیبانی و راهنمای پرتال",
    "تنظیمات پورتال سازمانی",
  ]) assert.match(source, new RegExp(marker));
});

test("organization subroutes resolve through the shared portal shell", async () => {
  const source = await readFile(dynamicPage, "utf8");
  assert.match(source, /organizationRouteMap/);
  assert.match(source, /notFound/);
  const styles = await readFile(css, "utf8");
  assert.match(styles, /\.org-sidebar/);
  assert.match(styles, /@media\(max-width:760px\)/);
});
