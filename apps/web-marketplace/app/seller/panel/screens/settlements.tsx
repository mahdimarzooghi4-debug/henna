"use client";

import {
  demoSettlementRows,
  demoSettlementStatusLabels,
  demoSettlementSummary,
  formatDemoToman,
} from "../../../../lib/seller-settlements-preview";
import styles from "./settlements.module.css";

function exportDemoCsv() {
  // Only hard-coded preview rows. No API request, banking data or remote export.
  const columns = ["شناسه نمونه", "تاریخ ثبت", "مبلغ (تومان)", "اطلاعات مرتبط", "وضعیت تسویه"];
  const rows = demoSettlementRows.map((row) => [
    row.id, row.date, String(row.amountToman), row.related, demoSettlementStatusLabels[row.status],
  ]);
  const csv = [columns, ...rows].map((cells) =>
    cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
  ).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "henna-settlements-demo.csv";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DesignScreen() {
  return (
    <div className={styles.page} dir="rtl" data-node-id="261:918">
      <header className={styles.header}>
        <div className={styles.headings}>
          <h1>تسویه‌حساب‌ها</h1>
          <p>وضعیت مبالغ تسویه‌شده، در انتظار و قابل تسویه — داده‌های نمونه نمایشی</p>
        </div>
        <button className={styles.export} type="button" onClick={exportDemoCsv}>
          خروجی CSV نمونه (اکسل)
        </button>
      </header>

      <p role="note" className={styles.previewNotice}>
        <strong>پیش‌نمایش طراحی: </strong>
        همه مبالغ، وضعیت‌ها و شناسه‌های این صفحه ساختگی هستند؛ نه پرداختی انجام شده،
        نه تسویه بانکی ثبت شده و نه اطلاعاتی از سرور دریافت یا در آن ذخیره می‌شود.
      </p>

      <section className={styles.metrics} aria-label="خلاصه نمونه تسویه">
        <article className={styles.metric}>
          <span>تسویه‌شده</span>
          <strong className={styles.settledTotal}>{formatDemoToman(demoSettlementSummary.settledToman)}</strong>
          <small>مجموع ردیف‌های تسویه‌شده در نمونه</small>
        </article>
        <article className={styles.metric}>
          <span>در انتظار تسویه</span>
          <strong className={styles.pendingTotal}>{formatDemoToman(demoSettlementSummary.pendingToman)}</strong>
          <small>مجموع ردیف‌های در انتظار در نمونه</small>
        </article>
        <article className={styles.metric}>
          <span>سفارش‌های قابل تسویه</span>
          <strong>{new Intl.NumberFormat("fa-IR").format(demoSettlementSummary.eligibleOrders)} سفارش</strong>
          <small>تعداد سفارش‌های گروه نمونه؛ بدون تعیین شرایط قرارداد</small>
        </article>
      </section>

      <section className={styles.card} aria-labelledby="settlements-list-title">
        <h2 id="settlements-list-title">تراکنش‌ها و اطلاعات تسویه</h2>
        <div className={styles.scroll}>
          <table className={styles.table} aria-label="تراکنش‌های نمونه تسویه">
            <colgroup>
              <col className={styles.idCol} />
              <col className={styles.dateCol} />
              <col className={styles.amountCol} />
              <col className={styles.relatedCol} />
              <col className={styles.statusCol} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">اطلاعات تسویه</th>
                <th scope="col">تاریخ ثبت</th>
                <th scope="col">مبلغ</th>
                <th scope="col">اطلاعات مرتبط</th>
                <th scope="col" className={styles.statusHeader}>وضعیت تسویه</th>
              </tr>
            </thead>
            <tbody>
              {demoSettlementRows.map((row) => (
                <tr key={row.id} data-demo-settlement-id={row.id}>
                  <th scope="row" className={styles.rowId}>{row.id} <small>نمونه</small></th>
                  <td>{row.date}</td>
                  <td className={styles.amount}>{formatDemoToman(row.amountToman)}</td>
                  <td>{row.related}</td>
                  <td className={styles.statusCell} data-settlement-status={row.status}>
                    <span className={`${styles.badge} ${styles[row.status.toLowerCase()]}`}>
                      {demoSettlementStatusLabels[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.hint}>
          در نمایشگرهای کوچک، جدول به‌صورت افقی حرکت می‌کند. خروجی CSV نیز فقط شامل همین اطلاعات نمونه است.
        </p>
      </section>
    </div>
  );
}
