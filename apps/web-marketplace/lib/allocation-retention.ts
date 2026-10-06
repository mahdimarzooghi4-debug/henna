import { proposalId } from "./allocation-proposals.ts";

export type AllocationRetentionPreview = {
  scope: "ATTRIBUTED_RESEARCH";
  cutoffUtc: string;
  totalEligibleSnapshotCount: number;
  selectedSnapshotCount: number;
  selectedOutcomeCount: number;
  truncated: boolean;
  previewDigest: string;
  active: false;
};

export type AllocationRetentionResult = {
  eventId: string;
  deletedSnapshotCount: number;
  deletedOutcomeCount: number;
  previewDigest: string;
  active: false;
};

export type AllocationRetentionEvent = {
  id: string;
  actorAccountId: string;
  scope: "ATTRIBUTED_RESEARCH";
  cutoffUtc: string;
  deletedSnapshotCount: number;
  deletedOutcomeCount: number;
  reason: string;
  recordedAtUtc: string;
};

export type AllocationRetentionEvents = {
  items: AllocationRetentionEvent[];
  page: number;
  active: false;
};

const digestPattern = /^[0-9a-f]{64}$/;
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const iso = (value: unknown): value is string =>
  typeof value === "string" &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function parseAllocationRetentionPreview(
  value: unknown,
): AllocationRetentionPreview | null {
  const x = object(value);
  if (!x ||
      x.active !== false ||
      x.scope !== "ATTRIBUTED_RESEARCH" ||
      !iso(x.cutoffUtc) ||
      !count(x.totalEligibleSnapshotCount) ||
      !count(x.selectedSnapshotCount) ||
      !count(x.selectedOutcomeCount) ||
      typeof x.truncated !== "boolean" ||
      typeof x.previewDigest !== "string" ||
      !digestPattern.test(x.previewDigest) ||
      Number(x.selectedSnapshotCount) > 5000 ||
      Number(x.selectedSnapshotCount) > Number(x.totalEligibleSnapshotCount))
    return null;
  return x as AllocationRetentionPreview;
}

export function parseAllocationRetentionResult(
  value: unknown,
): AllocationRetentionResult | null {
  const x = object(value);
  if (!x ||
      x.active !== false ||
      typeof x.eventId !== "string" ||
      !proposalId(x.eventId) ||
      !count(x.deletedSnapshotCount) ||
      Number(x.deletedSnapshotCount) < 1 ||
      !count(x.deletedOutcomeCount) ||
      typeof x.previewDigest !== "string" ||
      !digestPattern.test(x.previewDigest))
    return null;
  return x as AllocationRetentionResult;
}

export function parseAllocationRetentionEvents(
  value: unknown,
): AllocationRetentionEvents | null {
  const x = object(value);
  if (!x ||
      x.active !== false ||
      !count(x.page) ||
      Number(x.page) < 1 ||
      Number(x.page) > 10000 ||
      !Array.isArray(x.items) ||
      x.items.length > 20)
    return null;

  const items: AllocationRetentionEvent[] = [];
  for (const raw of x.items) {
    const item = object(raw);
    if (!item ||
        typeof item.id !== "string" ||
        !proposalId(item.id) ||
        typeof item.actorAccountId !== "string" ||
        !proposalId(item.actorAccountId) ||
        item.scope !== "ATTRIBUTED_RESEARCH" ||
        !iso(item.cutoffUtc) ||
        !count(item.deletedSnapshotCount) ||
        Number(item.deletedSnapshotCount) < 1 ||
        !count(item.deletedOutcomeCount) ||
        typeof item.reason !== "string" ||
        !item.reason.trim() ||
        item.reason.length > 2000 ||
        !iso(item.recordedAtUtc))
      return null;
    items.push(item as AllocationRetentionEvent);
  }

  return {
    items,
    page: Number(x.page),
    active: false,
  };
}

export function validAllocationRetentionDigest(value: string) {
  return digestPattern.test(value);
}

export function validAllocationRetentionCutoff(value: string) {
  return iso(value);
}
