"use client";

import { useState, type FormEvent } from "react";
import { parsePreviewToman, previewDiscount } from "../../../../lib/seller-pricing-preview";
import styles from "./pricing.module.css";

type PricingRow = {
  id: string;
  name: string;
  category: string;
  priceToman: number;
  lastChange: string;
  discountedToman: number | null;
};
type Dialog = { id: string; kind: "price" | "discount" };

const sampleRows: PricingRow[] = [
  { id: "bread", name: "نان بربری سنتی سبوس‌دار", category: "نان و نانوایی", priceToman: 8500, lastChange: "۳ روز پیش", discountedToman: null },
  { id: "oil", name: "روغن آفتابگردان خالص لادن ۱.۵ لیتر", category: "روغن‌ها", priceToman: 98000, lastChange: "۱ هفته پیش", discountedToman: null },
  { id: "yogurt", name: "ماست سون کاله ۹۰۰ گرم", category: "لبنیات", priceToman: 88000, lastChange: "دیروز", discountedToman: null },
];
const formatToman = (amount: number) => new Intl.NumberFormat("fa-IR").format(amount) + " تومان";

export function DesignScreen() {
  const [rows, setRows] = useState<PricingRow[]>(sampleRows);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const current = dialog ? rows.find((row) => row.id === dialog.id) : null;

  function open(row: PricingRow, kind: Dialog["kind"]) {
    setDialog({ id: row.id, kind });
    setInput(String(kind === "price" ? row.priceToman : row.discountedToman ?? ""));
    setError("");
    setNotice("");
  }

  function cancel() {
    setDialog(null);
    setError("");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || !current) return;
    const amount = parsePreviewToman(input);
    if (amount === null) {
      setError("مبلغ باید عدد صحیح و مثبت به تومان باشد.");
      return;
    }

    if (dialog.kind === "discount") {
      const discount = previewDiscount(current.priceToman, amount);
      if (!discount) {
        setError("قیمت با تخفیف باید مثبت و کمتر از قیمت اصلی کالا باشد.");
        return;
      }
      setRows((previous) => previous.map((row) =>
        row.id === current.id ? {
          ...row, discountedToman: discount.finalToman, lastChange: "همین نشست (نمایشی)",
        } : row,
      ));
      setNotice("تخفیف برای پیش‌نمایش " + current.name + " اعمال شد؛ قیمت واقعی فروشگاه تغییر نکرده است.");
    } else {
      setRows((previous) => previous.map((row) =>
        row.id === current.id ? {
          ...row, priceToman: amount, discountedToman: null, lastChange: "همین نشست (نمایشی)",
        } : row,
      ));
      setNotice("قیمت نمایشی تغییر کرد و تخفیف نمایشی قبلی پاک شد؛ اطلاعاتی در سرور ذخیره نشده است.");
    }
    cancel();
  }

  function clearDiscount(row: PricingRow) {
    setRows((previous) => previous.map((item) =>
      item.id === row.id ? { ...item, discountedToman: null, lastChange: "همین نشست (نمایشی)" } : item,
    ));
    setNotice("تخفیف نمایشی " + row.name + " برداشته شد؛ قیمت اصلی واقعی تغییر نکرده است.");
  }

  return (
    <div className={styles.page} dir="rtl">
      <header className={styles.heading}>
        <div className={styles.title}>
          <h1>قیمت‌گذاری اقلام</h1>
          <p>قیمت کالاهای نمونه را بررسی کنید و تغییر قیمت یا تخفیف را پیش‌نمایش کنید.</p>
        </div>
        <span className={styles.currency}>واحد پول نمایشی: تومان</span>
      </header>

      <div className={styles.previewNotice} role="note">
        <strong>پیش‌نمایش طراحی</strong>
        <span>این جدول دادهٔ نمونه دارد. تغییر قیمت و تخفیف فقط در همین صفحه نمایش داده می‌شود و به کالا، سفارش یا سرور منتقل نمی‌شود.</span>
      </div>
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      <section className={styles.card} aria-label="فهرست قیمت و تخفیف اقلام">
        <div className={styles.scroll}>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.productCol} />
              <col className={styles.categoryCol} />
              <col className={styles.priceCol} />
              <col className={styles.changeCol} />
              <col className={styles.actionCol} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">کالا</th>
                <th scope="col">دسته‌بندی</th>
                <th scope="col">قیمت فعلی</th>
                <th scope="col">آخرین تغییر</th>
                <th scope="col" className={styles.actionHeader}>عملیات قیمت‌گذاری</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const discount = row.discountedToman === null ? null :
                  previewDiscount(row.priceToman, row.discountedToman);
                return (
                  <tr key={row.id}>
                    <th scope="row" className={styles.product}>{row.name}</th>
                    <td className={styles.category}>{row.category}</td>
                    <td>
                      <div className={styles.priceCell}>
                        {discount ? (
                          <>
                            <s className={styles.oldPrice}>{formatToman(row.priceToman)}</s>
                            <strong className={styles.discountedPrice}>{formatToman(discount.finalToman)}</strong>
                            <span className={styles.discountBadge}>تخفیف {formatToman(discount.savedToman)}</span>
                          </>
                        ) : <strong>{formatToman(row.priceToman)}</strong>}
                      </div>
                    </td>
                    <td className={styles.lastChange}>{row.lastChange}</td>
                    <td className={styles.actionCell}>
                      <div className={styles.actions}>
                        <button type="button" onClick={() => open(row, "price")}>ویرایش قیمت</button>
                        <button type="button" className={styles.discountButton} onClick={() => open(row, "discount")}>
                          {discount ? "ویرایش تخفیف" : "اعمال تخفیف"}
                        </button>
                        {discount && (
                          <button type="button" className={styles.removeDiscount}
                            onClick={() => clearDiscount(row)}>حذف تخفیف</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={styles.tableHint}>برای دیدن همه ستون‌ها در صفحه‌نمایش کوچک، جدول را به چپ و راست حرکت دهید.</p>
      </section>

      <div className={styles.footerNote}>
        <strong>تخفیف واقعی چگونه فعال می‌شود؟</strong>
        <p>ثبت قیمت اصلی و قیمت پس از تخفیف برای سفارش واقعی، به قرارداد مستقل تخفیف در Backend نیاز دارد. این صفحه فعلاً فقط روش کار را نشان می‌دهد.</p>
      </div>

      {dialog && current && (
        <div className={styles.overlay} onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
        }}>
          <form role="dialog" aria-modal="true" aria-labelledby="pricing-dialog-title"
            className={styles.dialog} onSubmit={save}>
            <div className={styles.dialogHeading}>
              <h2 id="pricing-dialog-title">{dialog.kind === "price" ? "ویرایش قیمت" : "اعمال تخفیف"}</h2>
              <button type="button" aria-label="بستن پنجره" onClick={cancel}>×</button>
            </div>
            <p className={styles.productName}>{current.name}</p>
            {dialog.kind === "discount" && (
              <p className={styles.basePrice}>قیمت اصلی: <strong>{formatToman(current.priceToman)}</strong></p>
            )}
            <label className={styles.amountLabel} htmlFor="seller-pricing-amount">
              {dialog.kind === "price" ? "قیمت جدید (تومان)" : "قیمت فروش با تخفیف (تومان)"}
            </label>
            <input id="seller-pricing-amount" autoFocus required inputMode="numeric" type="text"
              value={input} onChange={(event) => { setInput(event.target.value); setError(""); }}
              placeholder="مبلغ به تومان" dir="ltr" />
            {dialog.kind === "discount" && <p className={styles.helper}>مبلغ نهایی فروش را وارد کنید؛ باید کمتر از قیمت اصلی باشد.</p>}
            {dialog.kind === "discount" && (() => {
              const amount = parsePreviewToman(input);
              const discount = amount === null ? null : previewDiscount(current.priceToman, amount);
              return discount ? <p className={styles.savings}>
                میزان تخفیف: <strong>{formatToman(discount.savedToman)}</strong>
              </p> : null;
            })()}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <p className={styles.dialogWarning}>این تغییر فقط در پیش‌نمایش همین صفحه ثبت می‌شود.</p>
            <div className={styles.dialogButtons}>
              <button className={styles.submit} type="submit">
                {dialog.kind === "price" ? "ثبت قیمت نمایشی" : "نمایش تخفیف"}
              </button>
              <button type="button" onClick={cancel}>انصراف</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
