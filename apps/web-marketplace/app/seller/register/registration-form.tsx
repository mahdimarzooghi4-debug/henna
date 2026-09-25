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
  const [submitKey, setSubmitKey] = useState<string | null>(null);
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
          setLegalRepresentativePhone(type === "LEGAL" ? fields.phone : "");
          setIdentityFeedback(null);
          setSaved(true);
          setMessage(type === "NATURAL"
            ? "نوع متقاضی «شخص حقیقی» ذخیره شد. مرحله بعد احراز هویت شخص حقیقی است."
            : "نوع متقاضی «شخص حقوقی» ذخیره شد. مرحله بعد احراز هویت شخصیت حقوقی است.");
          return;
        }
      }
      if (response.status === 401) setAccess("signedOut");
      if (response.status === 409) {
        checkInitialDraft();
        setMessage("پیش‌نویس در جای دیگری تغییر کرده است؛ آخرین نسخه دوباره دریافت می‌شود.");
        return;
      }
      setMessage(response.status === 401
        ? "نشست شما پایان یافته است؛ نوع متقاضی ذخیره نشد."
        : "ذخیره نوع متقاضی تأیید نشد؛ لطفاً دوباره تلاش کنید.");
    } catch {
      setMessage("ذخیره نوع متقاضی تأیید نشد؛ لطفاً دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  function validNaturalNationalCode(value: string) {
    const code = normalizeDigits(value.trim());
    if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) return false;
    const sum = [...code.slice(0, 9)].reduce(
      (total, digit, index) =>
        total + Number(digit) * (10 - index), 0);
    const remainder = sum % 11;
    const check = remainder < 2 ? remainder : 11 - remainder;
    return check === Number(code[9]);
  }

  async function verifyNaturalIdentity() {
    if (busy || access !== "signedIn" || applicantType !== "NATURAL" ||
      completedStep !== 2 || revision < 1 || hasUnsavedChanges) return;

    const normalized = normalizeDigits(nationalCode.trim());
    setNationalCode(normalized);
    if (!validNaturalNationalCode(normalized)) {
      setIdentityFeedback({ kind: "error", text: "فرمت کد ملی صحیح نیست." });
      return;
    }

    setBusy(true);
    setIdentityFeedback({ kind: "info", text: "در حال بررسی اطلاعات هویتی…" });
    try {
      const response = await fetch(
        "/api/seller/registration/identity/natural",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nationalCode: normalized, revision }),
          cache: "no-store",
        },
      );
      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "DRAFT" &&
          "revision" in result && result.revision === revision + 1 &&
          "identityStatus" in result &&
          result.identityStatus === "VERIFIED" &&
          "nationalCodeMasked" in result &&
          typeof result.nationalCodeMasked === "string" &&
          "completedStep" in result && result.completedStep === 3) {
          setRevision(result.revision as number);
          setCompletedStep(3);
          setIdentityStatus("VERIFIED");
          setNationalCodeMasked(result.nationalCodeMasked);
          setNationalCode("");
          setIdentityFeedback({
            kind: "info",
            text: "اطلاعات هویتی تأیید شد. مرحله بعد اطلاعات کسب‌وکار است.",
          });
          return;
        }
      }
      if (response.status === 401) setAccess("signedOut");
      if (response.status === 409) {
        checkInitialDraft();
        setIdentityFeedback({
          kind: "error",
          text: "نسخه یا نوع متقاضی تغییر کرده است؛ آخرین وضعیت دوباره دریافت می‌شود.",
        });
        return;
      }
      setIdentityFeedback({
        kind: "error",
        text: response.status === 503
          ? "استعلام هویت در حال حاضر در دسترس نیست؛ هیچ تأییدی ثبت نشد."
          : response.status === 400
            ? "اطلاعات هویتی تأیید نشد."
            : "استعلام هویت تکمیل نشد؛ دوباره تلاش کنید.",
      });
    } catch {
      setIdentityFeedback({
        kind: "error",
        text: "استعلام هویت در حال حاضر در دسترس نیست؛ هیچ تأییدی ثبت نشد.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveLegalIdentity() {
    if (busy || access !== "signedIn" || applicantType !== "LEGAL" ||
      completedStep !== 2 || revision < 1 || hasUnsavedChanges) return;

    const normalizedId = normalizeDigits(legalNationalId.trim());
    const normalizedPhone = normalizeDigits(legalRepresentativePhone.trim());
    setLegalNationalId(normalizedId);
    setLegalRepresentativePhone(normalizedPhone);
    if (!/^\d{11}$/.test(normalizedId) ||
      !legalName.trim() || legalName.trim().length > 180 ||
      !legalRepresentativeName.trim() ||
      legalRepresentativeName.trim().length > 120 ||
      !/^09\d{9}$/.test(normalizedPhone)) {
      setIdentityFeedback({
        kind: "error",
        text: "اطلاعات شخصیت حقوقی کامل یا معتبر نیست.",
      });
      return;
    }

    setBusy(true);
    setIdentityFeedback(null);
    try {
      const response = await fetch(
        "/api/seller/registration/identity/legal",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legalNationalId: normalizedId,
            legalName: legalName.trim(),
            representativeName: legalRepresentativeName.trim(),
            representativePhone: normalizedPhone,
            revision,
          }),
          cache: "no-store",
        },
      );
      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "DRAFT" &&
          "revision" in result && result.revision === revision + 1 &&
          "identityStatus" in result &&
          result.identityStatus === "RECORDED" &&
          "completedStep" in result && result.completedStep === 3) {
          setRevision(result.revision as number);
          setCompletedStep(3);
          setIdentityStatus("RECORDED");
          setIdentityFeedback({
            kind: "info",
            text: "اطلاعات شخصیت حقوقی ثبت شد. این وضعیت به معنی احراز خارجی یا تأیید نهایی نیست.",
          });
          return;
        }
      }
      if (response.status === 401) setAccess("signedOut");
      if (response.status === 409) {
        checkInitialDraft();
        setIdentityFeedback({
          kind: "error",
          text: "نسخه یا نوع متقاضی تغییر کرده است؛ آخرین وضعیت دوباره دریافت می‌شود.",
        });
        return;
      }
      setIdentityFeedback({
        kind: "error",
        text: response.status === 400
          ? "اطلاعات شخصیت حقوقی یا شماره نماینده معتبر نیست."
          : "ذخیره اطلاعات شخصیت حقوقی تأیید نشد؛ دوباره تلاش کنید.",
      });
    } catch {
      setIdentityFeedback({
        kind: "error",
        text: "ذخیره اطلاعات شخصیت حقوقی تأیید نشد؛ دوباره تلاش کنید.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveBusinessInformation() {
    if (busy || access !== "signedIn" || completedStep !== 3 ||
      revision < 1 || businessCategoriesState !== "ready") return;

    const normalizedPhone = normalizeDigits(businessPhone.trim());
    const nextName = businessName.trim();
    const nextDescription = businessDescription.trim();
    const selectedCategory = businessCategories.find(
      (item) => item.id === businessCategoryId,
    );
    setBusinessPhone(normalizedPhone);
    setBusinessName(nextName);
    setBusinessDescription(nextDescription);

    if (!selectedCategory ||
      !nextName || nextName.length > 180 ||
      !nextDescription || nextDescription.length > 500 ||
      !/^0\d{10}$/.test(normalizedPhone) ||
      (offeringType !== "GOOD" &&
        offeringType !== "SERVICE" &&
        offeringType !== "BOTH")) {
      setBusinessFeedback({
        kind: "error",
        text: "اطلاعات کسب‌وکار کامل یا معتبر نیست.",
      });
      return;
    }

    setBusy(true);
    setBusinessFeedback(null);
    try {
      const response = await fetch(
        "/api/seller/registration/business-information",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: selectedCategory.id,
            businessName: nextName,
            description: nextDescription,
            businessPhone: normalizedPhone,
            offeringType,
            revision,
          }),
          cache: "no-store",
        },
      );

      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "DRAFT" &&
          "revision" in result && result.revision === revision + 1 &&
          "completedStep" in result && result.completedStep === 4 &&
          "category" in result && result.category &&
          typeof result.category === "object" &&
          "id" in result.category &&
          result.category.id === selectedCategory.id &&
          "name" in result.category &&
          typeof result.category.name === "string") {
          setRevision(result.revision as number);
          setCompletedStep(4);
          setBusinessCategoryName(result.category.name);
          setBusinessFeedback({
            kind: "info",
            text: "اطلاعات کسب‌وکار ذخیره شد. مرحله بعد محدوده فعالیت است.",
          });
          return;
        }
      }

      if (response.status === 401) setAccess("signedOut");
      setBusinessFeedback({
        kind: "error",
        text: response.status === 409
          ? "نسخه یا مرحله ثبت‌نام تغییر کرده است. اطلاعات واردشده حفظ شده؛ پیش از تلاش دوباره آخرین وضعیت را بررسی کنید."
          : response.status === 400
            ? "اطلاعات یا دسته‌بندی کسب‌وکار معتبر نیست."
            : "ذخیره اطلاعات کسب‌وکار تأیید نشد؛ دوباره تلاش کنید.",
      });
    } catch {
      setBusinessFeedback({
        kind: "error",
        text: "ذخیره اطلاعات کسب‌وکار تأیید نشد؛ دوباره تلاش کنید.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveActivityArea() {
    if (busy || access !== "signedIn" || completedStep !== 4 ||
      revision < 1 || activityGeoState !== "ready") return;

    const province = activityProvinces.find(
      (item) => item.id === activityProvinceId,
    );
    const city = activityCities.find(
      (item) => item.id === activityCityId &&
        item.provinceId === activityProvinceId,
    );
    const nextAddress = activityAddress.trim();
    const nextHours = activityHours.trim();
    const nextServiceArea = serviceArea.trim();

    if (!province || !city ||
      !nextAddress || nextAddress.length > 500 ||
      !nextHours || nextHours.length > 180 ||
      !nextServiceArea || nextServiceArea.length > 240 ||
      (!sellerDelivery && !pickup)) {
      setActivityFeedback({
        kind: "error",
        text: "محدوده فعالیت کامل یا معتبر نیست.",
      });
      return;
    }

    setBusy(true);
    setActivityFeedback(null);
    try {
      const response = await fetch(
        "/api/seller/registration/activity-area",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provinceId: province.id,
            cityId: city.id,
            address: nextAddress,
            activityHours: nextHours,
            sellerDelivery,
            pickup,
            serviceArea: nextServiceArea,
            revision,
          }),
          cache: "no-store",
        },
      );

      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "DRAFT" &&
          "revision" in result && result.revision === revision + 1 &&
          "completedStep" in result && result.completedStep === 5 &&
          "province" in result && result.province &&
          typeof result.province === "object" &&
          "name" in result.province &&
          typeof result.province.name === "string" &&
          "city" in result && result.city &&
          typeof result.city === "object" &&
          "name" in result.city &&
          typeof result.city.name === "string") {
          setRevision(result.revision as number);
          setCompletedStep(5);
          setActivityProvinceName(result.province.name);
          setActivityCityName(result.city.name);
          setActivityAddress(nextAddress);
          setActivityHours(nextHours);
          setServiceArea(nextServiceArea);
          setRegistrationContactName(
            applicantType === "LEGAL"
              ? (legalRepresentativeName || fields.ownerName)
              : fields.ownerName,
          );
          setResponseHours(nextHours);
          setAdditionalTouched(false);
          setActivityFeedback({
            kind: "info",
            text: "محدوده فعالیت ذخیره شد. مرحله بعد اطلاعات تکمیلی است.",
          });
          return;
        }
      }

      if (response.status === 401) setAccess("signedOut");
      setActivityFeedback({
        kind: "error",
        text: response.status === 409
          ? "نسخه یا مرحله ثبت‌نام تغییر کرده است؛ اطلاعات واردشده حفظ شده است."
          : response.status === 400
            ? "استان، شهر یا اطلاعات محدوده فعالیت معتبر نیست."
            : "ذخیره محدوده فعالیت تأیید نشد؛ دوباره تلاش کنید.",
      });
    } catch {
      setActivityFeedback({
        kind: "error",
        text: "ذخیره محدوده فعالیت تأیید نشد؛ دوباره تلاش کنید.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function saveAdditionalInformation() {
    if (busy || access !== "signedIn" || completedStep !== 5 ||
      revision < 1) return;

    const nextContactName = registrationContactName.trim();
    const nextContactRole = registrationContactRole.trim();
    const normalizedBackup = normalizeDigits(backupPhone.trim());
    const nextWebsite = websiteOrSocial.trim();
    const nextEmail = businessEmail.trim();
    const nextResponseHours = responseHours.trim();

    setRegistrationContactName(nextContactName);
    setRegistrationContactRole(nextContactRole);
    setBackupPhone(normalizedBackup);
    setWebsiteOrSocial(nextWebsite);
    setBusinessEmail(nextEmail);
    setResponseHours(nextResponseHours);

    if (!nextContactName || nextContactName.length > 120 ||
      nextContactRole.length > 120 ||
      (normalizedBackup.length > 0 &&
        !/^09\d{9}$/.test(normalizedBackup)) ||
      nextWebsite.length > 300 ||
      nextEmail.length > 254 ||
      (nextEmail.length > 0 &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) ||
      !nextResponseHours || nextResponseHours.length > 180) {
      setAdditionalFeedback({
        kind: "error",
        text: "اطلاعات تکمیلی کامل یا معتبر نیست.",
      });
      return;
    }

    setBusy(true);
    setAdditionalFeedback(null);
    try {
      const response = await fetch(
        "/api/seller/registration/additional-information",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName: nextContactName,
            contactRole: nextContactRole || null,
            backupPhone: normalizedBackup || null,
            websiteOrSocial: nextWebsite || null,
            businessEmail: nextEmail || null,
            responseHours: nextResponseHours,
            revision,
          }),
          cache: "no-store",
        },
      );

      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "DRAFT" &&
          "revision" in result && result.revision === revision + 1 &&
          "completedStep" in result && result.completedStep === 6 &&
          "documentsRequired" in result &&
          result.documentsRequired === false &&
          "contactName" in result &&
          typeof result.contactName === "string" &&
          "responseHours" in result &&
          typeof result.responseHours === "string") {
          setRevision(result.revision as number);
          setCompletedStep(6);
          setRegistrationContactName(result.contactName);
          setRegistrationContactRole(
            "contactRole" in result &&
            typeof result.contactRole === "string"
              ? result.contactRole : "",
          );
          setBackupPhone(
            "backupPhone" in result &&
            typeof result.backupPhone === "string"
              ? result.backupPhone : "",
          );
          setWebsiteOrSocial(
            "websiteOrSocial" in result &&
            typeof result.websiteOrSocial === "string"
              ? result.websiteOrSocial : "",
          );
          setBusinessEmail(
            "businessEmail" in result &&
            typeof result.businessEmail === "string"
              ? result.businessEmail : "",
          );
          setResponseHours(result.responseHours);
          setAdditionalTouched(false);
          setAdditionalFeedback({
            kind: "info",
            text: "اطلاعات تکمیلی ذخیره شد. مرحله بعد بازبینی و ثبت است.",
          });
          return;
        }
      }

      if (response.status === 401) setAccess("signedOut");
      setAdditionalFeedback({
        kind: "error",
        text: response.status === 409
          ? "نسخه یا مرحله ثبت‌نام تغییر کرده است؛ اطلاعات واردشده حفظ شده است."
          : response.status === 400
            ? "اطلاعات تکمیلی معتبر نیست."
            : "ذخیره اطلاعات تکمیلی تأیید نشد؛ دوباره تلاش کنید.",
      });
    } catch {
      setAdditionalFeedback({
        kind: "error",
        text: "ذخیره اطلاعات تکمیلی تأیید نشد؛ دوباره تلاش کنید.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    if (busy || access !== "signedIn" || conflict || submittedAtUtc ||
      revision < 1 || hasUnsavedChanges) return;
    const key = submitKey ?? crypto.randomUUID();
    setSubmitKey(key);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/seller/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, idempotencyKey: key }),
        cache: "no-store",
      });
      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" &&
          "status" in result && result.status === "SUBMITTED" &&
          "revision" in result && typeof result.revision === "number" &&
          "submittedAtUtc" in result &&
          typeof result.submittedAtUtc === "string") {
          setRevision(result.revision);
          setSubmittedAtUtc(result.submittedAtUtc);
          setSaved(true);
          setMessage("درخواست فروشندگی برای بررسی ثبت شد. ثبت درخواست به معنی تأیید یا فعال‌شدن فروشگاه نیست.");
          return;
        }
      }
      if (response.status === 401) setAccess("signedOut");
      setMessage(response.status === 409
        ? "نسخهٔ پیش‌نویس تغییر کرده یا درخواست قبلاً ثبت شده است. وضعیت را دوباره بررسی کنید."
        : response.status === 401
          ? "نشست شما پایان یافته است؛ درخواست ثبت نشد."
          : "ثبت درخواست تأیید نشد؛ لطفاً دوباره تلاش کنید.");
    } catch {
      setMessage("ثبت درخواست تأیید نشد؛ لطفاً دوباره تلاش کنید.");
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
            disabled={busy || access !== "signedIn" || conflict !== null || submittedAtUtc !== null || completedStep >= 2} onChange={(e) => update("storeName", e.target.value)} />
          <FormField id="owner-name" label="نام و نام خانوادگی مسئول" placeholder="نام مسئول فروشگاه"
            maxLength={120} autoComplete="name" value={fields.ownerName} error={Boolean(fieldErrors.ownerName)} errorMessage={fieldErrors.ownerName} required
            disabled={busy || access !== "signedIn" || conflict !== null || submittedAtUtc !== null || completedStep >= 2} onChange={(e) => update("ownerName", e.target.value)} />
          <FormField id="seller-phone" label="شماره موبایل" placeholder="09xxxxxxxxx"
            type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11}
            className="field__input--phone" value={fields.phone} error={Boolean(fieldErrors.phone)} errorMessage={fieldErrors.phone} required
            disabled={busy || access !== "signedIn" || conflict !== null || submittedAtUtc !== null || completedStep >= 2} onChange={(e) => update("phone", e.target.value)} />
          <FormField id="city" label="شهر / منطقه" placeholder="شهر و محدوده فعالیت"
            maxLength={120} value={fields.city} error={Boolean(fieldErrors.city)} errorMessage={fieldErrors.city} required
            disabled={busy || access !== "signedIn" || conflict !== null || submittedAtUtc !== null || completedStep >= 2} onChange={(e) => update("city", e.target.value)} />
          <SellerLocationReference
            enabled={access === "signedIn" && !busy && conflict === null &&
              completedStep < 2}
            onChoose={(value) => update("city", value)} />
          <FormField id="store-address" label="آدرس فروشگاه" placeholder="نشانی کامل فروشگاه"
            maxLength={500} autoComplete="street-address" value={fields.address} error={Boolean(fieldErrors.address)} errorMessage={fieldErrors.address} required
            disabled={busy || access !== "signedIn" || conflict !== null || submittedAtUtc !== null || completedStep >= 2} onChange={(e) => update("address", e.target.value)} />
          <FormField id="postal-code" label="کدپستی" placeholder="کدپستی ۱۰ رقمی"
            inputMode="numeric" autoComplete="postal-code" maxLength={10}
            className="field__input--phone" value={fields.postalCode}
            error={Boolean(fieldErrors.postalCode)} errorMessage={fieldErrors.postalCode} required
            disabled={busy || access !== "signedIn" || conflict !== null || submittedAtUtc !== null || completedStep >= 2} onChange={(e) => update("postalCode", e.target.value)} />
        </div>
        <aside className="account-note">
          <p>ثبت‌نام طبق مسیر ۸ مرحله‌ای فیگما ادامه پیدا می‌کند. پس از اطلاعات اولیه، نوع متقاضی انتخاب می‌شود و ثبت نهایی تا تکمیل مراحل ۱ تا ۶ در سرور مجاز نیست.</p>
        </aside>
        {!submittedAtUtc && completedStep < 2 && (
          <button className="primary-button" type="submit"
            disabled={busy || access !== "signedIn" || conflict !== null}>
            {busy ? "در حال ذخیره…" :
              revision > 0 ? "ذخیره تغییرات پیش‌نویس" :
                "ثبت اطلاعات و ادامه"}
          </button>
        )}
        {revision > 0 && !submittedAtUtc && (
          <section className="seller-applicant-type"
            aria-labelledby="seller-applicant-type-heading">
            <div className="seller-applicant-type__intro">
              <p className="seller-applicant-type__step">مرحله ۲ از ۸</p>
              <h3 id="seller-applicant-type-heading">نوع متقاضی</h3>
              <p>انتخاب نوع متقاضی، اطلاعات پایه موردنیاز برای ادامه ثبت‌نام را مشخص می‌کند.</p>
            </div>
            <div className="seller-applicant-type__options">
              <button type="button"
                className={applicantType === "NATURAL"
                  ? "seller-applicant-type__option seller-applicant-type__option--selected"
                  : "seller-applicant-type__option"}
                aria-pressed={applicantType === "NATURAL"}
                disabled={busy || access !== "signedIn" || conflict !== null ||
                  hasAnyUnsavedChanges || completedStep >= 3}
                onClick={() => void saveApplicantType("NATURAL")}>
                <strong>شخص حقیقی</strong>
                <span>ثبت‌نام به نام یک فرد با کدملی شخصی؛ مناسب کسب‌وکارهای خانگی، ارائه‌دهندگان محلی، آزادکاران و تولیدکنندگان انفرادی.</span>
              </button>
              <button type="button"
                className={applicantType === "LEGAL"
                  ? "seller-applicant-type__option seller-applicant-type__option--selected"
                  : "seller-applicant-type__option"}
                aria-pressed={applicantType === "LEGAL"}
                disabled={busy || access !== "signedIn" || conflict !== null ||
                  hasAnyUnsavedChanges || completedStep >= 3}
                onClick={() => void saveApplicantType("LEGAL")}>
                <strong>شخص حقوقی</strong>
                <span>ثبت‌نام به نام یک شخصیت حقوقی یا سازمان.</span>
              </button>
            </div>
            {hasUnsavedChanges && (
              <p className="seller-conflict__hint">ابتدا تغییرات اطلاعات اولیه را ذخیره کنید؛ نوع متقاضی روی نسخه ذخیره‌شده ثبت می‌شود.</p>
            )}
            {completedStep >= 2 && applicantType && (
              <p className="seller-applicant-type__saved" role="status">
                انتخاب ذخیره‌شده: {applicantType === "NATURAL"
                  ? "شخص حقیقی"
                  : "شخص حقوقی"}
                {completedStep === 2
                  ? " — مرحله بعد «احراز هویت» است."
                  : " — مرحله احراز هویت ثبت شده است."}
              </p>
            )}
          </section>
        )}
        {completedStep >= 2 && applicantType && !submittedAtUtc && (
          <section className="seller-identity"
            aria-labelledby="seller-identity-heading">
            <div className="seller-identity__intro">
              <p className="seller-applicant-type__step">مرحله ۳ از ۸</p>
              <h3 id="seller-identity-heading">
                {applicantType === "NATURAL"
                  ? "احراز هویت شخص حقیقی"
                  : "اطلاعات شخصیت حقوقی"}
              </h3>
              <p>
                {applicantType === "NATURAL"
                  ? "اطلاعات هویتی فقط از طریق استعلام مجاز تأیید می‌شود؛ وارد کردن کد ملی به‌تنهایی احراز هویت محسوب نمی‌شود."
                  : "اطلاعات ثبتی و نماینده در این مرحله ثبت می‌شود؛ ثبت این داده‌ها به معنی احراز خارجی یا تأیید نهایی شخصیت حقوقی نیست."}
              </p>
            </div>

            {completedStep === 2 && applicantType === "NATURAL" && (
              <div className="seller-identity__body">
                <div className="seller-identity__summary">
                  <p><strong>نام و نام خانوادگی</strong><bdi>{fields.ownerName}</bdi></p>
                  <p><strong>شماره موبایل تأییدشده</strong><bdi dir="ltr">{fields.phone}</bdi></p>
                </div>
                <FormField id="seller-national-code" label="کد ملی"
                  placeholder="مثال: ۰۰۸۴۵۷۵۹۴۸"
                  inputMode="numeric" maxLength={10}
                  className="field__input--phone"
                  value={nationalCode} required
                  disabled={busy || access !== "signedIn"}
                  onChange={(e) => {
                    setNationalCode(e.target.value);
                    setIdentityFeedback(null);
                  }} />
                <button type="button" className="primary-button"
                  disabled={busy || access !== "signedIn"}
                  onClick={() => void verifyNaturalIdentity()}>
                  {busy ? "در حال استعلام…" : "استعلام و ادامه"}
                </button>
              </div>
            )}

            {completedStep === 2 && applicantType === "LEGAL" && (
              <div className="seller-identity__body seller-identity__legal-grid">
                <FormField id="seller-legal-name"
                  label="نام شخصیت حقوقی / سازمان"
                  placeholder="مثال: شرکت نمونه"
                  maxLength={180} value={legalName} required
                  disabled={busy || access !== "signedIn"}
                  onChange={(e) => {
                    setLegalName(e.target.value);
                    setIdentityFeedback(null);
                  }} />
                <FormField id="seller-legal-national-id"
                  label="شناسه ملی ۱۱ رقمی"
                  placeholder="شناسه ملی ۱۱ رقمی"
                  inputMode="numeric" maxLength={11}
                  className="field__input--phone"
                  value={legalNationalId} required
                  disabled={busy || access !== "signedIn"}
                  onChange={(e) => {
                    setLegalNationalId(e.target.value);
                    setIdentityFeedback(null);
                  }} />
                <FormField id="seller-representative-name"
                  label="نام نماینده"
                  placeholder="نام نماینده رسمی"
                  maxLength={120} value={legalRepresentativeName} required
                  disabled={busy || access !== "signedIn"}
                  onChange={(e) => {
                    setLegalRepresentativeName(e.target.value);
                    setIdentityFeedback(null);
                  }} />
                <FormField id="seller-representative-phone"
                  label="شماره موبایل نماینده"
                  placeholder="09xxxxxxxxx"
                  inputMode="numeric" type="tel" maxLength={11}
                  className="field__input--phone"
                  value={legalRepresentativePhone} required
                  disabled={busy || access !== "signedIn"}
                  onChange={(e) => {
                    setLegalRepresentativePhone(e.target.value);
                    setIdentityFeedback(null);
                  }} />
                <p className="seller-identity__legal-note">
                  شماره نماینده باید همان شماره تأییدشده حساب حنا باشد.
                  مدارک تکمیلی در مرحله ۶ تعیین می‌شوند.
                </p>
                <button type="button" className="primary-button"
                  disabled={busy || access !== "signedIn"}
                  onClick={() => void saveLegalIdentity()}>
                  {busy ? "در حال ذخیره…" : "ادامه"}
                </button>
              </div>
            )}

            {completedStep >= 3 && identityStatus && (
              <div className="seller-identity__completed" role="status">
                {applicantType === "NATURAL" ? (
                  <>
                    <strong>اطلاعات هویتی تأیید شد.</strong>
                    <p>کد ملی ثبت‌شده: <bdi dir="ltr">
                      {nationalCodeMasked ?? "—"}
                    </bdi></p>
                  </>
                ) : (
                  <>
                    <strong>اطلاعات شخصیت حقوقی ثبت شد.</strong>
                    <p>
                      {legalName} — شناسه ملی <bdi dir="ltr">
                        {legalNationalId}
                      </bdi>
                    </p>
                    <p>وضعیت فعلی «ثبت اطلاعات» است و معادل احراز یا تأیید نهایی نیست.</p>
                  </>
                )}
                <p>مرحله بعد «اطلاعات کسب‌وکار» است.</p>
              </div>
            )}

            {hasUnsavedIdentityChanges && (
              <p className="seller-unsaved-note" role="status">
                اطلاعات مرحله احراز هویت هنوز روی سرور ثبت نشده است.
              </p>
            )}
            {identityFeedback && (
              <p className={identityFeedback.kind === "error"
                ? "form-status form-status--error"
                : "form-status"}
                role={identityFeedback.kind === "error" ? "alert" : "status"}>
                {identityFeedback.text}
              </p>
            )}
          </section>
        )}
        {completedStep >= 3 && !submittedAtUtc && (
          <section className="seller-business"
            aria-labelledby="seller-business-heading">
            <div className="seller-business__intro">
              <p className="seller-applicant-type__step">مرحله ۴ از ۸</p>
              <h3 id="seller-business-heading">اطلاعات کسب‌وکار</h3>
              <p>
                دسته‌بندی از taxonomy مستقل و بازبینی‌شدهٔ ثبت‌نام فروشنده
                خوانده می‌شود و به‌صورت خودکار از دسته‌بندی کالاها حدس زده نمی‌شود.
              </p>
            </div>

            {completedStep === 3 && (
              <div className="seller-business__body">
                <label className="field" htmlFor="seller-business-category">
                  <span className="field__label">دسته‌بندی کسب‌وکار</span>
                  <select id="seller-business-category"
                    className="field__input"
                    value={businessCategoryId}
                    disabled={busy || access !== "signedIn" ||
                      businessCategoriesState !== "ready"}
                    onChange={(event) => {
                      setBusinessCategoryId(event.target.value);
                      setBusinessFeedback(null);
                    }}>
                    <option value="">
                      {businessCategoriesState === "loading"
                        ? "در حال دریافت دسته‌بندی‌ها…"
                        : "انتخاب دسته‌بندی"}
                    </option>
                    {businessCategories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                {businessCategoriesState === "unconfigured" && (
                  <p className="form-status form-status--error" role="alert">
                    taxonomy دسته‌بندی کسب‌وکار هنوز تنظیم نشده است؛
                    هیچ گزینه نمونه‌ای ساخته نشده و این مرحله قابل ثبت نیست.
                  </p>
                )}
                {businessCategoriesState === "error" && (
                  <p className="form-status form-status--error" role="alert">
                    دسته‌بندی‌های کسب‌وکار قابل دریافت نیستند؛
                    برای جلوگیری از ثبت روی داده نامعتبر، ذخیره غیرفعال است.
                  </p>
                )}

                <FormField id="seller-business-name"
                  label="نام فروشگاه / کسب‌وکار / عنوان ارائه‌دهنده"
                  placeholder="کسب‌وکار نمونه"
                  maxLength={180}
                  value={businessName}
                  required
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setBusinessName(event.target.value);
                    setBusinessFeedback(null);
                  }} />

                <label className="field" htmlFor="seller-business-description">
                  <span className="field__label">توضیح کوتاه فعالیت</span>
                  <textarea id="seller-business-description"
                    className="field__input seller-business__textarea"
                    maxLength={500}
                    rows={4}
                    value={businessDescription}
                    required
                    disabled={busy || access !== "signedIn"}
                    placeholder="توضیح دهید چه کالا یا خدماتی ارائه می‌دهید..."
                    onChange={(event) => {
                      setBusinessDescription(event.target.value);
                      setBusinessFeedback(null);
                    }} />
                </label>

                <FormField id="seller-business-phone"
                  label="شماره تماس کسب‌وکار"
                  placeholder="مثال: ۰۲۱۱۲۳۴۵۶۷۸"
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  className="field__input--phone"
                  value={businessPhone}
                  required
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setBusinessPhone(event.target.value);
                    setBusinessFeedback(null);
                  }} />

                <fieldset className="seller-business__offering">
                  <legend>نوع ارائه / محصول اصلی</legend>
                  <div className="seller-business__offering-options">
                    {([
                      ["GOOD", "کالا"],
                      ["SERVICE", "خدمت"],
                      ["BOTH", "کالا و خدمت"],
                    ] as const).map(([value, label]) => (
                      <button type="button"
                        key={value}
                        className={offeringType === value
                          ? "seller-business__offering-option seller-business__offering-option--selected"
                          : "seller-business__offering-option"}
                        aria-pressed={offeringType === value}
                        disabled={busy || access !== "signedIn"}
                        onClick={() => {
                          setOfferingType(value);
                          setBusinessFeedback(null);
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <button type="button" className="primary-button"
                  disabled={busy || access !== "signedIn" ||
                    businessCategoriesState !== "ready"}
                  onClick={() => void saveBusinessInformation()}>
                  {busy ? "در حال ذخیره…" : "ذخیره و ادامه"}
                </button>

                {hasUnsavedBusinessChanges && (
                  <p className="seller-unsaved-note" role="status">
                    اطلاعات مرحله کسب‌وکار هنوز روی سرور ثبت نشده است.
                  </p>
                )}
              </div>
            )}

            {completedStep >= 4 && (
              <div className="seller-business__completed" role="status">
                <strong>اطلاعات کسب‌وکار ذخیره شد.</strong>
                <dl>
                  <div>
                    <dt>دسته‌بندی</dt>
                    <dd>{businessCategoryName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>نام کسب‌وکار</dt>
                    <dd>{businessName}</dd>
                  </div>
                  <div>
                    <dt>تلفن کسب‌وکار</dt>
                    <dd dir="ltr">{businessPhone}</dd>
                  </div>
                  <div>
                    <dt>نوع ارائه</dt>
                    <dd>{offeringType === "GOOD"
                      ? "کالا"
                      : offeringType === "SERVICE"
                        ? "خدمت"
                        : "کالا و خدمت"}</dd>
                  </div>
                </dl>
                <p>{businessDescription}</p>
                <p>مرحله بعد «محدوده فعالیت» است.</p>
              </div>
            )}

            {businessFeedback && (
              <p className={businessFeedback.kind === "error"
                ? "form-status form-status--error"
                : "form-status"}
                role={businessFeedback.kind === "error" ? "alert" : "status"}>
                {businessFeedback.text}
              </p>
            )}
          </section>
        )}
        {completedStep >= 4 && !submittedAtUtc && (
          <section className="seller-activity"
            aria-labelledby="seller-activity-heading">
            <div className="seller-activity__intro">
              <p className="seller-applicant-type__step">مرحله ۵ از ۸</p>
              <h3 id="seller-activity-heading">محدوده فعالیت</h3>
              <p>
                استان و شهر از فهرست جغرافیای مرجع حنا انتخاب می‌شوند.
                انتخاب شهر به معنی فعال بودن ارسال یا پوشش بازارگاه در آن شهر نیست.
              </p>
            </div>

            {completedStep === 4 && (
              <div className="seller-activity__body">
                {activityGeoState === "error" && (
                  <p className="form-status form-status--error" role="alert">
                    فهرست جغرافیای قابل انتخاب در دسترس نیست؛
                    برای جلوگیری از ثبت شهر نامعتبر، ذخیره غیرفعال است.
                  </p>
                )}

                <label className="field" htmlFor="seller-activity-province">
                  <span className="field__label">استان / شهر</span>
                  <select id="seller-activity-province"
                    className="field__input"
                    value={activityProvinceId}
                    disabled={busy || access !== "signedIn" ||
                      activityGeoState !== "ready"}
                    onChange={(event) => {
                      setActivityProvinceId(event.target.value);
                      setActivityCityId("");
                      setActivityFeedback(null);
                    }}>
                    <option value="">
                      {activityGeoState === "loading"
                        ? "در حال دریافت استان‌ها…"
                        : "استان را انتخاب کنید"}
                    </option>
                    {activityProvinces.map((province) => (
                      <option key={province.id} value={province.id}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" htmlFor="seller-activity-city">
                  <span className="field__label">شهر</span>
                  <select id="seller-activity-city"
                    className="field__input"
                    value={activityCityId}
                    disabled={busy || access !== "signedIn" ||
                      !activityProvinceId || activityGeoState !== "ready"}
                    onChange={(event) => {
                      setActivityCityId(event.target.value);
                      setActivityFeedback(null);
                    }}>
                    <option value="">شهر را انتخاب کنید</option>
                    {activityCities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>

                <FormField id="seller-activity-address"
                  label="آدرس محل فعالیت / فروشگاه"
                  placeholder="مثال: خیابان آزادی، پلاک ۱۲"
                  maxLength={500}
                  value={activityAddress}
                  required
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setActivityAddress(event.target.value);
                    setActivityFeedback(null);
                  }} />

                <div className="seller-activity__map" aria-label="موقعیت روی نقشه">
                  <strong>موقعیت روی نقشه (اختیاری)</strong>
                  <div className="seller-activity__map-placeholder">
                    <span aria-hidden="true">⌖</span>
                    <p>نقشه تعاملی حنا هنوز به قرارداد مختصات متصل نشده است.</p>
                    <small>در این مرحله هیچ مختصات نمونه یا تخمینی ذخیره نمی‌شود.</small>
                  </div>
                </div>

                <FormField id="seller-activity-hours"
                  label="ساعات فعالیت"
                  placeholder="مثال: شنبه تا پنجشنبه، ۸ تا ۲۲"
                  maxLength={180}
                  value={activityHours}
                  required
                  disabled={busy || access !== "signedIn"}
                  onChange={(event) => {
                    setActivityHours(event.target.value);
                    setActivityFeedback(null);
                  }} />

                <fieldset className="seller-activity__delivery">
                  <legend>روش ارائه / تحویل</legend>
                  <label>
                    <input type="checkbox"
                      checked={sellerDelivery}
                      disabled={busy || access !== "signedIn"}
                      onChange={(event) => {
                        setSellerDelivery(event.target.checked);
                        setActivityFeedback(null);
                      }} />
                    <span>ارسال توسط فروشنده</span>
                  </label>
                  <label>
                    <input type="checkbox"
                      checked={pickup}
                      disabled={busy || access !== "signedIn"}
                      onChange={(event) => {
                        setPickup(event.target.checked);
                        setActivityFeedback(null);
                      }} />
                    <span>تحویل حضوری</span>
                  </label>
                </fieldset>

                <FormField id="seller-service-area"
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
          <section className="seller-review" aria-labelledby="seller-review-heading">
            <h3 id="seller-review-heading">بازبینی و ثبت</h3>
            <p>
              اطلاعات مرحله ۶ کامل است. بازبینی نهایی و تأیید صریح صحت
              اطلاعات در مرحله ۷ انجام می‌شود؛ ثبت نهایی از این صفحه
              مستقیماً فعال نیست.
            </p>
            <button type="button" className="auth-card__secondary"
              disabled
              onClick={() => void submitForReview()}>
              ادامه در مرحله ۷
            </button>
          </section>
        )}
        {submittedAtUtc && (
          <section className="seller-review" aria-labelledby="seller-status-heading">
            <h3 id="seller-status-heading">وضعیت درخواست</h3>
            <p role="status">درخواست شما ثبت شده و در انتظار بررسی است.</p>
            <p>زمان ثبت: <time dateTime={submittedAtUtc}>
              {new Intl.DateTimeFormat("fa-IR", {
                dateStyle: "medium", timeStyle: "short",
              }).format(new Date(submittedAtUtc))}
            </time></p>
            <p>این وضعیت هیچ مجوز فروشندگی، دسترسی پنل یا فعال‌سازی فروشگاه ایجاد نمی‌کند.</p>
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
  );
}
