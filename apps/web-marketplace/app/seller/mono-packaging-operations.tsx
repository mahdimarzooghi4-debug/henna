"use client";

import { useEffect, useState } from "react";
import {
  staffGet,
  staffIntent,
  staffPost,
  type StaffOffer,
  type StaffMonoPackagingProfile,
  type StaffIntent,
} from "../../lib/staff-commerce";

type Profile = StaffMonoPackagingProfile;

type Snapshot = { offers: StaffOffer[]; profiles: Profile[] };
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; value: Snapshot };

const loadClasses = ["S", "M", "L"] as const;

export function SellerMonoPackagingOperations() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [drafts, setDrafts] = useState<Record<string, {
    bagCount: string; loadClass: string;
  }>>({});
  const [intent, setIntent] = useState<StaffIntent | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh(signal?: AbortSignal) {
    setState({ kind: "loading" });
    try {
      const [offers, profiles] = await Promise.all([
        staffGet<StaffOffer[]>("seller", "offers?page=1", signal),
        staffGet<Profile[]>("seller", "mono-packaging-profiles?page=1", signal),
      ]);
      setState({ kind: "ready", value: { offers, profiles } });
      setDrafts(Object.fromEntries(offers.map(offer => {
        const profile = profiles.find(item => item.productId === offer.productId);
        return [offer.productId, {
          bagCount: profile ? String(profile.bagCount) : "",
          loadClass: profile?.loadClass ?? "",
        }];
      })));
    } catch {
      if (!signal?.aborted)
        setState({ kind: "error", message: "دریافت کالاها یا مشخصات بسته‌بندی تأیید نشد." });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, []);

  async function save(offer: StaffOffer) {
    if (state.kind !== "ready") return;
    const draft = drafts[offer.productId];
    const bagCount = Number(draft?.bagCount);
    if (!Number.isSafeInteger(bagCount) || bagCount < 1 ||
        !loadClasses.includes(draft?.loadClass as typeof loadClasses[number])) {
      setNotice("تعداد کیسه و ردهٔ بار را خودتان مشخص کنید.");
      return;
    }
    const existing = state.value.profiles.find(item =>
      item.productId === offer.productId);
    const input = {
      productId: offer.productId,
      shipmentModel: "BAG_BASED",
      bagCount,
      loadClass: draft.loadClass,
      expectedVersion: existing?.version ?? 0,
    };
    const next = staffIntent(intent, "mono-packaging-profiles", input);
    setIntent(next);
    setBusy(offer.productId);
    setNotice(null);
    try {
      await staffPost("seller", next);
      setIntent(null);
      setNotice("مشخصات بسته‌بندی ذخیره شد.");
      await refresh();
    } catch {
      setNotice("نتیجهٔ ذخیره قطعی نیست؛ برای تکرار امن، دوباره ذخیره را بزنید.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="seller-commerce__section"
      aria-labelledby="seller-mono-packaging-heading">
      <div className="seller-commerce__section-title">
        <div>
          <h2 id="seller-mono-packaging-heading">مشخصات بسته‌بندی برای ارسال</h2>
          <p>اطلاعات را برای هر کالا خودتان تعیین کنید؛ این بخش درخواست ارسال ثبت نمی‌کند.</p>
        </div>
      </div>
      {notice && <p className="form-status" role="status">{notice}</p>}
      {state.kind === "loading" && <p role="status">در حال دریافت کالاها…</p>}
      {state.kind === "error" && <p role="alert">{state.message}</p>}
      {state.kind === "ready" && state.value.offers.length === 0 &&
        <p className="seller-commerce__empty">برای ثبت مشخصات بسته‌بندی، ابتدا کالای فعال داشته باشید.</p>}
      {state.kind === "ready" && state.value.offers.map(offer => {
        const draft = drafts[offer.productId] ?? { bagCount: "", loadClass: "" };
        const profile = state.value.profiles.find(item =>
          item.productId === offer.productId);
        return (
          <article className="seller-commerce__card" key={offer.productId}>
            <div className="seller-commerce__card-head">
              <div>
                <strong>کالای ثبت‌شده در حنا</strong>
                <p dir="ltr">{offer.productId}</p>
              </div>
              <span className="seller-commerce__state">
                {profile ? "نسخهٔ " + profile.version : "ثبت نشده"}
              </span>
            </div>
            <div className="seller-mono-packaging__fields">
              <label>
                تعداد کیسه برای هر واحد کالا
                <input type="number" min="1" max="2147483647"
                  inputMode="numeric" value={draft.bagCount}
                  onChange={event => setDrafts(current => ({
                    ...current,
                    [offer.productId]: { ...draft, bagCount: event.target.value },
                  }))} />
              </label>
              <label>
                ردهٔ بار
                <select value={draft.loadClass}
                  onChange={event => setDrafts(current => ({
                    ...current,
                    [offer.productId]: { ...draft, loadClass: event.target.value },
                  }))}>
                  <option value="">انتخاب کنید</option>
                  <option value="S">کوچک</option>
                  <option value="M">متوسط</option>
                  <option value="L">بزرگ</option>
                </select>
              </label>
              <button type="button" className="primary-button"
                disabled={busy !== null}
                onClick={() => void save(offer)}>
                {busy === offer.productId ? "در حال ذخیره…" : "ذخیره مشخصات"}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
