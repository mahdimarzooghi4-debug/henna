export type AllocationShadowBenchmarkMetrics = {
  evaluationCount: number;
  baselineMse: number;
  shadowMse: number;
  shadowMinusBaselineMse: number;
  rubricVersion: string;
  evaluationFingerprint: string;
  cutoffUtc: string;
};

export type AllocationShadowBenchmark = {
  id: string;
  trainingRunId: string;
  protocolVersion: string;
  modelVersion: string;
  artifactSha256: string;
  baselineVersion: string;
  datasetVersion: string;
  sourceInstructionReference: string;
  runtimeProposalId: string | null;
  runtimeProfileSequence: number | null;
  evaluationFingerprint: string;
  metrics: AllocationShadowBenchmarkMetrics;
  cutoffUtc: string;
  recordedAtUtc: string;
  winner: null;
  approved: false;
  active: false;
  runtimeApplied: false;
};

export type AllocationShadowBenchmarkPage = {
  items: AllocationShadowBenchmark[];
  page: number;
  active: false;
};

const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 120;

const digest = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);

const date = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 50 &&
  Number.isFinite(Date.parse(value));

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

function parseMetrics(
  raw: unknown,
  fingerprint: string,
  cutoffUtc: string,
): AllocationShadowBenchmarkMetrics | null {
  const value = object(raw);
  if (!value ||
      !Number.isInteger(value.evaluationCount) ||
      Number(value.evaluationCount) < 1 ||
      Number(value.evaluationCount) > 500 ||
      !finite(value.baselineMse) ||
      Number(value.baselineMse) < 0 ||
      !finite(value.shadowMse) ||
      Number(value.shadowMse) < 0 ||
      !finite(value.shadowMinusBaselineMse) ||
      !text(value.rubricVersion) ||
      value.evaluationFingerprint !== fingerprint ||
      value.cutoffUtc !== cutoffUtc ||
      !date(value.cutoffUtc))
    return null;
  return value as AllocationShadowBenchmarkMetrics;
}

function parseItem(raw: unknown): AllocationShadowBenchmark | null {
  const value = object(raw);
  if (!value ||
      !uuid(value.id) ||
      !uuid(value.trainingRunId) ||
      !text(value.protocolVersion) ||
      !text(value.modelVersion) ||
      !digest(value.artifactSha256) ||
      !text(value.baselineVersion) ||
      !text(value.datasetVersion) ||
      !text(value.sourceInstructionReference) ||
      !(value.runtimeProposalId === null || uuid(value.runtimeProposalId)) ||
      !(value.runtimeProfileSequence === null ||
        Number.isSafeInteger(value.runtimeProfileSequence) &&
        Number(value.runtimeProfileSequence) >= 0) ||
      !digest(value.evaluationFingerprint) ||
      !date(value.cutoffUtc) ||
      !date(value.recordedAtUtc) ||
      value.winner !== null ||
      value.approved !== false ||
      value.active !== false ||
      value.runtimeApplied !== false)
    return null;

  const metrics = parseMetrics(
    value.metrics,
    value.evaluationFingerprint,
    value.cutoffUtc,
  );
  if (!metrics) return null;
  return { ...value, metrics } as AllocationShadowBenchmark;
}

export function parseAllocationShadowBenchmarks(
  raw: unknown,
): AllocationShadowBenchmarkPage | null {
  const value = object(raw);
  if (!value ||
      value.active !== false ||
      !Number.isInteger(value.page) ||
      Number(value.page) < 1 ||
      Number(value.page) > 10000 ||
      !Array.isArray(value.items) ||
      value.items.length > 20)
    return null;
  const items = value.items.map(parseItem);
  if (!items.every((item): item is AllocationShadowBenchmark => item !== null))
    return null;
  return {
    items,
    page: Number(value.page),
    active: false,
  };
}
