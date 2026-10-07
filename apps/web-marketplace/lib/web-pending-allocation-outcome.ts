import {
  parseAllocationOutcomeInput,
  type AllocationOutcomeInput,
} from "./allocation-outcomes";

const STORAGE_KEY = "hana.admin.allocation-outcome.pending.v1";

export type AllocationOutcomeIntent = {
  body: string;
};

function canonical(raw: unknown): AllocationOutcomeIntent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return null;
  const body = (raw as Record<string, unknown>).body;
  if (typeof body !== "string" || !body)
    return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const input = parseAllocationOutcomeInput(parsed);
  if (!input)
    return null;
  const expected = JSON.stringify(input);
  return body === expected ? { body } : null;
}

export function createAllocationOutcomeIntent(
  input: Omit<AllocationOutcomeInput, "eventId">,
): AllocationOutcomeIntent {
  const eventId = crypto.randomUUID();
  const parsed = parseAllocationOutcomeInput({ ...input, eventId });
  if (!parsed)
    throw new Error("invalid allocation outcome");
  return { body: JSON.stringify(parsed) };
}

export function allocationOutcomeDetails(
  intent: AllocationOutcomeIntent,
): AllocationOutcomeInput | null {
  const valid = canonical(intent);
  if (!valid)
    return null;
  return parseAllocationOutcomeInput(JSON.parse(valid.body));
}

export function persistAllocationOutcomeIntent(
  intent: AllocationOutcomeIntent,
) {
  const valid = canonical(intent);
  if (!valid)
    throw new Error("invalid allocation outcome intent");
  const existing = window.sessionStorage.getItem(STORAGE_KEY);
  if (existing !== null) {
    const restored = restoreAllocationOutcomeIntent();
    if (!restored || restored.body !== valid.body)
      throw new Error("pending allocation outcome must be resolved first");
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
}

export function restoreAllocationOutcomeIntent():
  AllocationOutcomeIntent | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (raw === null)
    return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("pending allocation outcome state is invalid");
  }
  const valid = canonical(parsed);
  if (!valid)
    throw new Error("pending allocation outcome state is invalid");
  return valid;
}

export function clearAllocationOutcomeIntent(eventId: string): boolean {
  const restored = restoreAllocationOutcomeIntent();
  if (!restored)
    return true;
  const details = allocationOutcomeDetails(restored);
  if (!details || details.eventId !== eventId)
    return false;
  window.sessionStorage.removeItem(STORAGE_KEY);
  return true;
}
