"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { parseBuyerCreditsPage, type BuyerCredit } from "../lib/buyer-credits";
import styles from "./figma-buyer-services.module.css";

type CreditState = "loading" | "ready" | "signin" | "unavailable";
const rial = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
const persianDate = (value: string) =>
  new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran" }).format(new Date(value));

export function BuyerCreditCards() {
  const [page, setPage] = useState(1);
  const [revision, retry] = useState(0);
  const [items, setItems] = useState<BuyerCredit[]>([]);
  const [state, setState] = useState<CreditState>("loading");
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setState("loading");
      try {
        const result = await fetch(`/api/buyer/credits?page=${page}`, {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (result.status === 401) { setState("signin"); return; }
        if (!result.ok) { setState("unavailable"); return; }
        const data = parseBuyerCreditsPage(await result.json() as unknown, page);
        if (controller.signal.aborted) return;
        if (!data) { setState("unavailable"); return; }
        setItems(previous => page === 1 ? data.items :
          [...previous, ...data.items.filter(item => !previous.some(p => p.id === item.id))]);
        setHasMore(data.items.length === data.pageSize);
        setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("unavailable");
      }
    })();
    return () => controller.abort();
  }, [page, revision]);

  const now = Date.now();
  return <div aria-live="polite" data-testid="buyer-credit-area">
    {state === "signin" ? <section className={styles.creditMessage}>
      برای مشاهده اعتبارهای خود ابتدا <Link href="/auth?returnTo=%2Fbenefits%3Fsection%3Dcredits">وارد حساب شوید</Link>.
    </section> : null}
    {state === "unavailable" ? <section className={styles.creditMessage} role="status">
      اطلاعات اعتبارهای حساب در دسترس نیست. این وضعیت به معنای نداشتن اعتبار نیست.
      <button type="button" className={styles.creditLoadMore}
        onClick={() => { setPage(1); retry(v => v + 1); }}>تلاش مجدد</button>
    </section> : null}
    {state === "loading" && items.length === 0 ? <p role="status">در حال دریافت اعتبارهای حساب…</p> : null}
    {state === "ready" && items.length === 0 ? <section className={styles.creditMessage}>اعتباری برای این حساب ثبت نشده است.</section> : null}
    {items.length > 0 && <div className={styles.creditCards} data-testid="buyer-credit-cards">
      {items.map(credit => {
        const expired = Date.parse(credit.expiresAtUtc) <= now;
        const status = expired ? "منقضی" : credit.availableRial === 0 ? "مصرف‌شده" : "قابل استفاده";
        return <article key={credit.id} className={styles.creditCard} data-testid="buyer-credit-card">
          <div className={styles.creditCardHead}>
            <div><h2>اعتبار حمایتی</h2><span className={styles.creditCardCode}>شناسه برنامه: {credit.programId.slice(0,8)}</span></div>
            <span className={expired ? styles.creditStatusExpired : styles.creditStatus}>{status}</span>
          </div>
          <div><span className={styles.creditAmount}>{rial(credit.availableRial)} <small>ریال</small></span><p>مانده ثبت‌شده</p></div>
          <dl className={styles.creditDetails}>
            <div><dt>اعتبار اولیه</dt><dd>{rial(credit.grantedRial)} ریال</dd></div>
            <div><dt>مصرف‌شده</dt><dd>{rial(credit.grantedRial-credit.availableRial)} ریال</dd></div>
            <div><dt>تاریخ انقضا</dt><dd>{persianDate(credit.expiresAtUtc)}</dd></div>
            <div><dt>دسته‌های مجاز</dt><dd>{rial(credit.categoryIds.length)} دسته</dd></div>
          </dl>
        </article>;
      })}
    </div>}
    {state === "loading" && items.length > 0 ? <p role="status">در حال دریافت کارت‌های بیشتر…</p> : null}
    {state === "ready" && hasMore && <button type="button" className={styles.creditLoadMore}
      onClick={() => setPage(v => v + 1)}>نمایش اعتبارهای بیشتر</button>}
  </div>;
}
