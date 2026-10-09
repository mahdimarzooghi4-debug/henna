import {
  adminOperationId,
  type AdminOperationIntent,
} from "./admin-operations.ts";

const storageKey = "hana.admin.operations.pending.v1";
const maxStored = 20000;

function row(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function safeInt(value: unknown, min = 0) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min;
}

function text(value: unknown) {
  return typeof value === "string" &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function uuidArray(value: unknown) {
  return Array.isArray(value) && value.length > 0 &&
    value.every(item => adminOperationId(item));
}

export const adminRetryActions = [
  "SET_STAFF_PERMISSION",
  "SAVE_CONTENT",
  "PUBLISH_CONTENT",
  "CREATE_ORGANIZATION",
  "GRANT_ORGANIZATION_MEMBER",
  "REVOKE_ORGANIZATION_MEMBER",
  "SET_FEE_POLICY",
  "LINK_HOUSEHOLD",
  "CREATE_PROGRAM",
  "ALLOCATE_CREDIT",
  "BUILD_SETTLEMENTS",
  "ASSESS_WITHDRAWAL_SLA",
] as const;

export type AdminRetryAction = typeof adminRetryActions[number];

export function adminRetrySuccessMessage(action: string) {
  const messages: Record<AdminRetryAction, string> = {
    SET_STAFF_PERMISSION: "مجوز تخصصی کاربر ثبت شد.",
    SAVE_CONTENT: "محتوا با نسخه جدید ذخیره شد.",
    PUBLISH_CONTENT: "وضعیت انتشار محتوا ثبت شد.",
    CREATE_ORGANIZATION: "سازمان ثبت شد.",
    GRANT_ORGANIZATION_MEMBER: "عضویت سازمانی ثبت شد.",
    REVOKE_ORGANIZATION_MEMBER: "عضویت سازمانی لغو شد.",
    SET_FEE_POLICY:
      "نسخه کارمزد ثبت شد؛ هیچ پرداخت بانکی انجام نشده است.",
    LINK_HOUSEHOLD: "پیوند خانوار ثبت شد.",
    CREATE_PROGRAM:
      "برنامه اعتبار ثبت شد؛ تأمین مالی بیرونی از این عملیات استنتاج نمی‌شود.",
    ALLOCATE_CREDIT: "تخصیص اعتبار با فرمول سرور ثبت شد.",
    BUILD_SETTLEMENTS:
      "تسویه‌های واجد شرایط فقط آماده شدند؛ انتقال بانکی انجام نشده است.",
    ASSESS_WITHDRAWAL_SLA:
      "SLA برداشت‌های معوق ارزیابی شد؛ انتقال بانکی انجام نشده است.",
  };
  return action in messages
    ? messages[action as AdminRetryAction]
    : "عملیات مدیریتی ثبت شد.";
}

function validActionBody(action: string, body: unknown) {
  const value = row(body);
  if (!value) return false;

  if (action === "SET_STAFF_PERMISSION")
    return exactKeys(value, ["accountId", "permission", "active"]) &&
      adminOperationId(value.accountId) &&
      ["FINANCE", "SUPPORT"].includes(String(value.permission)) &&
      typeof value.active === "boolean";

  if (action === "SAVE_CONTENT")
    return exactKeys(value, ["slug", "title", "text", "expectedVersion"]) &&
      text(value.slug) && text(value.title) && text(value.text) &&
      safeInt(value.expectedVersion);

  if (action === "PUBLISH_CONTENT")
    return exactKeys(value, ["contentId", "published", "expectedVersion"]) &&
      adminOperationId(value.contentId) &&
      typeof value.published === "boolean" &&
      safeInt(value.expectedVersion);

  if (action === "CREATE_ORGANIZATION")
    return exactKeys(value, ["name", "registrationReference"]) &&
      text(value.name) && text(value.registrationReference);

  if (action === "GRANT_ORGANIZATION_MEMBER")
    return exactKeys(value, ["organizationId", "accountId", "role"]) &&
      adminOperationId(value.organizationId) &&
      adminOperationId(value.accountId) &&
      ["MANAGER", "BENEFICIARY"].includes(String(value.role));

  if (action === "REVOKE_ORGANIZATION_MEMBER")
    return exactKeys(value, ["membershipId"]) &&
      adminOperationId(value.membershipId);

  if (action === "SET_FEE_POLICY")
    return exactKeys(value, [
      "version", "fixedInvoiceFeeRial", "approvalReference",
    ]) &&
      text(value.version) && safeInt(value.fixedInvoiceFeeRial) &&
      text(value.approvalReference);

  if (action === "LINK_HOUSEHOLD")
    return exactKeys(value, [
      "accountId", "householdKey", "evidenceReference",
    ]) &&
      adminOperationId(value.accountId) &&
      adminOperationId(value.householdKey) &&
      text(value.evidenceReference);

  if (action === "CREATE_PROGRAM")
    return exactKeys(value, [
      "name", "fundingReference", "fundedRial", "expiresAtUtc",
      "categoryIds", "organizationId",
    ]) &&
      text(value.name) && text(value.fundingReference) &&
      safeInt(value.fundedRial) &&
      typeof value.expiresAtUtc === "string" &&
      Number.isFinite(Date.parse(value.expiresAtUtc)) &&
      uuidArray(value.categoryIds) &&
      (value.organizationId === null || adminOperationId(value.organizationId));

  if (action === "ALLOCATE_CREDIT")
    return exactKeys(value, ["programId", "poolRial", "beneficiaries"]) &&
      adminOperationId(value.programId) && safeInt(value.poolRial) &&
      Array.isArray(value.beneficiaries) && value.beneficiaries.length > 0;

  if (action === "BUILD_SETTLEMENTS" ||
      action === "ASSESS_WITHDRAWAL_SLA")
    return exactKeys(value, []);

  return false;
}

function parse(raw: string | null): AdminOperationIntent | null {
  if (raw === null) return null;
  if (raw.length > maxStored)
    throw Error("Pending admin operation is too large.");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw Error("Pending admin operation is invalid.");
  }
  const value = row(parsed);
  if (!value ||
      !exactKeys(value, ["version", "action", "body", "key"]) ||
      value.version !== 1 ||
      typeof value.action !== "string" ||
      !adminRetryActions.includes(value.action as AdminRetryAction) ||
      typeof value.body !== "string" ||
      !adminOperationId(value.key))
    throw Error("Pending admin operation is invalid.");

  let body: unknown;
  try { body = JSON.parse(value.body); } catch {
    throw Error("Pending admin operation body is invalid.");
  }
  if (!validActionBody(value.action, body) ||
      JSON.stringify(body) !== value.body)
    throw Error("Pending admin operation body is invalid.");

  return Object.freeze({
    action: value.action,
    body: value.body,
    key: value.key,
  });
}

function storage(): Storage {
  if (typeof window === "undefined")
    throw Error("Pending admin operation storage unavailable.");
  try {
    return window.sessionStorage;
  } catch {
    throw Error("Pending admin operation storage unavailable.");
  }
}

export function restoreAdminOperationIntent(): AdminOperationIntent | null {
  return parse(storage().getItem(storageKey));
}

export function persistAdminOperationIntent(intent: AdminOperationIntent) {
  if (!adminOperationId(intent.key) ||
      !adminRetryActions.includes(intent.action as AdminRetryAction))
    throw Error("Pending admin operation is invalid.");

  let body: unknown;
  try { body = JSON.parse(intent.body); } catch {
    throw Error("Pending admin operation is invalid.");
  }
  if (!validActionBody(intent.action, body) ||
      JSON.stringify(body) !== intent.body)
    throw Error("Pending admin operation is invalid.");

  const store = storage();
  const existing = store.getItem(storageKey);
  if (existing !== null) {
    const restored = parse(existing);
    if (!restored || restored.key !== intent.key ||
        restored.action !== intent.action || restored.body !== intent.body)
      throw Error("Another pending admin operation must be resolved first.");
    return;
  }

  const record = JSON.stringify({
    version: 1,
    action: intent.action,
    body: intent.body,
    key: intent.key,
  });
  if (record.length > maxStored)
    throw Error("Pending admin operation is too large.");
  store.setItem(storageKey, record);
}

export function clearAdminOperationIntent(expectedKey: string) {
  if (!adminOperationId(expectedKey)) return false;
  let store: Storage;
  try { store = storage(); } catch { return false; }

  const raw = store.getItem(storageKey);
  if (raw === null) return true;

  let restored: AdminOperationIntent | null;
  try { restored = parse(raw); } catch { return false; }
  if (!restored || restored.key !== expectedKey) return false;
  store.removeItem(storageKey);
  return true;
}
