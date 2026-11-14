import Link from "next/link";
import styles from "./admin-seller-detail.module.css";

type Props = { name: string; slug: string };

const products = [
  ["روغن آفتابگردان نمونه", "روغن و خواربار", "۱۴۲٬۰۰۰ تومان", "منتشرشده", "/admin/panel/products/sample-product"],
  ["پنیر ایرانی نمونه", "لبنیات", "۸۹٬۰۰۰ تومان", "منتشرشده", "/admin/panel/products/second-product"],
];

export default function AdminSellerDetail({ name, slug }: Props) {
  const second = slug === "second-seller";
  return <div className={styles.page} dir="rtl">
    <header className={styles.heading}>
      <div><h1>شناسنامه و پرونده فروشنده</h1><p>نمایش اطلاعات حساب، کالاها و محدوده فعالیت ثبت‌شده</p></div>
      <Link href="/admin/panel/sellers" className={styles.back}>بازگشت به فهرست</Link>
    </header>

    <section className={styles.profile} aria-label="پروفایل فروشگاه">
      <div className={styles.profileInfo}><span className={styles.avatar}>{second ? "م‌ف" : "ص‌ه"}</span><div><h2>{name}</h2><p>دسته‌بندی: {second ? "مواد غذایی" : "پوشاک و هنر سنتی"} · فروش کالا</p></div></div>
    </section>

    <div className={styles.grid}>
      <div className={styles.column}>
        <section className={styles.card}>
          <h2>کالاهای ثبت‌شده (نمونه)</h2>
          <div className={styles.stats}>
            <div><span>سفارش‌ها</span><strong>۱۲</strong></div>
            <div><span>کالاها</span><strong>۲</strong></div>
          </div>
          <div className={styles.productList}>{products.map(([product, category, price, status, href]) => <div className={styles.product} key={product}>
            <Link href={href}>{product}</Link><span>{category}</span><strong>{price}</strong><em>{status}</em>
          </div>)}</div>
        </section>
        <section className={styles.card}>
          <h2>اطلاعات تسویه</h2>
          <dl className={styles.rows}><div><dt>وضعیت تسویه</dt><dd>طبق شرایط قرارداد</dd></div><div><dt>حساب مقصد</dt><dd dir="ltr">IR**************۴۲</dd></div></dl>
        </section>
      </div>

      <div className={styles.column}>
        <section className={styles.card}>
          <h2>اطلاعات کسب‌وکار و صاحب حساب</h2>
          <dl className={styles.rows}>
            <div><dt>صاحب حساب</dt><dd>{second ? "مدیر فروشگاه" : "مسئول نمونه"}</dd></div>
            <div><dt>شناسه فروشنده</dt><dd>{second ? "HN-S-۱۰۲" : "HN-S-۱۰۱"}</dd></div>
            <div><dt>محدوده فعالیت</dt><dd>{second ? "محلی" : "کشوری"}</dd></div>
            <div><dt>اطلاعات تماس ثبت‌شده</dt><dd dir="ltr">۰۹۱۲-***-**۴۲ | in***@example.com</dd></div>
          </dl>
        </section>
        <section className={styles.card}>
          <h2>احراز هویت و وضعیت حساب</h2>
          <dl className={styles.rows}>
            <div><dt>وضعیت احراز هویت</dt><dd><span className={styles.approved}>تأیید شده</span></dd></div>
            <div><dt>وضعیت فروشندگی</dt><dd><span className={styles.approved}>فعال</span></dd></div>
            <div><dt>وضعیت حساب</dt><dd><span className={styles.approved}>فعال</span></dd></div>
          </dl>
        </section>
      </div>
    </div>
    <p className={styles.note}>اطلاعات این صفحه نمونه‌ای است و به داده‌های واقعی سامانه متصل نیست.</p>
  </div>;
}
