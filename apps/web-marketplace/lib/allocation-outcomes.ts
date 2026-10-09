export type AllocationOutcomeInput = {
  eventId: string;
  snapshotId: string;
  periodStartUtc: string;
  periodEndUtc: string;
  essentialNeedsCoverage: number | null;
  stockBarrier: boolean | null;
  deliveryBarrier: boolean | null;
  accessBarrier: boolean | null;
  evidenceReference: string;
};

export type AllocationOutcomeRecord = {
  id: string;
  snapshotId: string;
  periodStartUtc: string;
  periodEndUtc: string;
  creditUsedRial: number | null;
  essentialNeedsCoverage: number | null;
  stockBarrier: boolean | null;
  deliveryBarrier: boolean | null;
  accessBarrier: boolean | null;
  evidence: 1 | 2 | 3;
  reviewedByAccountId: string | null;
  evidenceReference: string | null;
  recordedAtUtc: string;
};

export type AllocationOutcomeAssessmentOption = {
  id: string;
  datasetVersion: string;
  sourceInstructionReference: string;
  assessedAtUtc: string;
  trainingEligible: boolean;
};

const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const record = (value: unknown): Record<string, unknown> | null =>
  !!value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const text = (value: unknown, limit: number): value is string =>
  typeof value === "string" && !!value.trim() && value.length <= limit;
const utc = (value: unknown): value is string =>
  typeof value === "string" &&
  /(?:Z|[+]00:00)$/.test(value) &&
  Number.isFinite(Date.parse(value));
const nullableBoolean = (value: unknown): value is boolean | null =>
  value === null || typeof value === "boolean";
const coverage = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === "number" && Number.isFinite(value) &&
   value >= 0 && value <= 1);

export function parseAllocationOutcomeInput(
  raw: unknown,
  now = Date.now(),
): AllocationOutcomeInput | null {
  const x = record(raw);
  if (!x || !uuid(x.eventId) || !uuid(x.snapshotId) ||
      !utc(x.periodStartUtc) || !utc(x.periodEndUtc) ||
      Date.parse(x.periodStartUtc) >= Date.parse(x.periodEndUtc) ||
      Date.parse(x.periodEndUtc) > now ||
      !coverage(x.essentialNeedsCoverage) ||
      !nullableBoolean(x.stockBarrier) ||
      !nullableBoolean(x.deliveryBarrier) ||
      !nullableBoolean(x.accessBarrier) ||
      !text(x.evidenceReference, 240))
    return null;

  if (x.essentialNeedsCoverage === null &&
      x.stockBarrier === null &&
      x.deliveryBarrier === null &&
      x.accessBarrier === null)
    return null;

  return {
    eventId: x.eventId,
    snapshotId: x.snapshotId,
    periodStartUtc: new Date(x.periodStartUtc).toISOString(),
    periodEndUtc: new Date(x.periodEndUtc).toISOString(),
    essentialNeedsCoverage: x.essentialNeedsCoverage as number | null,
    stockBarrier: x.stockBarrier as boolean | null,
    deliveryBarrier: x.deliveryBarrier as boolean | null,
    accessBarrier: x.accessBarrier as boolean | null,
    evidenceReference: (x.evidenceReference as string).trim(),
  };
}

export function parseAllocationOutcomeResult(raw: unknown) {
  const x = record(raw);
  if (!x || !uuid(x.id) || !uuid(x.snapshotId) ||
      x.evidence !== "HUMAN_REVIEWED" ||
      x.active !== false || typeof x.replayed !== "boolean")
    return null;
  return x as {
    id: string;
    snapshotId: string;
    evidence: "HUMAN_REVIEWED";
    active: false;
    replayed: boolean;
  };
}

function parseOutcomeRow(raw: unknown): AllocationOutcomeRecord | null {
  const x = record(raw);
  if (!x || !uuid(x.id) || !uuid(x.snapshotId) ||
      !utc(x.periodStartUtc) || !utc(x.periodEndUtc) ||
      Date.parse(x.periodStartUtc) >= Date.parse(x.periodEndUtc) ||
      !utc(x.recordedAtUtc) ||
      !(x.creditUsedRial === null ||
        (typeof x.creditUsedRial === "number" &&
         Number.isSafeInteger(x.creditUsedRial) && x.creditUsedRial >= 0)) ||
      !coverage(x.essentialNeedsCoverage) ||
      !nullableBoolean(x.stockBarrier) ||
      !nullableBoolean(x.deliveryBarrier) ||
      !nullableBoolean(x.accessBarrier) ||
      ![1, 2, 3].includes(Number(x.evidence)))
    return null;

  if (x.creditUsedRial === null &&
      x.essentialNeedsCoverage === null &&
      x.stockBarrier === null &&
      x.deliveryBarrier === null &&
      x.accessBarrier === null)
    return null;

  if (x.evidence === 3) {
    if (x.creditUsedRial !== null ||
        !uuid(x.reviewedByAccountId) ||
        !text(x.evidenceReference, 240))
      return null;
  } else if (x.reviewedByAccountId !== null ||
             x.evidenceReference !== null) {
    return null;
  }

  return x as AllocationOutcomeRecord;
}

export function parseAllocationOutcomes(raw: unknown): {
  items: AllocationOutcomeRecord[];
  page: number;
  active: false;
} | null {
  const x = record(raw);
  if (!x || x.active !== false ||
      !Number.isInteger(x.page) || Number(x.page) < 1 ||
      Number(x.page) > 10000 ||
      !Array.isArray(x.items) || x.items.length > 20)
    return null;
  const items = x.items.map(parseOutcomeRow);
  if (!items.every((item): item is AllocationOutcomeRecord => !!item))
    return null;
  return { items, page: Number(x.page), active: false };
}

export function parseOutcomeAssessmentOptions(raw: unknown): {
  items: AllocationOutcomeAssessmentOption[];
  page: number;
  active: false;
} | null {
  const x = record(raw);
  if (!x || x.active !== false ||
      !Number.isInteger(x.page) || Number(x.page) < 1 ||
      Number(x.page) > 10000 ||
      !Array.isArray(x.items) || x.items.length > 20)
    return null;

  const items: AllocationOutcomeAssessmentOption[] = [];
  for (const rawItem of x.items) {
    const item = record(rawItem);
    if (!item || !uuid(item.id) ||
        !text(item.datasetVersion, 120) ||
        !text(item.sourceInstructionReference, 120) ||
        !utc(item.assessedAtUtc) ||
        typeof item.trainingEligible !== "boolean")
      return null;
    items.push({
      id: item.id,
      datasetVersion: item.datasetVersion as string,
      sourceInstructionReference:
        item.sourceInstructionReference as string,
      assessedAtUtc: item.assessedAtUtc as string,
      trainingEligible: item.trainingEligible as boolean,
    });
  }
  return { items, page: Number(x.page), active: false };
}
