type JsonObject = Record<string, unknown>;

export const sellerReviewStatuses = [
  "UNDER_REVIEW", "NEEDS_INFORMATION", "APPROVED", "REJECTED",
] as const;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const trackingCode = /^HNA-[0-9A-F]{16}$/;
const isRecord = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: JsonObject, keys: string[]) =>
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const validId = (value: unknown): value is string =>
  typeof value === "string" && uuid.test(value) &&
  value !== "00000000-0000-0000-0000-000000000000";
const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  !Number.isNaN(Date.parse(value));
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const nullableText = (value: unknown, max: number) =>
  value === null || text(value, max);
const nullableTimestamp = (value: unknown) =>
  value === null || validTimestamp(value);

const reviewStatus = (value: unknown): value is typeof sellerReviewStatuses[number] =>
  typeof value === "string" &&
  (sellerReviewStatuses as readonly string[]).includes(value);

const listItemKeys = [
  "applicationId", "storeName", "ownerName", "applicantType",
  "identityStatus", "businessCategoryId", "businessName", "offeringType",
  "status", "revision", "trackingCode", "reviewStatus", "reviewedAtUtc",
  "activatedAtUtc", "submittedAtUtc",
];

function parseListItem(value: unknown): JsonObject | null {
  if (!isRecord(value) || !exactKeys(value, listItemKeys) ||
    !validId(value.applicationId) || !text(value.storeName, 200) ||
    !text(value.ownerName, 200) ||
    !(value.applicantType === "NATURAL" || value.applicantType === "LEGAL") ||
    !(value.identityStatus === "VERIFIED" || value.identityStatus === "RECORDED") ||
    !(value.businessCategoryId === null || validId(value.businessCategoryId)) ||
    !nullableText(value.businessName, 200) ||
    !(value.offeringType === null || value.offeringType === "GOOD") ||
    value.status !== "SUBMITTED" || !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1 ||
    typeof value.trackingCode !== "string" || !trackingCode.test(value.trackingCode) ||
    !reviewStatus(value.reviewStatus) || !nullableTimestamp(value.reviewedAtUtc) ||
    !nullableTimestamp(value.activatedAtUtc) || !validTimestamp(value.submittedAtUtc))
    return null;

  return {
    applicationId: value.applicationId,
    storeName: value.storeName,
    ownerName: value.ownerName,
    applicantType: value.applicantType,
    identityStatus: value.identityStatus,
    businessCategoryId: value.businessCategoryId,
    businessName: value.businessName,
    offeringType: value.offeringType,
    status: value.status,
    revision: value.revision,
    trackingCode: value.trackingCode,
    reviewStatus: value.reviewStatus,
    reviewedAtUtc: value.reviewedAtUtc,
    submittedAtUtc: value.submittedAtUtc,
  };
}

export function parseSellerApplicationPage(
  value: unknown, requestedPage: number, requestedSize: number,
): JsonObject | null {
  if (!isRecord(value) || !exactKeys(value, ["items", "page", "pageSize", "total"]) ||
    !Array.isArray(value.items) || value.items.length > requestedSize ||
    value.page !== requestedPage || value.pageSize !== requestedSize ||
    !Number.isSafeInteger(value.total) || (value.total as number) < value.items.length)
    return null;
  const items = value.items.map(parseListItem);
  if (items.some((item) => item === null)) return null;
  return { items, page: requestedPage, pageSize: requestedSize, total: value.total };
}

const detailKeys = [
  "applicationId", "storeName", "ownerName", "applicantType", "identityStatus",
  "nationalCodeMasked", "legalNationalIdMasked", "legalName",
  "legalRepresentativeName", "legalRepresentativePhoneMasked",
  "businessCategoryId", "businessName", "businessDescription", "businessPhone",
  "offeringType", "activityProvinceId", "activityCityId", "activityAddress",
  "activityHours", "sellerDelivery", "pickup", "serviceArea",
  "registrationContactName", "registrationContactRole", "backupPhoneMasked",
  "websiteOrSocial", "businessEmail", "responseHours", "documentsRequired",
  "phoneMasked", "city", "address", "postalCode", "status", "revision",
  "trackingCode", "reviewStatus", "reviewReason", "reviewedAtUtc",
  "activatedAtUtc", "activatedByAccountId", "submittedAtUtc", "reviewHistory",
];

const maskedNationalId = (value: unknown) => value === null ||
  (typeof value === "string" && /^\*{6,7}\d{4}$/.test(value));
const maskedPhone = (value: unknown) => value === null ||
  (typeof value === "string" && /^\d{4}\*{7}$/.test(value));

export function parseSellerApplicationDetail(value: unknown): JsonObject | null {
  if (!isRecord(value) || !exactKeys(value, detailKeys) ||
    !validId(value.applicationId) || !text(value.storeName, 200) ||
    !text(value.ownerName, 200) ||
    !(value.applicantType === "NATURAL" || value.applicantType === "LEGAL") ||
    !(value.identityStatus === "VERIFIED" || value.identityStatus === "RECORDED") ||
    !maskedNationalId(value.nationalCodeMasked) ||
    !maskedNationalId(value.legalNationalIdMasked) ||
    !nullableText(value.legalName, 200) ||
    !nullableText(value.legalRepresentativeName, 200) ||
    !maskedPhone(value.legalRepresentativePhoneMasked) ||
    !(value.businessCategoryId === null || validId(value.businessCategoryId)) ||
    !nullableText(value.businessName, 200) ||
    !nullableText(value.businessDescription, 2000) ||
    !nullableText(value.businessPhone, 32) ||
    !(value.offeringType === null || value.offeringType === "GOOD") ||
    !(value.activityProvinceId === null || validId(value.activityProvinceId)) ||
    !(value.activityCityId === null || validId(value.activityCityId)) ||
    !text(value.activityAddress, 1000) || !text(value.activityHours, 200) ||
    typeof value.sellerDelivery !== "boolean" || typeof value.pickup !== "boolean" ||
    !nullableText(value.serviceArea, 1000) ||
    !text(value.registrationContactName, 200) ||
    !nullableText(value.registrationContactRole, 120) ||
    !maskedPhone(value.backupPhoneMasked) ||
    !nullableText(value.websiteOrSocial, 500) ||
    !nullableText(value.businessEmail, 254) || !text(value.responseHours, 200) ||
    value.documentsRequired !== false || !maskedPhone(value.phoneMasked) ||
    !text(value.city, 120) || !text(value.address, 1000) ||
    !text(value.postalCode, 32) || value.status !== "SUBMITTED" ||
    !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 ||
    typeof value.trackingCode !== "string" || !trackingCode.test(value.trackingCode) ||
    !reviewStatus(value.reviewStatus) ||
    !nullableText(value.reviewReason, 500) ||
    !nullableTimestamp(value.reviewedAtUtc) ||
    (value.reviewStatus === "UNDER_REVIEW"
      ? value.reviewReason !== null || value.reviewedAtUtc !== null
      : value.reviewedAtUtc === null ||
        ((value.reviewStatus === "NEEDS_INFORMATION" ||
          value.reviewStatus === "REJECTED") &&
          (typeof value.reviewReason !== "string" ||
            !value.reviewReason.trim() || value.reviewReason.length > 500))) ||
    !nullableTimestamp(value.activatedAtUtc) ||
    !(value.activatedByAccountId === null || validId(value.activatedByAccountId)) ||
    !validTimestamp(value.submittedAtUtc) || !Array.isArray(value.reviewHistory) ||
    value.reviewHistory.length > 1000)
    return null;

  const reviewHistory = value.reviewHistory.map((entry) => {
    if (!isRecord(entry) || !exactKeys(entry,
      ["expectedRevision", "decision", "reason", "createdAtUtc"]) ||
      !Number.isSafeInteger(entry.expectedRevision) ||
      (entry.expectedRevision as number) < 1 || !reviewStatus(entry.decision) ||
      !(entry.reason === null || text(entry.reason, 500)) ||
      !validTimestamp(entry.createdAtUtc)) return null;
    return {
      expectedRevision: entry.expectedRevision,
      decision: entry.decision,
      reason: entry.reason,
      createdAtUtc: entry.createdAtUtc,
    };
  });
  if (reviewHistory.some((entry) => entry === null)) return null;

  // Explicit projection intentionally excludes activation operator IDs and any
  // future upstream fields from the browser-facing Admin response.
  return {
    applicationId: value.applicationId,
    storeName: value.storeName,
    ownerName: value.ownerName,
    applicantType: value.applicantType,
    identityStatus: value.identityStatus,
    nationalCodeMasked: value.nationalCodeMasked,
    legalNationalIdMasked: value.legalNationalIdMasked,
    legalName: value.legalName,
    legalRepresentativeName: value.legalRepresentativeName,
    legalRepresentativePhoneMasked: value.legalRepresentativePhoneMasked,
    businessCategoryId: value.businessCategoryId,
    businessName: value.businessName,
    businessDescription: value.businessDescription,
    businessPhone: value.businessPhone,
    offeringType: value.offeringType,
    activityProvinceId: value.activityProvinceId,
    activityCityId: value.activityCityId,
    activityAddress: value.activityAddress,
    activityHours: value.activityHours,
    sellerDelivery: value.sellerDelivery,
    pickup: value.pickup,
    serviceArea: value.serviceArea,
    registrationContactName: value.registrationContactName,
    registrationContactRole: value.registrationContactRole,
    backupPhoneMasked: value.backupPhoneMasked,
    websiteOrSocial: value.websiteOrSocial,
    businessEmail: value.businessEmail,
    responseHours: value.responseHours,
    documentsRequired: false,
    phoneMasked: value.phoneMasked,
    city: value.city,
    address: value.address,
    postalCode: value.postalCode,
    status: value.status,
    revision: value.revision,
    trackingCode: value.trackingCode,
    reviewStatus: value.reviewStatus,
    reviewReason: value.reviewReason,
    reviewedAtUtc: value.reviewedAtUtc,
    submittedAtUtc: value.submittedAtUtc,
    reviewHistory,
  };
}

export function validSellerApplicationId(value: string): boolean {
  return validId(value);
}

export function parseSellerReviewResult(
  value: unknown, applicationId: string, expectedRevision: number,
): JsonObject | null {
  if (!isRecord(value) || !exactKeys(value, [
    "applicationId", "status", "revision", "trackingCode", "reviewStatus",
    "reviewReason", "reviewedAtUtc", "sellerActivated",
  ]) || value.applicationId !== applicationId || value.status !== "SUBMITTED" ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < expectedRevision + 1 ||
    typeof value.trackingCode !== "string" || !trackingCode.test(value.trackingCode) ||
    !reviewStatus(value.reviewStatus) || !nullableText(value.reviewReason, 500) ||
    !nullableTimestamp(value.reviewedAtUtc) || value.sellerActivated !== false)
    return null;

  if (value.reviewStatus === "UNDER_REVIEW"
    ? value.reviewReason !== null || value.reviewedAtUtc !== null
    : value.reviewedAtUtc === null ||
      ((value.reviewStatus === "NEEDS_INFORMATION" ||
        value.reviewStatus === "REJECTED") &&
        (typeof value.reviewReason !== "string" ||
          !value.reviewReason.trim() || value.reviewReason.length > 500)))
    return null;

  return {
    applicationId,
    status: "SUBMITTED",
    revision: value.revision,
    trackingCode: value.trackingCode,
    reviewStatus: value.reviewStatus,
    reviewReason: value.reviewReason,
    reviewedAtUtc: value.reviewedAtUtc,
  };
}
