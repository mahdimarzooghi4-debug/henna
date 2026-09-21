"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { FormField } from "../../../components/form-field";
import {
  hasUnsavedSellerEdits, isLeavingSellerPage, validateSellerDraft,
  type SellerFieldErrors,
} from "../../../lib/seller-edit-safety";
import {
  emptySellerFields, loadSellerDraft, sellerFieldKeys,
  type SellerFields,
} from "../../../lib/seller-draft-preflight";
import { sellerLoginHref } from "../../../lib/seller-return";
import {
  chooseSellerDraftCopy, sellerFieldDifferences,
} from "../../../lib/seller-conflict";
import {
  combineSellerDraftFields, suggestSellerFieldChoices,
  unresolvedSellerFieldChoices, type SellerFieldChoice,
  type SellerFieldChoices,
} from "../../../lib/seller-field-merge";


type SellerConflict =
  | { status: "loading" | "unavailable" }
  | {
    status: "ready";
    fields: SellerFields;
    revision: number;
    choices: SellerFieldChoices;
  };

export function RegistrationForm() {
  const [fields, setFields] = useState<SellerFields>(emptySellerFields);
  // Last CONFIRMED server values, not the current text in this tab.
  // Needed to distinguish independent field edits from overlapping ones.
  const [baseline, setBaseline] = useState<SellerFields>(emptySellerFields);
  const [fieldErrors, setFieldErrors] = useState<SellerFieldErrors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  const [conflict, setConflict] = useState<SellerConflict | null>(null);
  const conflictHeading = useRef<HTMLHeadingElement>(null);
  const preflightAbort = useRef<AbortController | null>(null);
  const [access, setAccess] = useState<"checking" | "signedIn" | "signedOut" | "unavailable">("checking");


  function checkInitialDraft() {
    // Only a 404 from a live, authenticated server permits revision zero.
    // Retry this GET in place; page reload is not needed for an outage.
    preflightAbort.current?.abort();
    const controller = new AbortController();
    preflightAbort.current = controller;
    setAccess("checking");
    void loadSellerDraft(fetch, controller.signal).then((result) => {
      if (controller.signal.aborted ||
        preflightAbort.current !== controller) return;
      if (result.status === "signedOut") {
        setAccess("signedOut");
        return;
      }
      if (result.status === "unavailable") {
        setAccess("unavailable");
        return;
      }
      if (result.status === "new") {
        setRevision(0);
        setBaseline(emptySellerFields);
        setAccess("signedIn");
        return;
      }
      // A complete draft and its actual revision arrive together before
      // any field can become editable.
      setFields(result.fields);
      setBaseline(result.fields);
      setSaved(true);
      setRevision(result.revision);
      setMessage("پیش‌نویس اطلاعات اولیه شما بازیابی شد؛ می‌توانید آن را ویرایش کنید.");
      setAccess("signedIn");
    });
  }

  useEffect(() => {
    checkInitialDraft();
    return () => preflightAbort.current?.abort();
  }, []);

  useEffect(() => {
    if (conflict?.status === "ready") conflictHeading.current?.focus();
  }, [conflict?.status]);

  const hasUnsavedChanges = hasUnsavedSellerEdits(fields, baseline);
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Browsers choose their own generic text for refresh/close warning.
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement) ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self") ||
        !isLeavingSellerPage(link.href, window.location.href)) return;
      // External/full navigations have the native beforeunload warning;
      // this confirmation is for Next's same-origin client-side links.
      if (new URL(link.href, window.location.href).origin !==
        window.location.origin) return;

      if (!window.confirm(
        "تغییرات فرم فروشگاه هنوز ذخیره نشده‌اند. با ترک صفحه ممکن است از دست بروند. ادامه می‌دهید؟",
      )) {
        event.preventDefault();
        // Stop Next's delegated client navigation after cancellation.
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onLink, true);
    };
  }, [hasUnsavedChanges]);

  function update(field: keyof SellerFields, value: string) {
    if (access !== "signedIn" || busy || conflict) return;
    setSaved(false);
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const changed = { ...current };
      delete changed[field];
      return changed;
    });
    setMessage("");
  }

  async function retrieveCurrentDraft(local: SellerFields = fields) {
    // A 409 is NEVER permission to resubmit at an assumed revision 0.
    // Recheck the authenticated server draft without discarding local edits.
    setConflict({ status: "loading" });
    const current = await loadSellerDraft(fetch);
    if (current.status === "signedOut") {
      setAccess("signedOut");
      setConflict(null);
      setMessage("نشست شما پایان یافته است. اطلاعات این فرم ذخیره نشد؛ پیش از رفتن به ورود، متن واردشده را نگه دارید.");
    } else if (current.status === "restored") {
      setConflict({
        status: "ready", fields: current.fields,
        revision: current.revision,
        choices: suggestSellerFieldChoices(
          baseline, local, current.fields,
        ),
      });
      setMessage("این پیش‌نویس جای دیگری تغییر کرده است. دو نسخه را مقایسه کنید و صریحاً انتخاب کنید؛ اطلاعات این پنجره پاک نشده است.");
    } else {
      // A 404 after 409 could mean the draft was removed. Never overwrite
      // using revision zero or claim the server copy is safely available.
      setConflict({ status: "unavailable" });
      setMessage("پس از تعارض، نسخهٔ فعلی پیش‌نویس تأیید نشد؛ اطلاعات این پنجره حفظ شده اما ذخیرهٔ مجدد تا بازیابی نسخهٔ سرور قفل است.");
    }
  }

  async function retryConflict() {
    if (busy || access !== "signedIn" ||
      conflict?.status !== "unavailable") return;
    setBusy(true);
    try {
      await retrieveCurrentDraft();
    } finally {
      setBusy(false);
    }
  }

  function chooseServerCopy() {
    if (busy || conflict?.status !== "ready") return;
    // Only an explicit click can discard this tab's unsaved text.
    const selected = chooseSellerDraftCopy(fields, conflict, "server");
    setFields(selected.fields);
    setBaseline(conflict.fields);
    setRevision(selected.revision);
    setSaved(selected.saved);
    setFieldErrors({});
    setConflict(null);
    setMessage("آخرین نسخهٔ ذخیره‌شدهٔ سرور بارگذاری شد؛ تغییرات ذخیره‌نشدهٔ این پنجره کنار گذاشته شدند.");
  }

  function chooseMyCopy() {
    if (busy || conflict?.status !== "ready") return;
    // Keep this tab's exact fields, update ONLY the expected revision.
    // Never automatically save over another tab's newer draft.
    const selected = chooseSellerDraftCopy(fields, conflict, "mine");
    setFields(selected.fields);
    setBaseline(conflict.fields);
    setRevision(selected.revision);
    setSaved(selected.saved);
    setFieldErrors({});
    setConflict(null);
    setMessage("متن این پنجره نگه داشته شد. هنوز ذخیره نشده است؛ آن را بررسی کنید و برای ذخیرهٔ صریح دکمهٔ فرم را بزنید.");
  }

  function selectConflictField(
    key: keyof SellerFields, choice: Exclude<SellerFieldChoice, null>,
  ) {
    if (busy || access !== "signedIn") return;
    setConflict((current) => current?.status === "ready"
      ? {
        ...current,
        choices: { ...current.choices, [key]: choice },
      }
      : current);
  }

  function chooseCombinedCopy() {
    if (busy || access !== "signedIn" ||
      conflict?.status !== "ready") return;
    // A genuine overlapping edit MUST be resolved; no implicit winner.
    const result = combineSellerDraftFields(
      fields, conflict, conflict.choices,
    );
    if (!result) return;
    setFields(result.fields);
    setBaseline(conflict.fields);
    setRevision(result.revision);
    setSaved(result.saved);
    setFieldErrors({});
    setConflict(null);
    setMessage(result.saved
      ? "ترکیب انتخابی با نسخهٔ ذخیره‌شده برابر است؛ نیازی به ذخیرهٔ دوباره نیست."
      : "ترکیب انتخابی در فرم قرار گرفت، اما هنوز ذخیره نشده است. هر شش فیلد را بررسی کنید و دکمهٔ ذخیرهٔ اصلی را بزنید.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || access !== "signedIn" || conflict) return;
    const validation = validateSellerDraft(fields);
    const next = validation.values;
    setFields(next);
    if (validation.firstInvalid) {
      setFieldErrors(validation.errors);
      setMessage("لطفاً فیلدهای مشخص‌شده را اصلاح کنید؛ اطلاعات ذخیره نشد.");
      const firstInputId: Record<keyof SellerFields, string> = {
        storeName: "store-name",
        ownerName: "owner-name",
        phone: "seller-phone",
        city: "city",
        address: "store-address",
        postalCode: "postal-code",
      };
      document.getElementById(firstInputId[validation.firstInvalid])?.focus();
      return;
    }
    setFieldErrors({});
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/seller/registration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...next, revision }),
        cache: "no-store",
      });
      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "DRAFT" &&
          "revision" in result && typeof result.revision === "number" &&
          result.revision === revision + 1) {
          setSaved(true);
          setBaseline(next);
          setRevision(result.revision);
          setAccess("signedIn");
          setMessage("اطلاعات اولیه به‌عنوان پیش‌نویس ذخیره شد. ثبت‌نام و فعال‌سازی فروشگاه هنوز تکمیل نشده است.");
          return;
        }
      }
      setSaved(false);
      if (response.status === 409) {
        await retrieveCurrentDraft(next);
        return;
      }
      if (response.status === 401) setAccess("signedOut");
      setMessage(response.status === 401
        ? "نشست شما پایان یافته است. اطلاعات این فرم ذخیره نشد؛ پیش از رفتن به ورود، متن واردشده را نگه دارید."
        : response.status === 400
          ? "اطلاعات یا شماره مسئول فروشگاه معتبر نیست. شماره باید همان شماره تأییدشده حساب باشد."
          : "ذخیره اطلاعات تأیید نشد؛ لطفاً دوباره تلاش کنید.");
    } catch {
      setSaved(false);
      setMessage("ذخیره اطلاعات تأیید نشد؛ لطفاً دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  const readyConflict = conflict?.status === "ready" ? conflict : null;
  const differences = readyConflict
    ? sellerFieldDifferences(fields, readyConflict.fields)
    : [];
  const unresolved = readyConflict
    ? unresolvedSellerFieldChoices(
      fields, readyConflict.fields, readyConflict.choices,
    )
    : 0;

  return (
    <section className="surface-card seller-card" aria-labelledby="seller-form-heading">
      <h2 id="seller-form-heading">اطلاعات اولیه فروشگاه</h2>
      {hasUnsavedChanges && (
        <p className="seller-unsaved-note" role="status">
          تغییرات این فرم هنوز در سرور ذخیره نشده‌اند. پیش از بستن یا
          ترک صفحه، پس از رفع خطا یا تعارض، اطلاعات را ثبت کنید.
        </p>
      )}
      {access === "checking" && (
        <p className="form-status" role="status">در حال بررسی وضعیت حساب و پیش‌نویس…</p>
      )}
      {access === "signedOut" && (
        <p className="form-status" role="status">
          برای ذخیره پیش‌نویس ابتدا <Link href={sellerLoginHref}>وارد حساب حنا شوید</Link>.
          پس از ورود به همین فرم برمی‌گردید. اگر متنی را پیش از پایان نشست وارد کرده‌اید، قبل از ترک صفحه آن را کپی کنید؛ ذخیره نشده است.
        </p>
      )}
      {access === "unavailable" && (
        <p className="form-status form-status--error" role="status">
          وضعیت پیش‌نویس فعلاً قابل بررسی نیست. برای جلوگیری از بازنویسی نسخه موجود، فرم تا بررسی موفق غیرفعال است. <button type="button" className="auth-card__secondary"
            onClick={checkInitialDraft}>بررسی دوباره بدون ترک فرم</button>
        </p>
      )}
      <form noValidate onSubmit={handleSubmit}>
        <div className="seller-fields">
          <FormField id="store-name" label="نام فروشگاه" placeholder="مثلاً سوپرمارکت بهار"
            maxLength={120} value={fields.storeName} error={Boolean(fieldErrors.storeName)} errorMessage={fieldErrors.storeName} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("storeName", e.target.value)} />
          <FormField id="owner-name" label="نام و نام خانوادگی مسئول" placeholder="نام مسئول فروشگاه"
            maxLength={120} autoComplete="name" value={fields.ownerName} error={Boolean(fieldErrors.ownerName)} errorMessage={fieldErrors.ownerName} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("ownerName", e.target.value)} />
          <FormField id="seller-phone" label="شماره موبایل" placeholder="09xxxxxxxxx"
            type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11}
            className="field__input--phone" value={fields.phone} error={Boolean(fieldErrors.phone)} errorMessage={fieldErrors.phone} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("phone", e.target.value)} />
          <FormField id="city" label="شهر / منطقه" placeholder="شهر و محدوده فعالیت"
            maxLength={120} value={fields.city} error={Boolean(fieldErrors.city)} errorMessage={fieldErrors.city} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("city", e.target.value)} />
          <FormField id="store-address" label="آدرس فروشگاه" placeholder="نشانی کامل فروشگاه"
            maxLength={500} autoComplete="street-address" value={fields.address} error={Boolean(fieldErrors.address)} errorMessage={fieldErrors.address} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("address", e.target.value)} />
          <FormField id="postal-code" label="کدپستی" placeholder="کدپستی ۱۰ رقمی"
            inputMode="numeric" autoComplete="postal-code" maxLength={10}
            className="field__input--phone" value={fields.postalCode}
            error={Boolean(fieldErrors.postalCode)} errorMessage={fieldErrors.postalCode} required
            disabled={busy || access !== "signedIn" || conflict !== null} onChange={(e) => update("postalCode", e.target.value)} />
        </div>
        <aside className="account-note">
          <p>پس از ثبت اطلاعات، احراز هویت و مدارک صنفی در مرحله بعد تکمیل می‌شود.</p>
        </aside>
        <button className="primary-button" type="submit"
          disabled={busy || access !== "signedIn" || conflict !== null}>
          {busy ? "در حال ذخیره…" : saved ? "ذخیره تغییرات پیش‌نویس" : "ثبت اطلاعات و ادامه"}
        </button>
        {conflict && access === "signedIn" && (
          <section className="seller-conflict"
            aria-labelledby="seller-conflict-heading">
            <h3 id="seller-conflict-heading" ref={conflictHeading}
              tabIndex={-1}>تعارض نسخهٔ پیش‌نویس</h3>
            {conflict.status === "loading" ? (
              <p role="status">در حال دریافت آخرین نسخهٔ ذخیره‌شده…</p>
            ) : conflict.status === "unavailable" ? (
              <>
                <p role="alert">
                  نسخهٔ سرور هنوز قابل اعتماد نیست. متن شما در همین فرم
                  باقی مانده و برای جلوگیری از بازنویسی، ویرایش و ذخیره
                  موقتاً متوقف شده‌اند.
                </p>
                <button type="button" className="auth-card__secondary"
                  disabled={busy} onClick={() => void retryConflict()}>
                  تلاش دوباره برای دریافت نسخهٔ سرور
                </button>
              </>
            ) : (
              <>
                <p>آخرین نسخهٔ سرور با نسخهٔ این پنجره و آخرین نسخه‌ای
                  که این پنجره دیده بود مقایسه شد. می‌توانید همهٔ متن خود،
                  همهٔ متن سرور یا برای هر فیلد یک نسخه را انتخاب کنید.
                  هیچ‌کدام بدون زدن دوبارهٔ دکمهٔ ذخیره، متنی را روی سرور
                  بازنویسی نمی‌کند.</p>
                {differences.length === 0
                  ? <p>متن هر شش فیلد یکسان است؛ فقط شمارهٔ نسخه تغییر کرده است.</p>
                  : (
                    <div className="seller-conflict__differences">
                      {differences.map((item) => (
                          <div className="seller-conflict__field" key={item.key}>
                            <h4>{item.label}</h4>
                            <div className="seller-conflict__versions">
                              <p><strong>متن این پنجره</strong>
                                <bdi dir="auto">{item.mine || "—"}</bdi></p>
                              <p><strong>نسخهٔ ذخیره‌شده</strong>
                                <bdi dir="auto">{item.onServer || "—"}</bdi></p>
                            </div>
                            <fieldset className="seller-conflict__selection">
                              <legend>
                                انتخاب نسخه برای {item.label}
                                {readyConflict?.choices[item.key] === null
                                  ? " — هر دو پنجره این فیلد را متفاوت تغییر داده‌اند"
                                  : ""}
                              </legend>
                              <label>
                                <input type="radio"
                                  name={`conflict-field-${item.key}`}
                                  checked={readyConflict?.choices[item.key] === "mine"}
                                  disabled={busy}
                                  onChange={() => selectConflictField(
                                    item.key, "mine",
                                  )} />
                                متن این پنجره
                              </label>
                              <label>
                                <input type="radio"
                                  name={`conflict-field-${item.key}`}
                                  checked={readyConflict?.choices[item.key] === "server"}
                                  disabled={busy}
                                  onChange={() => selectConflictField(
                                    item.key, "server",
                                  )} />
                                نسخهٔ سرور
                              </label>
                            </fieldset>
                          </div>
                        ))}
                    </div>
                  )}
                {differences.length > 0 && (
                  <p className="seller-conflict__hint" role="status"
                    aria-live="polite">
                    {unresolved > 0
                      ? `برای ترکیب فیلدها باید برای ${unresolved} فیلدی که در هر دو پنجره تغییر کرده است، نسخهٔ مورد نظر را انتخاب کنید.`
                      : "انتخاب فیلدها آماده است. اعمال ترکیب فقط متن فرم را تغییر می‌دهد، نه نسخهٔ ذخیره‌شدهٔ سرور را."}
                  </p>
                )}
                <div className="seller-conflict__actions">
                  {differences.length > 0 && (
                    <button type="button" className="seller-conflict__keep-mine"
                      disabled={busy || unresolved > 0}
                      onClick={chooseCombinedCopy}>
                      ترکیب انتخاب‌های هر فیلد در فرم
                    </button>
                  )}
                  <button type="button" className="seller-conflict__use-server"
                    disabled={busy} onClick={chooseServerCopy}>
                    بارگذاری نسخهٔ سرور
                  </button>
                  <button type="button" className="seller-conflict__keep-mine"
                    disabled={busy} onClick={chooseMyCopy}>
                    نگه‌داشتن متن من؛ ذخیره بعد از بررسی
                  </button>
                </div>
              </>
            )}
          </section>
        )}
        {message && (
          <p className={["form-status", (Object.keys(fieldErrors).length > 0 || (!saved && !busy)) &&
            "form-status--error"].filter(Boolean).join(" ")}
            role={Object.keys(fieldErrors).length > 0 ||
              (!saved && !busy) ? "alert" : "status"}
            aria-live="polite">{message}</p>
        )}
      </form>
    </section>
  );
}
