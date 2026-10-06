import { commerceId } from "../../../packages/buyer-commerce/contracts.ts";
import type { StaffIntent } from "./staff-commerce";

const storageKey = "hana.support.pending-decision.v1";
const maxStored = 6000;

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

function cleanReason(value: unknown) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1000 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

export type SupportDecisionDetails = {
  incidentId: string;
  decision: "APPROVE" | "REJECT";
  reason: string;
};

export function supportDecisionIntentDetails(
  intent: Pick<StaffIntent, "path" | "body">,
): SupportDecisionDetails | null {
  const match = /^incidents\/([0-9a-f-]+)\/decision$/i.exec(intent.path);
  if (!match || !commerceId(match[1]) || intent.body.length > 4096) return null;

  let body: unknown;
  try { body = JSON.parse(intent.body); } catch { return null; }
  const value = row(body);
  if (!value ||
      !exactKeys(value, ["decision", "reason"]) ||
      !["APPROVE", "REJECT"].includes(String(value.decision)) ||
      !cleanReason(value.reason) ||
      JSON.stringify(value) !== intent.body)
    return null;

  return {
    incidentId: match[1],
    decision: value.decision as "APPROVE" | "REJECT",
    reason: value.reason as string,
  };
}

function parse(raw: string | null): StaffIntent | null {
  if (raw === null) return null;
  if (raw.length > maxStored)
    throw Error("Pending support decision is too large.");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw Error("Pending support decision is invalid.");
  }
  const value = row(parsed);
  if (!value ||
      !exactKeys(value, ["version", "path", "body", "key"]) ||
      value.version !== 1 ||
      typeof value.path !== "string" ||
      typeof value.body !== "string" ||
      !commerceId(value.key))
    throw Error("Pending support decision is invalid.");

  const intent = {
    path: value.path,
    body: value.body,
    key: value.key,
  } as StaffIntent;
  if (!supportDecisionIntentDetails(intent))
    throw Error("Pending support decision is invalid.");

  return Object.freeze(intent);
}

function storage(): Storage {
  if (typeof window === "undefined")
    throw Error("Pending support decision storage unavailable.");
  try {
    return window.sessionStorage;
  } catch {
    throw Error("Pending support decision storage unavailable.");
  }
}

export function restoreSupportDecisionIntent(): StaffIntent | null {
  return parse(storage().getItem(storageKey));
}

export function persistSupportDecisionIntent(intent: StaffIntent) {
  if (!commerceId(intent.key) || !supportDecisionIntentDetails(intent))
    throw Error("Pending support decision is invalid.");

  const store = storage();
  const existing = store.getItem(storageKey);
  if (existing !== null) {
    const restored = parse(existing);
    if (!restored || restored.key !== intent.key ||
        restored.path !== intent.path || restored.body !== intent.body)
      throw Error("Another pending support decision must be resolved first.");
    return;
  }

  const record = JSON.stringify({
    version: 1,
    path: intent.path,
    body: intent.body,
    key: intent.key,
  });
  if (record.length > maxStored)
    throw Error("Pending support decision is too large.");
  store.setItem(storageKey, record);
}

export function clearSupportDecisionIntent(expectedKey: string) {
  if (!commerceId(expectedKey)) return false;
  let store: Storage;
  try { store = storage(); } catch { return false; }

  const raw = store.getItem(storageKey);
  if (raw === null) return true;

  let restored: StaffIntent | null;
  try { restored = parse(raw); } catch { return false; }
  if (!restored || restored.key !== expectedKey) return false;
  store.removeItem(storageKey);
  return true;
}
