import Link from "next/link";

const accountStatuses = [
  { label: "وضعیت حساب کاربری", value: "فعال", tone: "success" },
  { label: "وضعیت فروشندگی مرتبط", value: "فعال", tone: "neutral" },
  { label: "وضعیت حمایتی مرتبط", value: "شناسایی شده", tone: "sand" },
] as const;

export default function AdminUserDetail() {
  return <div className="admin-user-detail">
    <header className="admin-user-detail__title">
      <h1>شناسنامه و جزئیات حساب کاربر</h1>
      <p>اطلاعات هویتی، وضعیت‌های حساب و فعالیت‌های مرتبط کاربر نمونه</p>
    </header>

    <section className="admin-user-detail__profile" aria-label="مشخصات حساب">
      <div className="admin-user-detail__profile-info">
        <div>
          <h2>کاربر نمونه ۱</h2>
          <p>نوع حساب: شخص حقیقی</p>
        </div>
        <span className="admin-user-detail__avatar" aria-hidden="true">ک‌ن</span>
      </div>
    </section>

    <div className="admin-user-detail__columns">
      <div className="admin-user-detail__left">
        <section className="admin-user-detail__card" aria-labelledby="user-orders-heading">
          <h2 id="user-orders-heading">تاریخچه سفارش‌های کاربر (نمونه)</h2>
          <div className="admin-user-detail__order">
            <Link href="/admin/panel/orders">مشاهده سفارش</Link>
            <div className="admin-user-detail__order-info">
              <span className="admin-user-detail__badge admin-user-detail__badge--success">تکمیل شده</span>
              <span>سفارش نمونه HN-۲۰۹۰</span>
            </div>
          </div>
        </section>

        <section className="admin-user-detail__card" aria-labelledby="user-programs-heading">
          <h2 id="user-programs-heading">طرح‌ها و اعتبارهای مرتبط</h2>
          <div className="admin-user-detail__empty-plan">
            <strong>طرح یا اعتبار فعالی برای این حساب ثبت نشده است.</strong>
            <span>بدون طرح فعال</span>
          </div>
        </section>
      </div>

      <div className="admin-user-detail__right">
        <section className="admin-user-detail__card" aria-labelledby="user-identity-heading">
          <h2 id="user-identity-heading">اطلاعات پایه و هویتی</h2>
          <dl className="admin-user-detail__info-list">
            <div><dt>شماره همراه (ماسکه)</dt><dd dir="ltr">۰۹۱۲*******</dd></div>
            <div><dt>کد ملی (ماسکه)</dt><dd dir="ltr">********۶۷۸</dd></div>
            <div><dt>نوع حساب کاربری</dt><dd>شخص حقیقی</dd></div>
          </dl>
        </section>

        <section className="admin-user-detail__card" aria-labelledby="user-status-heading">
          <h2 id="user-status-heading">وضعیت‌های حساب و سامانه</h2>
          <dl className="admin-user-detail__status-list">
            {accountStatuses.map(status => <div key={status.label}>
              <dt>{status.label}</dt>
              <dd className={`admin-user-detail__badge admin-user-detail__badge--${status.tone}`}>{status.value}</dd>
            </div>)}
          </dl>
        </section>
      </div>
    </div>
  </div>;
}
