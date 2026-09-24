import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

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

function Dashboard() {
  return (
    <>
      <div className="org-banner">
        <strong>سازمان حمایتگر | روش تخصیص: الگوی حنا</strong>
        <span>تخصیص اعتبار بر اساس قواعد ثبت‌شده و الگوی تخصیص حنا انجام می‌شود.</span>
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

function Profile() {
  return (
    <div className="org-grid org-grid--2">
      <div className="org-stack">
        <Card title="اطلاعات تماس ثبت‌شده">
          <Pair label="تلفن ثابت سازمان" value="۰۲۱-۸۸******" />
          <Pair label="پست الکترونیکی رسمی" value="info@org-domain.ir" />
          <Pair label="نشانی فیزیکی ثبت‌شده" value="تهران، بلوار نلسون ماندلا، کوچه ***" />
        </Card>
        <Card title="اطلاعات نماینده سازمان">
          <Pair label="نام و نام خانوادگی نماینده" value="جناب آقای محمدی" />
          <Pair label="شماره شناسایی کاربری" value="کاربر ارشد پرتال" />
          <Pair label="شماره تماس نماینده" value="۰۹۱۲******۴" />
        </Card>
      </div>
      <Card title="شناسه و اطلاعات هویتی سازمان">
        <Pair label="عنوان سازمان" value="سازمان حمایتگر نمونه" />
        <Pair label="نوع سازمان" value="سازمان حمایتگر" />
        <Pair label="روش تخصیص پیش‌فرض" value="الگوی تخصیص حنا" />
        <Pair label="وضعیت حساب کاربری" value={<Badge>تایید شده و فعال</Badge>} />
      </Card>
    </div>
  );
}

function Programs() {
  const rows: ReactNode[][] = [
    ["مشاهده جزئیات", "تاریخ نمونه", <Badge key="a">فعال</Badge>, "الگوی حنا", "اعتبار نمونه", "طرح نمونه ۱"],
    ["مشاهده جزئیات", "تاریخ نمونه", <Badge key="b" tone="neutral">ثبت‌شده</Badge>, "الگوی حنا", "برنامه حمایتی نمونه", "طرح نمونه ۲"],
    ["مشاهده جزئیات", "تاریخ نمونه", <Badge key="c" tone="warn">پیش‌نویس</Badge>, "الگوی حنا", "اعتبار نمونه", "طرح نمونه ۳"],
  ];
  return (
    <>
      <div className="org-toolbar">
        <Link className="org-button org-button--primary" href="/organization/programs/new">ثبت طرح جدید</Link>
        <label>فیلتر وضعیت <select defaultValue="all"><option value="all">همه وضعیت‌ها</option><option>فعال</option><option>ثبت‌شده</option><option>پیش‌نویس</option><option>متوقف</option><option>پایان‌یافته</option></select></label>
      </div>
      <Card title="لیست طرح‌های سازمانی">
        <Table headers={["عملیات", "تاریخ ثبت", "وضعیت", "روش تخصیص", "نوع طرح", "نام طرح"]} rows={rows.map((r, i) => {
          const copy = [...r]; copy[0] = <Link key={i} href="/organization/programs/detail">مشاهده جزئیات</Link>; return copy;
        })} />
      </Card>
    </>
  );
}

function ProgramDetail() {
  return (
    <>
      <div className="org-toolbar"><Link className="org-button" href="/organization/programs">بازگشت به طرح‌ها</Link><div><Badge>فعال</Badge> <span className="org-code">شناسه طرح: PRG-***91</span></div></div>
      <div className="org-grid org-grid--2">
        <div className="org-stack">
          <Card title="دامنه افراد و مشمولان">
            <Pair label="منبع دریافت اطلاعات" value="API / منبع داده سازمان" />
            <Pair label="جامعه هدف تعریف شده" value="افراد ثبت‌شده در منبع داده سازمان" />
            <Pair label="تعداد تخصیص‌گیرندگان نهایی" value="جمعیت ثبت‌شده: داده نمونه" />
          </Card>
          <Card title="وضعیت تخصیص و استفاده">
            <Pair label="وضعیت کلی توزیع اعتبار" value="وضعیت استفاده مرتبط با طرح ثبت‌شده" />
            <Pair label="آخرین به‌روزرسانی ثبت‌شده" value="زمان نمونه" />
            <Pair label="وضعیت همگام‌سازی اطلاعات" value={<Badge>تکمیل‌شده</Badge>} />
          </Card>
        </div>
        <Card title="اطلاعات پایه طرح">
          <Pair label="نام کامل طرح سازمانی" value="طرح نمونه ۱" />
          <Pair label="سازمان ثبت‌کننده" value="سازمان حمایتگر" />
          <Pair label="روش تخصیص پیش‌فرض" value="الگوی تخصیص حنا" />
          <Pair label="وضعیت کنونی طرح" value={<Badge>فعال</Badge>} />
          <p className="org-note">تخصیص اعتبار بر اساس قواعد ثبت‌شده و الگوی تخصیص حنا انجام می‌شود. جزئیات قواعد داخلی تخصیص در این پنل نمایش داده نمی‌شود.</p>
        </Card>
      </div>
    </>
  );
}

function CreateProgram() {
  return (
    <Card className="org-form-card">
      <div className="org-form-head"><h2>فرم راه‌اندازی و پیکربندی طرح اعتباری</h2><p>مشخصات اولیه، الگوی تخصیص و دامنه افراد مشمول را مشخص نمایید.</p></div>
      <div className="org-form-grid">
        <label>نوع اعتبار / برنامه<select><option>انتخاب نوع اعتبار / برنامه</option><option>اعتبار نمونه</option></select></label>
        <label>نام طرح حمایتی<input placeholder="مثال: طرح نمونه ۱" /></label>
        <label>منبع افراد و مشمولان<select><option>انتخاب ورود دستی یا API / منبع داده سازمان</option></select></label>
        <label>روش تخصیص طرح<input value="روش تخصیص: الگوی حنا" readOnly /></label>
        <label className="org-span-2">توضیحات و اهداف طرح<textarea placeholder="شرح اهداف، نحوه استفاده و اطلاعات تکمیلی برای مشمولان طرح..." /></label>
      </div>
      <div className="org-actions"><Link className="org-button" href="/organization/programs">انصراف</Link><button className="org-button org-button--primary" type="button">ثبت اولیه طرح سازمانی</button></div>
    </Card>
  );
}

function People() {
  const rows: ReactNode[][] = [
    [<Link key="1" href="/organization/people/add">مشاهده</Link>, "استفاده شده", "تخصیص‌یافته", "طرح نمونه ۱", "API / منبع داده سازمان", <Badge key="a">حساب حنا شناسایی شده</Badge>, "فرد نمونه ۱ · شناسه: ۰۰۲****۳۲۱"],
    ["—", "در انتظار اعتبار", "تعریف نشده", "طرح نمونه ۲", "ورود دستی", <Badge key="b" tone="warn">نیازمند تطبیق</Badge>, "فرد نمونه ۲ · شناسه: ۱۲۸****۸۹۰"],
    ["—", "در انتظار بررسی", "تعریف نشده", "اعتبار نمونه", "ورود دستی", <Badge key="c" tone="neutral">در انتظار بررسی</Badge>, "فرد نمونه ۳ · شناسه: ۰۴۵****۴۵۶"],
  ];
  return (
    <>
      <div className="org-banner org-banner--muted">ثبت فرد در منبع داده سازمان به معنای تخصیص اعتبار نیست. در صورت وجود حساب حنا، اطلاعات فرد با همان حساب تطبیق داده می‌شود.</div>
      <div className="org-toolbar org-toolbar--filters">
        <Link className="org-button org-button--primary" href="/organization/people/add">افزودن مشمول</Link>
        <input aria-label="جستجوی مشمول" placeholder="نام، شناسه موردنیاز یا شناسه کاربری..." />
        <select aria-label="وضعیت تطبیق حنا"><option>وضعیت تطبیق حنا</option></select>
        <select aria-label="طرح مرتبط"><option>انتخاب طرح</option></select>
        <select aria-label="منبع ثبت"><option>همه منابع (API / دستی)</option></select>
      </div>
      <Card>
        <Table headers={["عملیات", "وضعیت مصرف", "وضعیت تخصیص", "طرح مرتبط", "منبع ثبت", "وضعیت تطبیق با حنا", "شخص / شناسه موردنیاز"]} rows={rows} />
      </Card>
    </>
  );
}

function AddPeople() {
  return (
    <>
      <div className="org-toolbar"><Link className="org-button" href="/organization/people">بازگشت به لیست مشمولان</Link></div>
      <div className="org-grid org-grid--2">
        <Card title="ثبت گروهی افراد (فایل اکسل / CSV)">
          <p className="org-muted">افزودن لیست مشمولان با بارگذاری گروهی قالب پیش‌فرض — نحوه برخورد با شناسه‌های تکراری، رکوردهای ناقص و ساختار نامعتبر نیازمند تعریف است</p>
          <label className="org-dropzone"><input type="file" accept=".csv,.xlsx" /><strong>فایل اکسل یا CSV را به اینجا بکشید یا انتخاب کنید</strong><span>قالب ستون‌ها: نام، شناسه موردنیاز، شماره همراه در صورت نیاز</span></label>
          <div className="org-actions"><button className="org-button" type="button">دانلود نمونه قالب فایل</button><button className="org-button org-button--primary" type="button">افزودن گروهی</button></div>
        </Card>
        <Card title="افزودن انفرادی مشمول جدید">
          <p className="org-muted">مشخصات هویتی و ارتباطی پایه فرد را ثبت نمایید</p>
          <div className="org-form-grid org-form-grid--single">
            <label>نام و عنوان نمایشی<input placeholder="مثال: محمد امینی" /></label>
            <label>شناسه موردنیاز<input placeholder="شناسه موردنیاز سازمان" /></label>
            <label>شماره تلفن همراه (جهت تطبیق حساب کاربری)<input placeholder="۰۹۱۲******" /></label>
            <label>انتخاب طرح حمایتی هدف<select><option>انتخاب طرح حمایتی فعال</option></select></label>
          </div>
          <div className="org-actions"><Link className="org-button" href="/organization/people">انصراف</Link><button className="org-button org-button--primary" type="button">افزودن فرد</button></div>
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

function Screen({ screen }: { screen: OrgScreenKey }) {
  switch (screen) {
    case "dashboard": return <Dashboard />;
    case "profile": return <Profile />;
    case "programs": return <Programs />;
    case "program-detail": return <ProgramDetail />;
    case "create-program": return <CreateProgram />;
    case "people": return <People />;
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

export function OrganizationPortal({ screen }: { screen: OrgScreenKey }) {
  const active = activeNav(screen);
  return (
    <main className="org-shell" dir="rtl">
      <section className="org-content">
        <header className="org-header">
          <div className="org-header__meta"><Badge tone="neutral">سازمان حمایتگر</Badge><span>↻ آخرین همگام‌سازی ثبت‌شده</span></div>
          <h1>{titles[screen]}</h1>
        </header>
        <div className="org-body"><Screen screen={screen} /></div>
      </section>
      <aside className="org-sidebar">
        <div className="org-brand"><Image src="/hana-logo.png" alt="حنا" width={82} height={38} /><strong>پنل سازمان‌ها</strong></div>
        <nav aria-label="ناوبری پرتال سازمانی">
          {nav.map(([key,label,href,icon]) => <Link key={key} href={href} className={active === key ? "is-active" : ""}><span>{label}</span><b aria-hidden>{icon}</b></Link>)}
        </nav>
        <div className="org-user"><div><strong>کد کاربری: ****۹۸۲</strong><small>کاربر ارشد پرتال</small></div><span>ن</span></div>
      </aside>
    </main>
  );
}
