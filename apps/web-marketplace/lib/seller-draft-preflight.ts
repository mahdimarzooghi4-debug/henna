/**
 * Browser-side validation is independent of the Next gateway's validation:
 * a malformed or unavailable response cannot be treated as "no draft".
 */
export type SellerFields = {
  storeName: string;
  ownerName: string;
  phone: string;
  city: string;
  address: string;
  postalCode: string;
};

export const emptySellerFields: SellerFields = {
  storeName: "", ownerName: "", phone: "",
  city: "", address: "", postalCode: "",
};

export const sellerFieldKeys = Object.keys(emptySellerFields) as (keyof SellerFields)[];

export type SellerPreflight =
  | { status: "signedOut" }
  | { status: "unavailable" }
  | { status: "new"; revision: 0 }
  | {
    status: "restored";
    revision: number;
    fields: SellerFields;
    applicantType: "NATURAL" | "LEGAL" | null;
    identityStatus: "VERIFIED" | "RECORDED" | null;
    nationalCodeMasked: string | null;
    legalNationalId: string | null;
    legalName: string | null;
    legalRepresentativeName: string | null;
    legalRepresentativePhone: string | null;
    businessCategoryId: string | null;
    businessCategoryName: string | null;
    businessName: string | null;
    businessDescription: string | null;
    businessPhone: string | null;
    offeringType: "GOOD" | "SERVICE" | "BOTH" | null;
    activityProvinceId: string | null;
    activityProvinceName: string | null;
    activityCityId: string | null;
    activityCityName: string | null;
    activityAddress: string | null;
    activityHours: string | null;
    sellerDelivery: boolean | null;
    pickup: boolean | null;
    serviceArea: string | null;
    registrationContactName: string | null;
    registrationContactRole: string | null;
    backupPhone: string | null;
    websiteOrSocial: string | null;
    businessEmail: string | null;
    responseHours: string | null;
    documentsRequired: false;
    completedStep: number;
  }
  | {
    status: "submitted";
    revision: number;
    fields: SellerFields;
    applicantType: "NATURAL" | "LEGAL";
    identityStatus: "VERIFIED" | "RECORDED";
    nationalCodeMasked: string | null;
    legalNationalId: string | null;
    legalName: string | null;
    legalRepresentativeName: string | null;
    legalRepresentativePhone: string | null;
    businessCategoryId: string | null;
    businessCategoryName: string | null;
    businessName: string | null;
    businessDescription: string | null;
    businessPhone: string | null;
    offeringType: "GOOD" | "SERVICE" | "BOTH" | null;
    activityProvinceId: string | null;
    activityProvinceName: string | null;
    activityCityId: string | null;
    activityCityName: string | null;
    activityAddress: string | null;
    activityHours: string | null;
    sellerDelivery: boolean | null;
    pickup: boolean | null;
    serviceArea: string | null;
    registrationContactName: string | null;
    registrationContactRole: string | null;
    backupPhone: string | null;
    websiteOrSocial: string | null;
    businessEmail: string | null;
    responseHours: string | null;
    documentsRequired: false;
    completedStep: 6;
    submittedAtUtc: string;
  };

export async function loadSellerDraft(
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SellerPreflight> {
  try {
    const response = await fetchFn("/api/seller/registration", {
      cache: "no-store", signal,
    });
    if (response.status === 401) return { status: "signedOut" };
    if (response.status === 404) return { status: "new", revision: 0 };
    if (response.status !== 200) return { status: "unavailable" };

    const draft: unknown = await response.json();
    if (!draft || typeof draft !== "object" ||
      !("status" in draft) ||
      (draft.status !== "DRAFT" && draft.status !== "SUBMITTED") ||
      !("revision" in draft) || typeof draft.revision !== "number" ||
      !Number.isSafeInteger(draft.revision) ||
      draft.revision < 1 || draft.revision >= 2147483647)
      return { status: "unavailable" };

    const values = draft as Record<string, unknown>;
    if (!sellerFieldKeys.every((key) => typeof values[key] === "string"))
      return { status: "unavailable" };

    const fields = Object.fromEntries(sellerFieldKeys.map((key) =>
      [key, values[key]])) as SellerFields;
    // Older in-memory test doubles and pre-migration cached draft responses
    // map to step 1 only; the shipping BFF always emits both fields.
    const applicantType = "applicantType" in draft
      ? draft.applicantType : null;
    const completedStep = "completedStep" in draft
      ? draft.completedStep : 1;
    if ((applicantType !== null &&
        applicantType !== "NATURAL" && applicantType !== "LEGAL") ||
      typeof completedStep !== "number" ||
      !Number.isSafeInteger(completedStep) ||
      completedStep < 1 || completedStep > 6 ||
      (completedStep < 2 && applicantType !== null) ||
      (completedStep >= 2 && applicantType === null))
      return { status: "unavailable" };


    const identityStatus = "identityStatus" in draft
      ? draft.identityStatus : null;
    const nationalCodeMasked = "nationalCodeMasked" in draft
      ? draft.nationalCodeMasked : null;
    const legalNationalId = "legalNationalId" in draft
      ? draft.legalNationalId : null;
    const legalName = "legalName" in draft ? draft.legalName : null;
    const legalRepresentativeName = "legalRepresentativeName" in draft
      ? draft.legalRepresentativeName : null;
    const legalRepresentativePhone = "legalRepresentativePhone" in draft
      ? draft.legalRepresentativePhone : null;

    if (completedStep < 3) {
      if (identityStatus !== null || nationalCodeMasked !== null ||
        legalNationalId !== null || legalName !== null ||
        legalRepresentativeName !== null || legalRepresentativePhone !== null)
        return { status: "unavailable" };
    } else if (applicantType === "NATURAL") {
      if (identityStatus !== "VERIFIED" ||
        typeof nationalCodeMasked !== "string" ||
        !/^\*{6}\d{4}$/.test(nationalCodeMasked) ||
        legalNationalId !== null || legalName !== null ||
        legalRepresentativeName !== null || legalRepresentativePhone !== null)
        return { status: "unavailable" };
    } else {
      if (identityStatus !== "RECORDED" ||
        nationalCodeMasked !== null ||
        typeof legalNationalId !== "string" ||
        !/^\d{11}$/.test(legalNationalId) ||
        typeof legalName !== "string" || !legalName ||
        typeof legalRepresentativeName !== "string" ||
        !legalRepresentativeName ||
        typeof legalRepresentativePhone !== "string" ||
        !/^09\d{9}$/.test(legalRepresentativePhone))
        return { status: "unavailable" };
    }

    const businessCategoryId = "businessCategoryId" in draft
      ? draft.businessCategoryId : null;
    const businessCategoryName = "businessCategoryName" in draft
      ? draft.businessCategoryName : null;
    const businessName = "businessName" in draft
      ? draft.businessName : null;
    const businessDescription = "businessDescription" in draft
      ? draft.businessDescription : null;
    const businessPhone = "businessPhone" in draft
      ? draft.businessPhone : null;
    const offeringType = "offeringType" in draft
      ? draft.offeringType : null;
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (completedStep < 4) {
      if (businessCategoryId !== null || businessCategoryName !== null ||
        businessName !== null || businessDescription !== null ||
        businessPhone !== null || offeringType !== null)
        return { status: "unavailable" };
    } else if (
      typeof businessCategoryId !== "string" ||
      !uuidPattern.test(businessCategoryId) ||
      typeof businessCategoryName !== "string" ||
      !businessCategoryName.trim() || businessCategoryName.length > 120 ||
      typeof businessName !== "string" ||
      !businessName.trim() || businessName.length > 180 ||
      typeof businessDescription !== "string" ||
      !businessDescription.trim() || businessDescription.length > 500 ||
      typeof businessPhone !== "string" ||
      !/^0\d{10}$/.test(businessPhone) ||
      (offeringType !== "GOOD" &&
        offeringType !== "SERVICE" &&
        offeringType !== "BOTH")
    ) {
      return { status: "unavailable" };
    }

    const activityProvinceId = "activityProvinceId" in draft
      ? draft.activityProvinceId : null;
    const activityProvinceName = "activityProvinceName" in draft
      ? draft.activityProvinceName : null;
    const activityCityId = "activityCityId" in draft
      ? draft.activityCityId : null;
    const activityCityName = "activityCityName" in draft
      ? draft.activityCityName : null;
    const activityAddress = "activityAddress" in draft
      ? draft.activityAddress : null;
    const activityHours = "activityHours" in draft
      ? draft.activityHours : null;
    const sellerDelivery = "sellerDelivery" in draft
      ? draft.sellerDelivery : null;
    const pickup = "pickup" in draft ? draft.pickup : null;
    const serviceArea = "serviceArea" in draft
      ? draft.serviceArea : null;

    if (completedStep < 5) {
      if (activityProvinceId !== null || activityProvinceName !== null ||
        activityCityId !== null || activityCityName !== null ||
        activityAddress !== null || activityHours !== null ||
        sellerDelivery !== null || pickup !== null || serviceArea !== null)
        return { status: "unavailable" };
    } else if (
      typeof activityProvinceId !== "string" ||
      !uuidPattern.test(activityProvinceId) ||
      typeof activityProvinceName !== "string" ||
      !activityProvinceName.trim() || activityProvinceName.length > 120 ||
      typeof activityCityId !== "string" ||
      !uuidPattern.test(activityCityId) ||
      typeof activityCityName !== "string" ||
      !activityCityName.trim() || activityCityName.length > 120 ||
      typeof activityAddress !== "string" ||
      !activityAddress.trim() || activityAddress.length > 500 ||
      typeof activityHours !== "string" ||
      !activityHours.trim() || activityHours.length > 180 ||
      typeof sellerDelivery !== "boolean" ||
      typeof pickup !== "boolean" ||
      (!sellerDelivery && !pickup) ||
      typeof serviceArea !== "string" ||
      !serviceArea.trim() || serviceArea.length > 240
    ) {
      return { status: "unavailable" };
    }

    const registrationContactName =
      "registrationContactName" in draft
        ? draft.registrationContactName : null;
    const registrationContactRole =
      "registrationContactRole" in draft
        ? draft.registrationContactRole : null;
    const backupPhone = "backupPhone" in draft
      ? draft.backupPhone : null;
    const websiteOrSocial = "websiteOrSocial" in draft
      ? draft.websiteOrSocial : null;
    const businessEmail = "businessEmail" in draft
      ? draft.businessEmail : null;
    const responseHours = "responseHours" in draft
      ? draft.responseHours : null;
    const documentsRequired = "documentsRequired" in draft
      ? draft.documentsRequired : false;
    const validOptionalText = (
      value: unknown, max: number,
    ) => value === null ||
      (typeof value === "string" &&
        value.trim().length > 0 && value.length <= max &&
        !/[\u0000-\u001f\u007f]/.test(value));

    if (completedStep < 6) {
      if (registrationContactName !== null ||
        registrationContactRole !== null ||
        backupPhone !== null || websiteOrSocial !== null ||
        businessEmail !== null || responseHours !== null)
        return { status: "unavailable" };
    } else if (
      typeof registrationContactName !== "string" ||
      !registrationContactName.trim() ||
      registrationContactName.length > 120 ||
      !validOptionalText(registrationContactRole, 120) ||
      !validOptionalText(websiteOrSocial, 300) ||
      !validOptionalText(businessEmail, 254) ||
      (backupPhone !== null &&
        (typeof backupPhone !== "string" ||
          !/^09\d{9}$/.test(backupPhone))) ||
      typeof responseHours !== "string" ||
      !responseHours.trim() || responseHours.length > 180 ||
      documentsRequired !== false
    ) {
      return { status: "unavailable" };
    }

    if (draft.status === "SUBMITTED") {
      if (!("submittedAtUtc" in draft) ||
        typeof draft.submittedAtUtc !== "string" ||
        Number.isNaN(Date.parse(draft.submittedAtUtc)))
        return { status: "unavailable" };
      return {
        status: "submitted",
        revision: draft.revision,
        fields,
        applicantType: applicantType as "NATURAL" | "LEGAL",
        identityStatus: identityStatus as "VERIFIED" | "RECORDED",
        nationalCodeMasked: nationalCodeMasked as string | null,
        legalNationalId: legalNationalId as string | null,
        legalName: legalName as string | null,
        legalRepresentativeName: legalRepresentativeName as string | null,
        legalRepresentativePhone: legalRepresentativePhone as string | null,
        businessCategoryId: businessCategoryId as string | null,
        businessCategoryName: businessCategoryName as string | null,
        businessName: businessName as string | null,
        businessDescription: businessDescription as string | null,
        businessPhone: businessPhone as string | null,
        offeringType: offeringType as "GOOD" | "SERVICE" | "BOTH" | null,
        activityProvinceId: activityProvinceId as string | null,
        activityProvinceName: activityProvinceName as string | null,
        activityCityId: activityCityId as string | null,
        activityCityName: activityCityName as string | null,
        activityAddress: activityAddress as string | null,
        activityHours: activityHours as string | null,
        sellerDelivery: sellerDelivery as boolean | null,
        pickup: pickup as boolean | null,
        serviceArea: serviceArea as string | null,
        registrationContactName: registrationContactName as string | null,
        registrationContactRole: registrationContactRole as string | null,
        backupPhone: backupPhone as string | null,
        websiteOrSocial: websiteOrSocial as string | null,
        businessEmail: businessEmail as string | null,
        responseHours: responseHours as string | null,
        documentsRequired: false,
        completedStep: 6,
        submittedAtUtc: draft.submittedAtUtc,
      };
    }
    return {
      status: "restored",
      revision: draft.revision,
      fields,
      applicantType: applicantType as "NATURAL" | "LEGAL" | null,
      identityStatus: identityStatus as "VERIFIED" | "RECORDED" | null,
      nationalCodeMasked: nationalCodeMasked as string | null,
      legalNationalId: legalNationalId as string | null,
      legalName: legalName as string | null,
      legalRepresentativeName: legalRepresentativeName as string | null,
      legalRepresentativePhone: legalRepresentativePhone as string | null,
      businessCategoryId: businessCategoryId as string | null,
      businessCategoryName: businessCategoryName as string | null,
      businessName: businessName as string | null,
      businessDescription: businessDescription as string | null,
      businessPhone: businessPhone as string | null,
      offeringType: offeringType as "GOOD" | "SERVICE" | "BOTH" | null,
      activityProvinceId: activityProvinceId as string | null,
      activityProvinceName: activityProvinceName as string | null,
      activityCityId: activityCityId as string | null,
      activityCityName: activityCityName as string | null,
      activityAddress: activityAddress as string | null,
      activityHours: activityHours as string | null,
      sellerDelivery: sellerDelivery as boolean | null,
      pickup: pickup as boolean | null,
      serviceArea: serviceArea as string | null,
      registrationContactName: registrationContactName as string | null,
      registrationContactRole: registrationContactRole as string | null,
      backupPhone: backupPhone as string | null,
      websiteOrSocial: websiteOrSocial as string | null,
      businessEmail: businessEmail as string | null,
      responseHours: responseHours as string | null,
      documentsRequired: false,
      completedStep,
    };
  } catch {
    return { status: "unavailable" };
  }
}
