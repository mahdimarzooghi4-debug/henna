const storageKey = "hana.admin.allocation-retention.pending.v1";
const maxStored = 12000;
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;

export type AllocationRetentionIntent = {
  key: string;
  body: string;
};

export type AllocationRetentionDetails = {
  cutoffUtc: string;
  previewDigest: string;
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

function canonicalIso(value: unknown): value is string {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

export function allocationRetentionDetails(
  intent: Pick<AllocationRetentionIntent, "body">,
): AllocationRetentionDetails | null {
  if (intent.body.length > 10000) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(intent.body); } catch { return null; }
  const value = row(parsed);
  if (!value ||
      !exactKeys(value, ["cutoffUtc", "previewDigest", "reason"]) ||
      !canonicalIso(value.cutoffUtc) ||
      typeof value.previewDigest !== "string" ||
      !digest.test(value.previewDigest) ||
      typeof value.reason !== "string" ||
      !value.reason.trim() ||
      value.reason.length > 2000 ||
      value.reason !== value.reason.trim() ||
      JSON.stringify(value) !== intent.body)
    return null;

  return {
    cutoffUtc: value.cutoffUtc,
    previewDigest: value.previewDigest,
    reason: value.reason,
  };
}

function parse(raw: string | null): AllocationRetentionIntent | null {
  if (raw === null) return null;
  if (raw.length > maxStored)
    throw Error("Pending allocation retention intent is too large.");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw Error("Pending allocation retention intent is invalid.");
  }
  const value = row(parsed);
  if (!value ||
      !exactKeys(value, ["version", "key", "body"]) ||
      value.version !== 1 ||
      typeof value.key !== "string" ||
      !uuidV4.test(value.key) ||
      typeof value.body !== "string")
    throw Error("Pending allocation retention intent is invalid.");

  const intent = Object.freeze({
    key: value.key,
    body: value.body,
  });
  if (!allocationRetentionDetails(intent))
    throw Error("Pending allocation retention intent is invalid.");
  return intent;
}

function storage(): Storage {
  if (typeof window === "undefined")
    throw Error("Pending allocation retention storage unavailable.");
  try {
    return window.sessionStorage;
  } catch {
    throw Error("Pending allocation retention storage unavailable.");
  }
}

export function createAllocationRetentionIntent(
  cutoffUtc: string,
  previewDigest: string,
  reason: string,
): AllocationRetentionIntent {
  const intent = Object.freeze({
    key: crypto.randomUUID(),
    body: JSON.stringify({
      cutoffUtc,
      previewDigest,
      reason: reason.trim(),
    }),
  });
  if (!allocationRetentionDetails(intent))
    throw Error("Allocation retention input is invalid.");
  return intent;
}

export function restoreAllocationRetentionIntent() {
  return parse(storage().getItem(storageKey));
}

export function persistAllocationRetentionIntent(
  intent: AllocationRetentionIntent,
) {
  if (!uuidV4.test(intent.key) || !allocationRetentionDetails(intent))
    throw Error("Pending allocation retention intent is invalid.");

  const store = storage();
  const existing = store.getItem(storageKey);
  if (existing !== null) {
    const restored = parse(existing);
    if (!restored || restored.key !== intent.key ||
        restored.body !== intent.body)
      throw Error("Another pending allocation retention intent must be resolved first.");
    return;
  }

  const record = JSON.stringify({
    version: 1,
    key: intent.key,
    body: intent.body,
  });
  if (record.length > maxStored)
    throw Error("Pending allocation retention intent is too large.");
  store.setItem(storageKey, record);
}

export function clearAllocationRetentionIntent(expectedKey: string) {
  if (!uuidV4.test(expectedKey)) return false;
  let store: Storage;
  try { store = storage(); } catch { return false; }
  const raw = store.getItem(storageKey);
  if (raw === null) return true;

  let restored: AllocationRetentionIntent | null;
  try { restored = parse(raw); } catch { return false; }
  if (!restored || restored.key !== expectedKey) return false;
  store.removeItem(storageKey);
  return true;
}
