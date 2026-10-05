export const adminSellerId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) &&
  value !== "00000000-0000-0000-0000-000000000000";

type Row = Record<string, unknown>;
const row = (value: unknown): Row | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Row : null;
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const optionalText = (value: unknown, max: number): value is string | null =>
  value === null || text(value, max);
const int = (value: unknown, min = 0, max = 2147483647): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) &&
  value >= min && value <= max;
const utc = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 50 &&
  Number.isFinite(Date.parse(value));
const optionalUtc = (value: unknown): value is string | null =>
  value === null || utc(value);

export type AdminSellerListItem = {
  id: string;
  storeName: string;
  businessName: string | null;
  applicantType: "NATURAL" | "LEGAL";
  identityStatus: string;
  offeringType: "GOOD" | "SERVICE" | "BOTH";
  revision: number;
  trackingCode: string;
  reviewStatus: "UNDER_REVIEW" | "NEEDS_INFORMATION" | "APPROVED" | "REJECTED";
  reviewedAtUtc: string | null;
  activatedAtUtc: string | null;
  submittedAtUtc: string;
};

export type AdminSellerDetail = AdminSellerListItem & {
  ownerName: string;
  nationalCodeMasked: string | null;
  legalNationalId: string | null;
  legalName: string | null;
  legalRepresentativeName: string | null;
  legalRepresentativePhoneMasked: string | null;
  businessDescription: string;
  businessPhone: string;
  activityAddress: string;
  activityHours: string;
  sellerDelivery: boolean;
  pickup: boolean;
  serviceArea: string;
  registrationContactName: string;
  registrationContactRole: string;
  backupPhoneMasked: string | null;
  websiteOrSocial: string | null;
  businessEmail: string | null;
  responseHours: string;
  phoneMasked: string;
  city: string;
  address: string;
  postalCode: string;
  reviewReason: string | null;
};

export type AdminSellerMutation = {
  id: string;
  revision: number;
  reviewStatus: AdminSellerListItem["reviewStatus"];
  reviewReason: string | null;
  reviewedAtUtc?: string | null;
  activatedAtUtc?: string | null;
  sellerActivated?: boolean;
  sellerRoleGranted?: boolean;
  sellerAccessEnabled?: boolean;
  sellerPanelEnabled?: boolean;
};

function reviewStatus(value: unknown):
  value is AdminSellerListItem["reviewStatus"] {
  return ["UNDER_REVIEW", "NEEDS_INFORMATION", "APPROVED", "REJECTED"]
    .includes(String(value));
}
function offering(value: unknown):
  value is AdminSellerListItem["offeringType"] {
  return ["GOOD", "SERVICE", "BOTH"].includes(String(value));
}
function applicant(value: unknown):
  value is AdminSellerListItem["applicantType"] {
  return ["NATURAL", "LEGAL"].includes(String(value));
}

function parseListItem(value: unknown): AdminSellerListItem | null {
  const x = row(value);
  const identifier = x?.applicationId ?? x?.id;
  if (!x || !adminSellerId(identifier) ||
      !text(x.storeName, 200) ||
      !(x.businessName === null || text(x.businessName, 200)) ||
      !applicant(x.applicantType) || !text(x.identityStatus, 40) ||
      !offering(x.offeringType) || !int(x.revision, 1) ||
      !text(x.trackingCode, 40) ||
      !/^HNA-[0-9A-F]{16}$/.test(x.trackingCode) ||
      !reviewStatus(x.reviewStatus) || !optionalUtc(x.reviewedAtUtc) ||
      !optionalUtc(x.activatedAtUtc) || !utc(x.submittedAtUtc))
    return null;
  return {
    id: identifier,
    storeName: x.storeName.trim(),
    businessName: x.businessName === null ? null : x.businessName.trim(),
    applicantType: x.applicantType,
    identityStatus: x.identityStatus.trim(),
    offeringType: x.offeringType,
    revision: x.revision,
    trackingCode: x.trackingCode,
    reviewStatus: x.reviewStatus,
    reviewedAtUtc: x.reviewedAtUtc,
    activatedAtUtc: x.activatedAtUtc,
    submittedAtUtc: x.submittedAtUtc,
  };
}

export function parseAdminSellerList(
  value: unknown,
  expectedPage: number,
): { items: AdminSellerListItem[]; total: number } | null {
  const x = row(value);
  if (!x || x.page !== expectedPage || x.pageSize !== 20 ||
      !int(x.total) || !Array.isArray(x.items) || x.items.length > 20)
    return null;
  const items: AdminSellerListItem[] = [];
  for (const raw of x.items) {
    const parsed = parseListItem(raw);
    if (!parsed) return null;
    items.push(parsed);
  }
  if (x.total < items.length) return null;
  return { items, total: x.total };
}

export function parseAdminSellerDetail(
  value: unknown,
  expectedId: string,
): AdminSellerDetail | null {
  const x = row(value);
  if (!x || x.applicationId !== expectedId || !adminSellerId(expectedId))
    return null;
  const list = parseListItem({
    applicationId: x.applicationId,
    storeName: x.storeName,
    businessName: x.businessName,
    applicantType: x.applicantType,
    identityStatus: x.identityStatus,
    offeringType: x.offeringType,
    revision: x.revision,
    trackingCode: x.trackingCode,
    reviewStatus: x.reviewStatus,
    reviewedAtUtc: x.reviewedAtUtc,
    activatedAtUtc: x.activatedAtUtc,
    submittedAtUtc: x.submittedAtUtc,
  });
  if (!list || !text(x.ownerName, 200) ||
      !optionalText(x.nationalCodeMasked, 20) ||
      !optionalText(x.legalNationalId, 40) ||
      !optionalText(x.legalName, 200) ||
      !optionalText(x.legalRepresentativeName, 200) ||
      !optionalText(x.legalRepresentativePhoneMasked, 20) ||
      !text(x.businessDescription, 2000) ||
      !text(x.businessPhone, 30) || !text(x.activityAddress, 1000) ||
      !text(x.activityHours, 500) || typeof x.sellerDelivery !== "boolean" ||
      typeof x.pickup !== "boolean" || !text(x.serviceArea, 500) ||
      !text(x.registrationContactName, 200) ||
      !text(x.registrationContactRole, 200) ||
      !optionalText(x.backupPhoneMasked, 20) ||
      !optionalText(x.websiteOrSocial, 500) ||
      !optionalText(x.businessEmail, 320) ||
      !text(x.responseHours, 500) || !text(x.phoneMasked, 20) ||
      !text(x.city, 200) || !text(x.address, 1000) ||
      !text(x.postalCode, 30) || !optionalText(x.reviewReason, 500))
    return null;
  return {
    ...list,
    ownerName: x.ownerName.trim(),
    nationalCodeMasked: x.nationalCodeMasked,
    legalNationalId: x.legalNationalId,
    legalName: x.legalName,
    legalRepresentativeName: x.legalRepresentativeName,
    legalRepresentativePhoneMasked: x.legalRepresentativePhoneMasked,
    businessDescription: x.businessDescription.trim(),
    businessPhone: x.businessPhone.trim(),
    activityAddress: x.activityAddress.trim(),
    activityHours: x.activityHours.trim(),
    sellerDelivery: x.sellerDelivery,
    pickup: x.pickup,
    serviceArea: x.serviceArea.trim(),
    registrationContactName: x.registrationContactName.trim(),
    registrationContactRole: x.registrationContactRole.trim(),
    backupPhoneMasked: x.backupPhoneMasked,
    websiteOrSocial: x.websiteOrSocial,
    businessEmail: x.businessEmail,
    responseHours: x.responseHours.trim(),
    phoneMasked: x.phoneMasked.trim(),
    city: x.city.trim(),
    address: x.address.trim(),
    postalCode: x.postalCode.trim(),
    reviewReason: x.reviewReason,
  };
}

export function parseAdminSellerMutation(
  value: unknown,
  expectedId: string,
): AdminSellerMutation | null {
  const x = row(value);
  if (!x || x.applicationId !== expectedId ||
      !adminSellerId(expectedId) || !int(x.revision, 1) ||
      !reviewStatus(x.reviewStatus) ||
      !(x.reviewReason === undefined ||
        optionalText(x.reviewReason, 500)) ||
      !(x.reviewedAtUtc === undefined || optionalUtc(x.reviewedAtUtc)) ||
      !(x.activatedAtUtc === undefined || optionalUtc(x.activatedAtUtc)))
    return null;
  for (const key of [
    "sellerActivated", "sellerRoleGranted",
    "sellerAccessEnabled", "sellerPanelEnabled",
  ] as const) {
    if (x[key] !== undefined && typeof x[key] !== "boolean") return null;
  }
  return {
    id: x.applicationId,
    revision: x.revision,
    reviewStatus: x.reviewStatus,
    reviewReason: x.reviewReason === undefined ? null : x.reviewReason,
    reviewedAtUtc: x.reviewedAtUtc,
    activatedAtUtc: x.activatedAtUtc,
    sellerActivated: x.sellerActivated as boolean | undefined,
    sellerRoleGranted: x.sellerRoleGranted as boolean | undefined,
    sellerAccessEnabled: x.sellerAccessEnabled as boolean | undefined,
    sellerPanelEnabled: x.sellerPanelEnabled as boolean | undefined,
  };
}

export type AdminSellerIntent = {
  path: string;
  body: string;
  key: string;
};
export function adminSellerIntent(
  previous: AdminSellerIntent | null,
  path: string,
  input: unknown,
): AdminSellerIntent {
  const body = JSON.stringify(input);
  return previous?.path === path && previous.body === body
    ? previous
    : { path, body, key: crypto.randomUUID() };
}

export const adminSellerTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value)) : "—";
