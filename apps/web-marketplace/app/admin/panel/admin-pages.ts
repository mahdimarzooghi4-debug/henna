export type AdminRow = { cells: string[]; href: string };
export type AdminSection = { slug: string; title: string; description: string; columns: string[]; rows: AdminRow[]; actions?: { label: string; href: string }[] };

const row = (cells: string[], href: string): AdminRow => ({ cells, href });
// Figma column proportions, stored in the same right-to-left order as each page's columns.
const adminColumnWidths: Record<string, number[]> = {
  organizations: [258, 140, 150, 100, 120, 120, 120],
  products: [178, 160, 100, 130, 120, 110, 110, 100],
  categories: [308, 200, 140, 120, 120, 120],
  orders: [168, 150, 150, 120, 110, 110, 110, 90],
  programs: [418, 120, 100, 150, 120, 100],
  social: [288, 120, 120],
  logistics: [328, 110, 180, 110, 180, 100],
  settlements: [110, 110, 180, 130, 110, 220, 100],
  support: [100, 140, 110, 228, 120, 110, 100, 100],
  notifications: [338, 180, 140, 110, 140, 100],
  reports: [294, 150, 120],
  content: [568, 200, 120, 120],
  access: [468, 120, 150, 150, 120],
};

export function adminGridTemplate(slug: string, columnCount: number): string {
  const widths = adminColumnWidths[slug];
  const tracks = widths?.length === columnCount ? widths : Array.from({ length: columnCount }, () => 1);
  return tracks.map((width, index) => index === tracks.length - 1 ? `minmax(96px, ${width}fr)` : `minmax(0, ${width}fr)`).join(" ");
}

export const adminSections: AdminSection[] = [
  { slug: "users", title: "کاربران و حساب‌ها", description: "جست‌وجو و مشاهدهٔ وضعیت حساب‌های کاربران · دادهٔ نمونه", columns: ["شناسه حساب", "نام کاربر", "نوع حساب", "وضعیت احراز هویت", "وضعیت حساب", "عملیات"], rows: [row(["HN-U-۲۰۰۱", "کاربر نمونه اول", "شخص حقیقی", "تأیید شده", "فعال", "مشاهده شناسنامه"], "/admin/panel/users/sample-account"), row(["HN-U-۲۰۰۲", "کاربر نمونه دوم", "شخص حقوقی", "در انتظار بررسی", "فعال", "مشاهده شناسنامه"], "/admin/panel/users/sample-business")] },
  { slug: "organizations", title: "سازمان‌ها", description: "مدیریت سازمان‌های همکار و مشاهدهٔ وضعیت برنامه‌ها و تخصیص‌ها · دادهٔ نمونه", columns: ["سازمان", "نوع سازمان", "روش تخصیص", "وضعیت", "طرح‌های مرتبط", "وضعیت منبع داده", "عملیات"], rows: [row(["سازمان نمونه یک", "سازمان حمایتی", "الگوی تخصیص حنا", "فعال", "۲ برنامه", "دادهٔ نمونه", "مشاهده سازمان"], "/admin/panel/organizations/sample-org"), row(["سازمان نمونه دو", "سازمان مردمی", "مدل تخصیص نمونه", "در انتظار بررسی", "۱ برنامه", "در حال بررسی", "مشاهده سازمان"], "/admin/panel/organizations/second-org")] },
  { slug: "sellers", title: "فروشندگان", description: "مشاهدهٔ فروشگاه‌ها، کالاها و وضعیت فعالیت فروشندگان حنا · دادهٔ نمونه", columns: ["شناسه فروشنده", "نام فروشگاه", "دسته‌بندی", "وضعیت", "عملیات"], rows: [row(["HN-S-۱۰۱", "فروشگاه نمونه حنا", "کالاهای خوراکی", "فعال", "مشاهده فروشگاه"], "/admin/panel/sellers/sample-seller"), row(["HN-S-۱۰۲", "فروشگاه نمونه دوم", "کالای بهداشتی", "در انتظار بررسی", "مشاهده فروشگاه"], "/admin/panel/sellers/second-seller")] },
  { slug: "products", title: "کالاها", description: "مرور کالاهای ثبت‌شده و وضعیت انتشار آن‌ها · دادهٔ نمونه", columns: ["کالا", "فروشگاه", "نوع کالا", "دسته‌بندی", "قیمت ثبت‌شده", "وضعیت انتشار", "دسترس‌پذیری", "عملیات"], rows: [row(["روغن آفتابگردان نمونه", "فروشگاه نمونه حنا", "کالای خوراکی", "روغن و خواربار", "۱۴۲٬۰۰۰ تومان", "منتشرشده", "موجود", "جزئیات کالا"], "/admin/panel/products/sample-product"), row(["پنیر ایرانی نمونه", "فروشگاه نمونه دوم", "کالای خوراکی", "لبنیات", "۸۹٬۰۰۰ تومان", "در انتظار بررسی", "موجود", "جزئیات کالا"], "/admin/panel/products/second-product")] },
  { slug: "categories", title: "دسته‌بندی‌ها", description: "مدیریت ساختار دسته‌بندی کالاهای بازارگاه", columns: ["نام دسته‌بندی", "دسته‌بندی والد", "نوع", "وضعیت", "ترتیب", "عملیات"], rows: [row(["لبنیات", "خوراکی", "اصلی", "فعال", "۱", "مشاهده"], "/admin/panel/categories/dairy"), row(["روغن و خواربار", "خوراکی", "اصلی", "فعال", "۲", "مشاهده"], "/admin/panel/categories/grocery")], actions: [{ label: "افزودن دسته‌بندی", href: "/admin/panel/categories/new" }] },
  { slug: "orders", title: "سفارش‌ها", description: "پیگیری سفارش‌ها بر اساس وضعیت پرداخت، ارسال و فروشگاه · دادهٔ نمونه", columns: ["شماره سفارش", "خریدار", "فروشگاه", "مبلغ کل", "وضعیت سفارش", "وضعیت پرداخت", "وضعیت تحویل", "عملیات"], rows: [row(["HN-۹۰۲۱", "مشتری نمونه یک", "فروشگاه نمونه حنا", "۱۴۲٬۰۰۰ تومان", "جدید", "پرداخت‌شده", "در انتظار ارسال", "جزئیات سفارش"], "/admin/panel/orders/HN-9021"), row(["HN-۹۰۲۲", "مشتری نمونه دو", "فروشگاه نمونه دوم", "۶۴۰٬۰۰۰ تومان", "در حال آماده‌سازی", "پرداخت‌شده", "در حال آماده‌سازی", "جزئیات سفارش"], "/admin/panel/orders/HN-9022")] },
  { slug: "programs", title: "طرح‌ها و اعتبارها", description: "مشاهدهٔ طرح‌های بازارگاه و وضعیت اعتبارهای تخصیص‌یافته · ساختار نمونه", columns: ["نام طرح", "نوع طرح", "وضعیت", "دامنه مشمول", "بازه اعتبار", "عملیات"], rows: [row(["طرح نمونه حمایت خرید", "اعتبار خرید", "فعال", "خانوارهای نمونه", "۱۴۰۵/۰۱ تا ۱۴۰۵/۱۲", "جزئیات طرح"], "/admin/panel/programs/sample-program"), row(["اعتبار خرید نمونه", "طرح کالایی", "پیش‌نویس", "کاربران نمونه", "۱۴۰۵/۰۳ تا ۱۴۰۵/۰۹", "جزئیات طرح"], "/admin/panel/programs/sample-credit")] },
  { slug: "social", title: "مشارکت اجتماعی", description: "نمای کلی مشارکت‌های اجتماعی ثبت‌شده در حنا · ساختار نمونه", columns: ["عنوان طرح اجتماعی", "مشارکت‌ها", "وضعیت طرح"], rows: [row(["گزارش مشارکت نمونه", "۲۴ مشارکت نمونه", "در حال اجرا"], "/admin/panel/social/sample-report"), row(["برنامه نمونه دوم", "۸ مشارکت نمونه", "پیش‌نویس"], "/admin/panel/social/second-report")] },
  { slug: "logistics", title: "لجستیک", description: "وضعیت ارسال سفارش‌ها و اتصال شرکت‌های حمل‌ونقل؛ اتصال سرویس در این محیط فعال نشده است.", columns: ["سرویس ارسال", "وضعیت API", "عملیات حمل", "سفارش مرتبط", "آخرین وضعیت مونو", "عملیات"], rows: [row(["مونو", "در انتظار اتصال API", "ارسال با پیک", "HN-۹۰۲۱", "در انتظار پاسخ", "جزئیات"], "/admin/panel/logistics/mono"), row(["تحویل حضوری", "فعال", "تحویل در فروشگاه", "HN-۹۰۲۲", "تحویل حضوری", "جزئیات"], "/admin/panel/logistics/pickup")] },
  { slug: "settlements", title: "تسویه‌ها و تراکنش‌ها", description: "مرور تراکنش‌ها و وضعیت تسویه فروشگاه‌ها · دادهٔ نمونه", columns: ["شناسه تراکنش", "سفارش مرتبط", "فروشگاه", "مبلغ", "وضعیت تسویه", "اطلاعات مرتبط", "عملیات"], rows: [row(["TX-۷۰۱", "HN-۹۰۲۱", "فروشگاه نمونه حنا", "۱٬۴۲۰٬۰۰۰ تومان", "در انتظار بررسی", "تخصیص نمونه", "جزئیات"], "/admin/panel/settlements/TX-701"), row(["TX-۷۰۲", "HN-۹۰۲۲", "فروشگاه نمونه دوم", "۸۹۰٬۰۰۰ تومان", "تأیید شده", "تراکنش نمونه", "جزئیات"], "/admin/panel/settlements/TX-702")], actions: [{ label: "صف بررسی مرجع تخصیص سازمان", href: "/admin/organization-funding-instructions" }] },
  { slug: "support", title: "پشتیبانی", description: "پیگیری تیکت‌های پشتیبانی و وضعیت رسیدگی · دادهٔ نمونه", columns: ["شماره درخواست", "درخواست‌دهنده", "نوع حساب", "موضوع درخواست", "دسته", "وضعیت", "تاریخ", "عملیات"], rows: [row(["TK-۳۰۰۱", "کاربر نمونه اول", "شخص حقیقی", "پیگیری سفارش", "سفارش", "باز", "امروز", "مشاهده تیکت"], "/admin/panel/support/TK-3001"), row(["TK-۳۰۰۲", "فروشگاه نمونه", "فروشنده", "مشکل ثبت کالا", "کالا", "در حال بررسی", "دیروز", "مشاهده تیکت"], "/admin/panel/support/TK-3002")] },
  { slug: "notifications", title: "اعلان‌ها", description: "مرور اعلان‌های ارسال‌شده و وضعیت انتشار آن‌ها · دادهٔ نمونه", columns: ["عنوان اعلان", "مخاطبان هدف", "نوع اعلان", "وضعیت", "زمان ارسال / زمان‌بندی", "عملیات"], rows: [row(["به‌روزرسانی بازارگاه", "همه کاربران", "سامانه‌ای", "ارسال‌شده", "امروز · ۱۰:۳۰", "مشاهده"], "/admin/panel/notifications/sample-notice"), row(["اطلاع‌رسانی سفارش", "فروشندگان", "سفارشی", "پیش‌نویس", "فردا · ۱۵:۰۰", "مشاهده"], "/admin/panel/notifications/order-notice")] },
  { slug: "reports", title: "گزارش‌ها", description: "گزارش‌های مدیریتی بازارگاه · داده‌های نمایشی", columns: ["شاخص پایش (نمونه)", "بخش مرتبط", "وضعیت نمونه"], rows: [row(["تعداد سفارش‌های ثبت‌شده", "سفارش‌ها", "آماده"], "/admin/panel/reports/orders"), row(["تعداد فروشگاه‌های فعال", "فروشگاه‌ها", "آماده"], "/admin/panel/reports/sellers")] },
  { slug: "content", title: "محتوا", description: "مدیریت محتوای نمایشی بازارگاه · دادهٔ نمونه", columns: ["عنوان محتوا (نمونه)", "بخش سامانه", "وضعیت", "عملیات"], rows: [row(["بنر صفحه اصلی", "صفحه اول", "منتشرشده", "جزئیات"], "/admin/panel/content/home-banner"), row(["راهنمای خرید", "راهنمای کاربر", "پیش‌نویس", "جزئیات"], "/admin/panel/content/buying-guide")] },
  { slug: "access", title: "کاربران پنل و دسترسی‌ها", description: "مشاهدهٔ کاربران پنل و نقش‌های دسترسی · دادهٔ نمونه", columns: ["کاربر پنل (نمونه)", "وضعیت حساب", "دامنه دسترسی", "آخرین فعالیت", "عملیات"], rows: [row(["مدیر نمونه", "فعال", "مدیریت سامانه", "امروز · ۰۹:۴۰", "مشاهده دسترسی"], "/admin/panel/access/admin-user"), row(["کارشناس نمونه", "فعال", "سفارش‌ها", "دیروز · ۱۶:۱۰", "مشاهده دسترسی"], "/admin/panel/access/operator")] },
  { slug: "settings", title: "تنظیمات", description: "تنظیمات عمومی پنل مدیریت حنا", columns: ["بخش تنظیمات", "شرح", "آخرین تغییر", "وضعیت", "عملیات"], rows: [row(["اطلاعات بازارگاه", "نام و مشخصات پنل", "ثبت نشده", "فعال", "مشاهده"], "/admin/panel/settings/marketplace"), row(["تنظیمات اعلان", "ترجیحات اعلان سامانه", "ثبت نشده", "فعال", "مشاهده"], "/admin/panel/settings/notifications")] },
];

export function findAdminSection(slug: string) { return adminSections.find(section => section.slug === slug); }
