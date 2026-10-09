import { proposalId } from "./allocation-proposals.ts";

const storageKey = "hana.admin.allocation-training.pending.v1";
const maxStored = 24000;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AllocationTrainingIntent = {
  key: string;
  body: string;
};

export type AllocationTrainingDetails = {
  labelIds: string[];
  poolRial: number;
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

export function allocationTrainingDetails(
  intent: Pick<AllocationTrainingIntent, "body">,
): AllocationTrainingDetails | null {
  if (intent.body.length > 20000) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(intent.body); } catch { return null; }
  const value = row(parsed);
  if (!value || !exactKeys(value, ["labelIds", "poolRial"]) ||
      !Array.isArray(value.labelIds) ||
      value.labelIds.length < 40 || value.labelIds.length > 500 ||
      !value.labelIds.every(proposalId) ||
      new Set(value.labelIds).size !== value.labelIds.length ||
      typeof value.poolRial !== "number" ||
      !Number.isSafeInteger(value.poolRial) ||
      value.poolRial <= 0 ||
      JSON.stringify(value) !== intent.body)
    return null;
  return {
    labelIds: [...value.labelIds],
    poolRial: value.poolRial,
  };
}

function parse(raw: string | null): AllocationTrainingIntent | null {
  if (raw === null) return null;
  if (raw.length > maxStored)
    throw Error("Pending allocation training intent is too large.");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw Error("Pending allocation training intent is invalid.");
  }
  const value = row(parsed);
  if (!value ||
      !exactKeys(value, ["version", "key", "body"]) ||
      value.version !== 1 ||
      typeof value.key !== "string" || !uuid.test(value.key) ||
      typeof value.body !== "string")
    throw Error("Pending allocation training intent is invalid.");

  const intent = Object.freeze({
    key: value.key,
    body: value.body,
  });
  if (!allocationTrainingDetails(intent))
    throw Error("Pending allocation training intent is invalid.");
  return intent;
}

function storage(): Storage {
  if (typeof window === "undefined")
    throw Error("Pending allocation training storage unavailable.");
  try {
    return window.sessionStorage;
  } catch {
    throw Error("Pending allocation training storage unavailable.");
  }
}

export function createAllocationTrainingIntent(
  labelIds: string[],
  poolRial: number,
): AllocationTrainingIntent {
  const intent = Object.freeze({
    key: crypto.randomUUID(),
    body: JSON.stringify({ labelIds, poolRial }),
  });
  if (!allocationTrainingDetails(intent))
    throw Error("Allocation training input is invalid.");
  return intent;
}

export function restoreAllocationTrainingIntent() {
  return parse(storage().getItem(storageKey));
}

export function persistAllocationTrainingIntent(
  intent: AllocationTrainingIntent,
) {
  if (!uuid.test(intent.key) || !allocationTrainingDetails(intent))
    throw Error("Pending allocation training intent is invalid.");

  const store = storage();
  const existing = store.getItem(storageKey);
  if (existing !== null) {
    const restored = parse(existing);
    if (!restored || restored.key !== intent.key ||
        restored.body !== intent.body)
      throw Error("Another pending allocation training intent must be resolved first.");
    return;
  }

  const record = JSON.stringify({
    version: 1,
    key: intent.key,
    body: intent.body,
  });
  if (record.length > maxStored)
    throw Error("Pending allocation training intent is too large.");
  store.setItem(storageKey, record);
}

export function clearAllocationTrainingIntent(expectedKey: string) {
  if (!uuid.test(expectedKey)) return false;
  let store: Storage;
  try { store = storage(); } catch { return false; }
  const raw = store.getItem(storageKey);
  if (raw === null) return true;

  let restored: AllocationTrainingIntent | null;
  try { restored = parse(raw); } catch { return false; }
  if (!restored || restored.key !== expectedKey) return false;
  store.removeItem(storageKey);
  return true;
}
