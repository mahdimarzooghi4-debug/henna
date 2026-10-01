Warning: truncated output (original token count: 25047)
Total output lines: 2180

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { FormField } from "../../../components/form-field";
import { SellerLocationReference } from "./location-reference";
import {
  hasUnsavedSellerEdits, isLeavingSellerPage, validateSellerDraft,
  type SellerFieldErrors,
} from "../../../lib/seller-edit-safety";
import {
  emptySellerFields, loadSellerDraft, sellerFieldKeys,
  type SellerFields,
} from "../../../lib/seller-draft-preflight";
import { sellerLoginHref } from "../../../lib/seller-return";
import { normalizeDigits } from "../../../lib/normalize-digits";
import {
  getSellerReferenceCities, getSellerReferenceProvinces,
  type ReferenceCity, type ReferenceProvince,
} from "../../../lib/seller-location-reference";
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
  const [applicantType, setApplicantType] =
    useState<"NATURAL" | "LEGAL" | null>(null);
  const [completedStep, setCompletedStep] = useState(1);
  const [identityStatus, setIdentityStatus] =
    useState<"VERIFIED" | "RECORDED" | null>(null);
  const [nationalCode, setNationalCode] = useState("");
  const [nationalCodeMasked, setNationalCodeMasked] = useState<string | null>(null);
  const [legalNationalId, setLegalNationalId] = useState("");
  const [legalName, setLegalName] = useState("");
  const [legalRepresentativeName, setLegalRepresentativeName] = useState("");
  const [legalRepresentativePhone, setLegalRepresentativePhone] = useState("");
  const [identityFeedback, setIdentityFeedback] =
    useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [businessCategories, setBusinessCategories] =
    useState<Array<{ id: string; name: string }>>([]);
  const [businessCategoriesState, setBusinessCategoriesState] =
    useState<"idle" | "loading" | "ready" | "unconfigured" | "error">("idle");
  const [businessCategoryId, setBusinessCategoryId] = useState("");
  const [businessCategoryName, setBusinessCategoryName] =
    useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [offeringType, setOfferingType] =
    useState<"GOOD" | "SERVICE" | "BOTH" | null>(null);
  const [businessFeedback, setBusinessFeedback] =
    useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [activityProvinces, setActivityProvinces] =
    useState<ReferenceProvince[]>([]);
  const [activityCities, setActivityCities] =
    useState<ReferenceCity[]>([]);
  const [activityGeoState, setActivityGeoState] =
    useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activityProvinceId, setActivityProvinceId] = useState("");
  const [activityProvinceName, setActivityProvinceName] =
    useState<string | null>(null);
  const [activityCityId, setActivityCityId] = useState("");
  const [activityCityName, setActivityCityName] =
    useState<string | null>(null);
  const [activityAddress, setActivityAddress] = useState("");
  const [activityHours, setActivityHours] = useState("");
  const [sellerDelivery, setSellerDelivery] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [serviceArea, setServiceArea] = useState("");
  const [activityFeedback, setActivityFeedback] =
    useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [registrationContactName, setRegistrationContactName] = useState("");
  const [registrationContactRole, setRegistrationContactRole] = useState("");
  const [backupPhone, setBackupPhone] = useState("");
  const [websiteOrSocial, setWebsiteOrSocial] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [responseHours, setResponseHours] = useState("");
  const [additionalTouched, setAdditionalTouched] = useState(false);
  const [additionalFeedback, setAdditionalFeedback] =
    useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [submittedAtUtc, setSubmittedAtUtc] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [submitKey, setSubmitKey] = useState<string | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
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
      setFields(result.fields);
      setBaseline(result.fields);
      setSaved(true);
      setRevision(result.revision);
      setApplicantType(result.applicantType);
      setCompletedStep(result.completedStep);
      setIdentityStatus(result.identityStatus);
      setNationalCodeMasked(result.nationalCodeMasked);
      setLegalNationalId(result.legalNationalId ?? "");
      setLegalName(result.legalName ?? "");
      setLegalRepresentativeName(result.legalRepresentativeName ?? "");
      setLegalRepresentativePhone(result.legalRepresentativePhone ?? "");
      setIdentityFeedback(null);
      setBusinessCategoryId(result.businessCategoryId ?? "");
      setBusinessCategoryName(result.businessCategoryName);
      setBusinessName(result.businessName ?? "");
      setBusinessDescription(result.businessDescription ?? "");
      setBusinessPhone(result.businessPhone ?? "");
      setOfferingType(result.offeringType);
      setBusinessFeedback(null);
      setActivityProvinceId(result.activityProvinceId ?? "");
      setActivityProvinceName(result.activityProvinceName);
      setActivityCityId(result.activityCityId ?? "");
      setActivityCityName(result.activityCityName);
      setActivityAddress(result.activityAddress ?? "");
      setActivityHours(result.activityHours ?? "");
      setSellerDelivery(result.sellerDelivery ?? false);
      setPickup(result.pickup ?? false);
      setServiceArea(result.serviceArea ?? "");
      setActivityFeedback(null);
      const defaultContact = result.applicantType === "LEGAL"
        ? (result.legalRepresentativeName ?? result.fields.ownerName)
        : result.fields.ownerName;
      setRegistrationContactName(
        result.registrationContactName ?? defaultContact,
      );
      setRegistrationContactRole(result.registrationContactRole ?? "");
      setBackupPhone(result.backupPhone ?? "");
      setWebsiteOrSocial(result.websiteOrSocial ?? "");
      setBusinessEmail(result.businessEmail ?? "");
      setResponseHours(result.responseHours ?? result.activityHours ?? "");
      setAdditionalTouched(false);
      setAdditionalFeedback(null);
      if (result.status === "submitted") {
        setSubmittedAtUtc(result.submittedAtUtc);
        setTrackingCode(result.trackingCode);
        setMessage("درخواست فروشندگی برای بررسی ثبت شده است. تا تعیین نتیجه، اطلاعات این مرحله قابل ویرایش نیست.");
      } else {
        setMessage("پیش‌نویس اطلاعات اولیه شما بازیابی شد؛ می‌توانید آن را ویرایش کنید.");
      }
      setAccess("signedIn");
    });
  }

  useEffect(() => {
    checkInitialDraft();
    return () => preflightAbort.current?.abort();
  }, []);

  useEffect(() => {
    if (access !== "signedIn" || completedStep !== 3 || submittedAtUtc)
      return;
    const controller = new AbortController();
    setBusinessCategoriesState("loading");
    void fetch("/api/seller/registration/business-categories", {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        setAccess("signedOut");
        return;
      }
      if (!response.ok) {
        setBusinessCategoriesState("error");
        return;
      }
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" ||
        !("configured" in payload) ||
        typeof payload.configured !== "boolean" ||
        !("items" in payload) || !Array.isArray(payload.items)) {
        setBusinessCategoriesState("error");
        return;
      }
      const items = payload.items.filter((item): item is {
        id: string; name: string;
      } => Boolean(item && typeof item === "object" &&
        "id" in item && typeof item.id === "string" &&
        "name" in item && typeof item.name === "string"));
      if (items.length !== payload.items.length) {
        setBusinessCategoriesState("error");
        return;
      }
      setBusinessCategories(items);
      setBusinessCategoriesState(payload.configured
        ? "ready"
        : "unconfigured");
    }).catch(() => {
      if (!controller.signal.aborted)
        setBusinessCategoriesState("error");
    });
    return () => controller.abort();
  }, [access, completedStep, submittedAtUtc]);

  useEffect(() => {
    if (access !== "signedIn" || completedStep !== 4 || submittedAtUtc)
      return;
    const controller = new AbortController();
    setActivityGeoState("loading");
    void getSellerReferenceProvinces(fetch, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.status !== "ok" || result.items.length === 0) {
          setActivityGeoState("error");
          setActivityProvinces([]);
          return;
        }
        setActivityProvinces(result.items);
        setActivityGeoState("ready");
      });
    return () => controller.abort();
  }, [access, completedStep, submittedAtUtc]);

  useEffect(() => {
    if (completedStep !== 4 || !activityProvinceId) {
      setActivityCities([]);
      return;
    }
    const controller = new AbortController();
    void getSellerReferenceCities(
      activityProvinceId, fetch, controller.signal,
    ).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status !== "ok") {
        setActivityCities([]);
        setActivityGeoState("error");
        return;
      }
      setActivityCities(result.items);
    });
    return () => controller.abort();
  }, [completedStep, activityProvinceId]);


  useEffect(() => {
    if (conflict?.status === "ready") conflictHeading.current?.focus();
  }, [conflict?.status]);

  const hasUnsavedChanges = hasUnsavedSellerEdits(fields, baseline);
  const hasUnsavedIdentityChanges = completedStep === 2 &&
    (applicantType === "NATURAL"
      ? nationalCode.trim().length > 0
      : applicantType === "LEGAL" &&
        (legalNationalId.trim().length > 0 ||
          legalName.trim().length > 0 ||
          legalRepresentativeName.trim() !== fields.ownerName ||
          normalizeDigits(legalRepresentativePhone.trim()) !== fields.phone));
  const hasUnsavedBusinessChanges = completedStep === 3 &&
    (businessCategoryId.length > 0 ||
      businessName.trim().length > 0 ||
      businessDescription.trim().length > 0 ||
      businessPhone.trim().length > 0 ||
      offeringType !== null);
  const hasUnsavedActivityChanges = completedStep === 4 &&
    (activityProvinceId.length > 0 ||
      activityCityId.length > 0 ||
      activityAddress.trim().length > 0 ||
      activityHours.trim().length > 0 ||
      sellerDelivery || pickup ||
      serviceArea.trim().length > 0);
  const hasUnsavedAdditionalChanges =
    completedStep === 5 && additionalTouched;
  const hasAnyUnsavedChanges =
    hasUnsavedChanges ||
    hasUnsavedIdentityChanges ||
    hasUnsavedBusinessChanges ||
    hasUnsavedActivityChanges ||
    hasUnsavedAdditionalChanges;

  useEffect(() => {
    if (!hasAnyUnsavedChanges) return;

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
  }, [hasAnyUnsavedChanges]);

  function update(field: keyof SellerFields, value: string) {
    if (access !== "signedIn" || busy || conflict || submittedAtUtc) return;
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
    if (busy || access !== "signedIn" || conflict || submittedAtUtc) return;
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

  async function saveApplicantType(type: "NATURAL" | "LEGAL") {
    if (busy || access !== "signedIn" || conflict || submittedAtUtc ||
      revision < 1 || hasUnsavedChanges || hasUnsavedIdentityChanges) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        "/api/seller/registration/applicant-type",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicantType: type, revision }),
          cache: "no-store",
        },
      );
      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "DRAFT" &&
          "revision" in result && typeof result.revision === "number" &&
          result.revision === revision + 1 &&
          "applicantType" in result && result.applicantType === type &&
          "completedStep" in result && result.completedStep === 2) {
          setApplicantType(type);
          setCompletedStep(2);
          setRevision(result.revision);
          setIdentityStatus(null);
          setNationalCode("");
          setNationalCodeMasked(null);
          setLegalNationalId("");
          setLegalName("");
          setLegalRepresentativeName(type === "LEGAL" ? fields.ownerName : "");
          setLegalRepresentativePhone(type === "LEGAL"…13047 tokens truncated…rvice-area"
                  label="محدوده ارائه خدمت"
                  placeholder="مثال: کل شهر، محدوده منطقه ۶"
                  maxLength={240}
                  value={serviceArea}
                  required
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setServiceArea(event.target.value);
                    setActivityFeedback(null);
                  }} />

                <p className="seller-activity__note">
                  محدوده فعالیت بر اساس نوع کسب‌وکار و شرایط همکاری تنظیم می‌شود.
                </p>

                <button type="button" className="primary-button"
                  disabled={busy || access !== "signedIn" ||
                    activityGeoState !== "ready"}
                  onClick={() => void saveActivityArea()}>
                  {busy ? "در حال ذخیره…" : "ذخیره و ادامه"}
                </button>

                {hasUnsavedActivityChanges && (
                  <p className="seller-unsaved-note" role="status">
                    اطلاعات مرحله محدوده فعالیت هنوز روی سرور ثبت نشده است.
                  </p>
                )}
              </div>
            )}

            {completedStep >= 5 && (
              <div className="seller-activity__completed" role="status">
                <strong>محدوده فعالیت ذخیره شد.</strong>
                <dl>
                  <div>
                    <dt>استان / شهر</dt>
                    <dd>{activityProvinceName ?? "—"} / {activityCityName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>ساعات فعالیت</dt>
                    <dd>{activityHours}</dd>
                  </div>
                  <div>
                    <dt>روش ارائه</dt>
                    <dd>
                      {[
                        sellerDelivery ? "ارسال توسط فروشنده" : null,
                        pickup ? "تحویل حضوری" : null,
                      ].filter(Boolean).join("، ")}
                    </dd>
                  </div>
                  <div>
                    <dt>محدوده پوشش</dt>
                    <dd>{serviceArea}</dd>
                  </div>
                </dl>
                <p>{activityAddress}</p>
                <p>مرحله بعد «اطلاعات تکمیلی» است.</p>
              </div>
            )}

            {activityFeedback && (
              <p className={activityFeedback.kind === "error"
                ? "form-status form-status--error"
                : "form-status"}
                role={activityFeedback.kind === "error" ? "alert" : "status"}>
                {activityFeedback.text}
              </p>
            )}
          </section>
        )}
        {completedStep >= 5 && !submittedAtUtc && (
          <section className="seller-additional"
            aria-labelledby="seller-additional-heading">
            <div className="seller-additional__intro">
              <p className="seller-applicant-type__step">مرحله ۶ از ۸</p>
              <h3 id="seller-additional-heading">اطلاعات تکمیلی</h3>
              <p>
                جزئیات تکمیلی برای ادامه ثبت‌نام کسب‌وکار ثبت می‌شود.
                اطلاعات هویتی قبلی دوباره کپی یا بازنویسی نمی‌شود.
              </p>
            </div>

            {completedStep === 5 && (
              <div className="seller-additional__body">
                <div className="seller-additional__identity-summary">
                  <p>
                    <strong>اطلاعات مسئول کسب‌وکار</strong>
                    <span>
                      {applicantType === "NATURAL"
                        ? "کد ملی ثبت‌شده: " + (nationalCodeMasked ?? "—")
                        : "شناسه ملی ثبت‌شده: " + (legalNationalId || "—")}
                    </span>
                  </p>
                </div>

                <FormField id="seller-registration-contact"
                  label="نام رابط یا مسئول ثبت‌نام"
                  placeholder="مسئول ثبت‌نام"
                  maxLength={120}
                  value={registrationContactName}
                  required
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setRegistrationContactName(event.target.value);
                    setAdditionalTouched(true);
                    setAdditionalFeedback(null);
                  }} />

                <FormField id="seller-registration-role"
                  label="سمت در کسب‌وکار (اختیاری)"
                  placeholder="مثال: مدیر فروش، صاحب پروانه"
                  maxLength={120}
                  value={registrationContactRole}
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setRegistrationContactRole(event.target.value);
                    setAdditionalTouched(true);
                    setAdditionalFeedback(null);
                  }} />

                <FormField id="seller-backup-phone"
                  label="تلفن همراه دوم / پشتیبان (اختیاری)"
                  placeholder="09xxxxxxxxx"
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  className="field__input--phone"
                  value={backupPhone}
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setBackupPhone(event.target.value);
                    setAdditionalTouched(true);
                    setAdditionalFeedback(null);
                  }} />

                <FormField id="seller-website-social"
                  label="آدرس وب‌سایت / شبکه اجتماعی (اختیاری)"
                  placeholder="مثال: instagram.com/shop"
                  maxLength={300}
                  value={websiteOrSocial}
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setWebsiteOrSocial(event.target.value);
                    setAdditionalTouched(true);
                    setAdditionalFeedback(null);
                  }} />

                <FormField id="seller-business-email"
                  label="ایمیل کسب‌وکار (اختیاری)"
                  placeholder="info@example.com"
                  type="email"
                  maxLength={254}
                  value={businessEmail}
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setBusinessEmail(event.target.value);
                    setAdditionalTouched(true);
                    setAdditionalFeedback(null);
                  }} />

                <FormField id="seller-response-hours"
                  label="ساعات کاری پاسخگویی"
                  placeholder="ساعات فعالیت ثبت‌شده"
                  maxLength={180}
                  value={responseHours}
                  required
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setResponseHours(event.target.value);
                    setAdditionalTouched(true);
                    setAdditionalFeedback(null);
                  }} />

                <div className="seller-additional__documents">
                  <strong>مدارک در صورت نیاز</strong>
                  <p>
                    مدارک موردنیاز، در صورت لزوم، متناسب با نوع کسب‌وکار
                    در همین بخش اعلام می‌شود.
                  </p>
                  <div className="seller-additional__documents-empty"
                    role="status">
                    در این مرحله نیازی به بارگذاری مدرک خاصی نیست.
                  </div>
                </div>

                <button type="button" className="primary-button"
                  disabled={busy || access !== "signedIn"}
                  onClick={() => void saveAdditionalInformation()}>
                  {busy ? "در حال ذخیره…" : "ذخیره و ادامه"}
                </button>

                {hasUnsavedAdditionalChanges && (
                  <p className="seller-unsaved-note" role="status">
                    تغییرات اطلاعات تکمیلی هنوز روی سرور ثبت نشده است.
                  </p>
                )}
              </div>
            )}

            {completedStep >= 6 && (
              <div className="seller-additional__completed" role="status">
                <strong>اطلاعات تکمیلی ذخیره شد.</strong>
                <dl>
                  <div>
                    <dt>مسئول ثبت‌نام</dt>
                    <dd>{registrationContactName}</dd>
                  </div>
                  <div>
                    <dt>سمت</dt>
                    <dd>{registrationContactRole || "ثبت نشده"}</dd>
                  </div>
                  <div>
                    <dt>تلفن پشتیبان</dt>
                    <dd dir="ltr">{backupPhone || "ثبت نشده"}</dd>
                  </div>
                  <div>
                    <dt>ساعات پاسخگویی</dt>
                    <dd>{responseHours}</dd>
                  </div>
                </dl>
                {websiteOrSocial && <p>{websiteOrSocial}</p>}
                {businessEmail && <p dir="ltr">{businessEmail}</p>}
                <p>مدرک خاصی برای این مرحله درخواست نشده است.</p>
                <p>مرحله بعد «بازبینی و ثبت» است.</p>
              </div>
            )}

            {additionalFeedback && (
              <p className={additionalFeedback.kind === "error"
                ? "form-status form-status--error"
                : "form-status"}
                role={additionalFeedback.kind === "error"
                  ? "alert" : "status"}>
                {additionalFeedback.text}
              </p>
            )}
          </section>
        )}
        {completedStep >= 6 && revision > 0 && !submittedAtUtc && (
          <section className="seller-review seller-review--final"
            aria-labelledby="seller-review-heading">
            <div className="seller-review__intro">
              <p className="seller-applicant-type__step">مرحله ۷ از ۸</p>
              <span className="seller-review__ready">آماده ثبت نهایی</span>
              <h3 id="seller-review-heading">بازبینی اطلاعات وارد شده</h3>
              <p>
                لطفاً صحت تمامی اطلاعات وارد شده را بررسی و پس از تأیید،
                درخواست خود را ثبت کنید.
              </p>
            </div>

            <div className="seller-review__sections">
              <article className="seller-review__card">
                <h4>نوع متقاضی</h4>
                <dl>
                  <div><dt>نوع حساب</dt><dd>
                    {applicantType === "LEGAL" ? "شخص حقوقی" : "شخص حقیقی"}
                  </dd></div>
                </dl>
              </article>

              <article className="seller-review__card">
                <h4>اطلاعات هویتی</h4>
                <dl>
                  <div><dt>نام و نام خانوادگی</dt><dd>
                    {applicantType === "LEGAL"
                      ? legalRepresentativeName
                      : fields.ownerName}
                  </dd></div>
                  <div><dt>{applicantType === "LEGAL"
                    ? "شناسه ملی"
                    : "کد ملی"}</dt><dd dir="ltr">
                    {applicantType === "LEGAL"
                      ? legalNationalId
                      : nationalCodeMasked}
                  </dd></div>
                  <div><dt>شماره موبایل</dt><dd dir="ltr">
                    {fields.phone.length === 11
                      ? fields.phone.slice(0, 4) + "*******"
                      : "—"}
                  </dd></div>
                  <div><dt>احراز هویت</dt><dd>
                    {identityStatus === "VERIFIED"
                      ? "تأیید شده"
                      : "اطلاعات ثبت شده"}
                  </dd></div>
                </dl>
              </article>

              <article className="seller-review__card">
                <h4>اطلاعات کسب‌وکار</h4>
                <dl>
                  <div><dt>نام کسب‌وکار</dt><dd>{businessName}</dd></div>
                  <div><dt>دسته‌بندی</dt><dd>{businessCategoryName ?? "—"}</dd></div>
                  <div><dt>نوع ارائه اصلی</dt><dd>
                    {offeringType === "GOOD"
                      ? "کالا"
                      : offeringType === "SERVICE"
                        ? "خدمت"
                        : "کالا و خدمت"}
                  </dd></div>
                  <div><dt>تلفن کسب‌وکار</dt><dd dir="ltr">
                    {businessPhone.length === 11
                      ? businessPhone.slice(0, 3) + "********"
                      : "—"}
                  </dd></div>
                </dl>
              </article>

              <article className="seller-review__card">
                <h4>محدوده فعالیت</h4>
                <dl>
                  <div><dt>استان و شهر</dt><dd>
                    {activityProvinceName ?? "—"} / {activityCityName ?? "—"}
                  </dd></div>
                  <div><dt>محدوده پوشش</dt><dd>{serviceArea}</dd></div>
                </dl>
              </article>

              <article className="seller-review__card">
                <h4>اطلاعات تکمیلی</h4>
                <dl>
                  <div><dt>مسئول ثبت‌نام</dt><dd>
                    {registrationContactName}
                  </dd></div>
                  <div><dt>ساعات پاسخگویی</dt><dd>{responseHours}</dd></div>
                  <div><dt>وضعیت فروشندگی</dt><dd>آماده ثبت نهایی</dd></div>
                </dl>
              </article>
            </div>

            <label className="seller-review__confirmation">
              <input type="checkbox"
                checked={reviewConfirmed}
                disabled={busy || access !== "signedIn"}
                onChange={(event) => {
                  setReviewConfirmed(event.target.checked);
                  setMessage("");
                }} />
              <span>صحت اطلاعات واردشده را تأیید می‌کنم.</span>
            </label>

            <div className="seller-review__actions">
              <button type="button" className="primary-button"
                disabled={busy || access !== "signedIn" ||
                  conflict !== null || hasAnyUnsavedChanges ||
                  !reviewConfirmed}
                onClick={() => void submitForReview()}>
                {busy ? "در حال ثبت…" : "ثبت نهایی درخواست"}
              </button>
              <button type="button" className="auth-card__secondary"
                disabled={busy}
                onClick={() => {
                  setReviewConfirmed(false);
                  document.getElementById("seller-additional-heading")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}>
                بازگشت و ویرایش
              </button>
            </div>
          </section>
        )}
        {submittedAtUtc && (
          <section className="seller-review seller-submitted"
            aria-labelledby="seller-status-heading">
            <h3 id="seller-status-heading">درخواست ثبت شد</h3>
            <p role="status">
              درخواست ثبت‌نام فروشنده / ارائه‌دهنده شما دریافت شد و
              وضعیت آن از همین حساب قابل پیگیری است.
            </p>
            {trackingCode && (
              <p className="seller-submitted__tracking" dir="ltr">
                کد پیگیری درخواست: {trackingCode}
              </p>
            )}
            <p>زمان ثبت: <time dateTime={submittedAtUtc}>
              {new Intl.DateTimeFormat("fa-IR", {
                dateStyle: "medium", timeStyle: "short",
              }).format(new Date(submittedAtUtc))}
            </time></p>
            <div className="seller-submitted__actions">
              <Link className="primary-button"
                href="/seller/register/status">
                مشاهده وضعیت درخواست
              </Link>
              <Link className="auth-card__secondary" href="/">
                بازگشت به حنا
              </Link>
            </div>
            <p>
              ثبت درخواست به معنی تأیید یا فعال‌شدن فروشگاه نیست.
            </p>
          </section>
        )}
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
    </>
  );
}
