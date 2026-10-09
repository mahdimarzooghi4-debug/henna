import {
  adminSellerId,
  type AdminSellerIntent,
} from "./admin-sellers.ts";

const storageKey = "hana.admin.sellers.pending.v1";
const maxStored = 5000;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Decision = "APPROVED" | "NEEDS_INFORMATION" | "REJECTED";

export type AdminSellerPendingDetails =
  | {
    kind: "review";
    applicationId: string;
    revision: number;
    decision: Decision;
    reason: string;
  }
  | {
    kind: "activate" | "restore";
    applicationId: string;
    revision: number;
  }
  | {
    kind: "suspend";
    applicationId: string;
    revision: number;
    reason: string;
  };

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

function revision(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
}

function reason(value: unknown) {
  return typeof value === "string" &&
    value.length > 0 && value.length <= 500 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

export function adminSellerPendingDetails(
  intent: Pick<AdminSellerIntent, "path" | "body">,
): AdminSellerPendingDetails | null {
  if (intent.body.length > 3000) return null;
  const match = /^([0-9a-f-]+)\/(review|activate|suspend|restore)$/i
    .exec(intent.path);
  if (!match || !adminSellerId(match[1])) return null;

  let raw: unknown;
  try { raw = JSON.parse(intent.body); } catch { return null; }
  const value = row(raw);
  if (!value || JSON.stringify(value) !== intent.body) return null;

  if (match[2] === "review") {
    if (!exactKeys(value, ["revision", "decision", "reason"]) ||
        !revision(value.revision) ||
        !["APPROVED", "NEEDS_INFORMATION", "REJECTED"]
          .includes(String(value.decision)) ||
        !reason(value.reason))
      return null;
    return {
      kind: "review",
      applicationId: match[1],
      revision: value.revision,
      decision: value.decision as Decision,
      reason: value.reason as string,
    };
  }

  if (match[2] === "suspend") {
    if (!exactKeys(value, ["revision", "reason"]) ||
        !revision(value.revision) || !reason(value.reason))
      return null;
    return {
      kind: "suspend",
      applicationId: match[1],
      revision: value.revision,
      reason: value.reason as string,
    };
  }

  if (!exactKeys(value, ["revision"]) || !revision(value.revision))
    return null;
  return {
    kind: match[2] as "activate" | "restore",
    applicationId: match[1],
    revision: value.revision,
  };
}

function parse(raw: string | null): AdminSellerIntent | null {
  if (raw === null) return null;
  if (raw.length > maxStored)
    throw Error("Pending admin seller operation is too large.");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw Error("Pending admin seller operation is invalid.");
  }
  const value = row(parsed);
  if (!value ||
      !exactKeys(value, ["version", "path", "body", "key"]) ||
      value.version !== 1 ||
      typeof value.path !== "string" ||
      typeof value.body !== "string" ||
      typeof value.key !== "string" || !uuid.test(value.key))
    throw Error("Pending admin seller operation is invalid.");

  const intent = {
    path: value.path,
    body: value.body,
    key: value.key,
  } as AdminSellerIntent;
  if (!adminSellerPendingDetails(intent))
    throw Error("Pending admin seller operation is invalid.");
  return Object.freeze(intent);
}

function storage(): Storage {
  if (typeof window === "undefined")
    throw Error("Pending admin seller storage unavailable.");
  try {
    return window.sessionStorage;
  } catch {
    throw Error("Pending admin seller storage unavailable.");
  }
}

export function restoreAdminSellerIntent() {
  return parse(storage().getItem(storageKey));
}

export function persistAdminSellerIntent(intent: AdminSellerIntent) {
  if (!uuid.test(intent.key) || !adminSellerPendingDetails(intent))
    throw Error("Pending admin seller operation is invalid.");

  const store = storage();
  const existing = store.getItem(storageKey);
  if (existing !== null) {
    const restored = parse(existing);
    if (!restored || restored.key !== intent.key ||
        restored.path !== intent.path || restored.body !== intent.body)
      throw Error("Another pending admin seller operation must be resolved first.");
    return;
  }

  const record = JSON.stringify({
    version: 1,
    path: intent.path,
    body: intent.body,
    key: intent.key,
  });
  if (record.length > maxStored)
    throw Error("Pending admin seller operation is too large.");
  store.setItem(storageKey, record);
}

export function clearAdminSellerIntent(expectedKey: string) {
  if (!uuid.test(expectedKey)) return false;
  let store: Storage;
  try { store = storage(); } catch { return false; }

  const raw = store.getItem(storageKey);
  if (raw === null) return true;
  let restored: AdminSellerIntent | null;
  try { restored = parse(raw); } catch { return false; }
  if (!restored || restored.key !== expectedKey) return false;
  store.removeItem(storageKey);
  return true;
}

export function adminSellerSuccessMessage(
  details: AdminSellerPendingDetails,
) {
  return details.kind === "activate"
    ? "نقش فروشنده و دسترسی پنل با پاسخ واقعی سرور فعال شد."
    : details.kind === "suspend"
      ? "دسترسی فروشنده با پاسخ واقعی سرور معلق شد."
      : details.kind === "restore"
        ? "دسترسی فروشنده با پاسخ واقعی سرور بازگردانی شد."
        : "نتیجه بررسی و نسخه جدید پرونده در سرور ثبت شد.";
}
