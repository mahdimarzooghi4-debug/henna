import { commerceId } from "../../../packages/buyer-commerce/contracts.ts";
import type { StaffIntent } from "./staff-commerce";

const storageKey = "hana.support.pending-operations.v1";
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

export type SupportOperationDetails =
  | { kind: "return-sla" }
  | { kind: "unavailability"; incidentId: string; reason: string };

export function supportOperationIntentDetails(
  intent: Pick<StaffIntent, "path" | "body">,
): SupportOperationDetails | null {
  if (intent.body.length > 4096) return null;

  let body: unknown;
  try { body = JSON.parse(intent.body); } catch { return null; }
  const value = row(body);
  if (!value || JSON.stringify(value) !== intent.body) return null;

  if (intent.path === "return-sla")
    return exactKeys(value, []) ? { kind: "return-sla" } : null;

  const match = /^returns\/([0-9a-f-]+)\/unavailability$/i.exec(intent.path);
  if (!match || !commerceId(match[1]) ||
      !exactKeys(value, ["reason"]) || !cleanReason(value.reason))
    return null;

  return {
    kind: "unavailability",
    incidentId: match[1],
    reason: value.reason as string,
  };
}

function parse(raw: string | null): StaffIntent | null {
  if (raw === null) return null;
  if (raw.length > maxStored)
    throw Error("Pending support operation is too large.");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw Error("Pending support operation is invalid.");
  }
  const value = row(parsed);
  if (!value ||
      !exactKeys(value, ["version", "path", "body", "key"]) ||
      value.version !== 1 ||
      typeof value.path !== "string" ||
      typeof value.body !== "string" ||
      !commerceId(value.key))
    throw Error("Pending support operation is invalid.");

  const intent = {
    path: value.path,
    body: value.body,
    key: value.key,
  } as StaffIntent;
  if (!supportOperationIntentDetails(intent))
    throw Error("Pending support operation is invalid.");

  return Object.freeze(intent);
}

function storage(): Storage {
  if (typeof window === "undefined")
    throw Error("Pending support operation storage unavailable.");
  try {
    return window.sessionStorage;
  } catch {
    throw Error("Pending support operation storage unavailable.");
  }
}

export function restoreSupportOperationIntent(): StaffIntent | null {
  return parse(storage().getItem(storageKey));
}

export function persistSupportOperationIntent(intent: StaffIntent) {
  if (!commerceId(intent.key) || !supportOperationIntentDetails(intent))
    throw Error("Pending support operation is invalid.");

  const store = storage();
  const existing = store.getItem(storageKey);
  if (existing !== null) {
    const restored = parse(existing);
    if (!restored || restored.key !== intent.key ||
        restored.path !== intent.path || restored.body !== intent.body)
      throw Error("Another pending support operation must be resolved first.");
    return;
  }

  const record = JSON.stringify({
    version: 1,
    path: intent.path,
    body: intent.body,
    key: intent.key,
  });
  if (record.length > maxStored)
    throw Error("Pending support operation is too large.");
  store.setItem(storageKey, record);
}

export function clearSupportOperationIntent(expectedKey: string) {
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
