export type RegressionDiagnostics = {
  count: number;
  mse: number;
  rmse: number;
  mae: number;
  meanResidual: number;
  meanPrediction: number;
  meanObserved: number;
  calibrationIntercept: number | null;
  calibrationSlope: number | null;
};

export type AllocationComparisonEvidence = {
  kind: "PROFILE" | "XGBOOST" | "EBM";
  id: string;
  protocolVersion: string;
  modelVersion: string;
  candidateVersion: string | null;
  artifactSha256: string | null;
  baselineVersion: string;
  datasetVersion: string;
  sourceInstructionReference: string;
  runtimeProposalId: string | null;
  runtimeProfileSequence: number | null;
  evaluationFingerprint: string;
  rubricVersion: string;
  evaluationCount: number;
  baselineMse: number;
  modelMse: number;
  modelMinusBaselineMse: number;
  baselineDiagnostics: RegressionDiagnostics | null;
  modelDiagnostics: RegressionDiagnostics | null;
  cutoffUtc: string;
  recordedAtUtc: string;
};

export type AllocationModelComparison = {
  evaluationFingerprint: string;
  lineageAligned: boolean;
  truncated: boolean;
  items: AllocationComparisonEvidence[];
  winner: null;
  approved: false;
  active: false;
  runtimeApplied: false;
};

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const text = (value: unknown, max = 120): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const digest = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const date = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 50 && Number.isFinite(Date.parse(value));

function diagnostics(raw: unknown): RegressionDiagnostics | null {
  const v = object(raw);
  if (!v ||
      !Number.isInteger(v.count) || Number(v.count) < 1 || Number(v.count) > 10000 ||
      !finite(v.mse) || Number(v.mse) < 0 ||
      !finite(v.rmse) || Number(v.rmse) < 0 ||
      !finite(v.mae) || Number(v.mae) < 0 ||
      !finite(v.meanResidual) ||
      !finite(v.meanPrediction) ||
      !finite(v.meanObserved) ||
      !(v.calibrationIntercept === null || finite(v.calibrationIntercept)) ||
      !(v.calibrationSlope === null || finite(v.calibrationSlope)))
    return null;
  return v as RegressionDiagnostics;
}

function page(raw: unknown): { items: unknown[]; truncated: boolean } | null {
  const v = object(raw);
  if (!v || v.active !== false || v.page !== 1 || !Array.isArray(v.items) || v.items.length > 20)
    return null;
  return { items: v.items, truncated: v.items.length === 20 };
}

function common(
  raw: unknown,
  expectedFingerprint: string,
): Record<string, unknown> | null {
  const v = object(raw);
  if (!v ||
      !uuid(v.id) ||
      !text(v.protocolVersion) ||
      !text(v.modelVersion) ||
      !text(v.baselineVersion) ||
      !text(v.datasetVersion) ||
      !text(v.sourceInstructionReference) ||
      !(v.runtimeProposalId === null || uuid(v.runtimeProposalId)) ||
      !(v.runtimeProfileSequence === null ||
        Number.isSafeInteger(v.runtimeProfileSequence) &&
        Number(v.runtimeProfileSequence) >= 0) ||
      v.evaluationFingerprint !== expectedFingerprint ||
      !date(v.cutoffUtc) ||
      !date(v.recordedAtUtc) ||
      v.winner !== null ||
      v.approved !== false ||
      v.active !== false)
    return null;
  return v;
}

function metricCommon(
  raw: unknown,
  fingerprint: string,
  cutoffUtc: string,
): Record<string, unknown> | null {
  const m = object(raw);
  if (!m ||
      !Number.isInteger(m.evaluationCount) ||
      Number(m.evaluationCount) < 1 ||
      Number(m.evaluationCount) > 10000 ||
      !finite(m.baselineMse) || Number(m.baselineMse) < 0 ||
      !text(m.rubricVersion) ||
      m.evaluationFingerprint !== fingerprint ||
      m.cutoffUtc !== cutoffUtc)
    return null;
  return m;
}

function parseProfile(raw: unknown, fingerprint: string): AllocationComparisonEvidence | null {
  const v = common(raw, fingerprint);
  if (!v || !uuid(v.proposalId) || !text(v.candidateVersion)) return null;
  const m = metricCommon(v.metrics, fingerprint, String(v.cutoffUtc));
  if (!m ||
      !finite(m.candidateMse) || Number(m.candidateMse) < 0 ||
      !finite(m.candidateMinusBaselineMse))
    return null;
  const baselineDiagnostics = m.baselineDiagnostics === undefined || m.baselineDiagnostics === null
    ? null : diagnostics(m.baselineDiagnostics);
  const modelDiagnostics = m.candidateDiagnostics === undefined || m.candidateDiagnostics === null
    ? null : diagnostics(m.candidateDiagnostics);
  if ((v.protocolVersion === "henna-allocation-benchmark-v2") &&
      (!baselineDiagnostics || !modelDiagnostics))
    return null;
  return {
    kind: "PROFILE",
    id: String(v.id),
    protocolVersion: String(v.protocolVersion),
    modelVersion: String(v.modelVersion),
    candidateVersion: String(v.candidateVersion),
    artifactSha256: null,
    baselineVersion: String(v.baselineVersion),
    datasetVersion: String(v.datasetVersion),
    sourceInstructionReference: String(v.sourceInstructionReference),
    runtimeProposalId: v.runtimeProposalId as string | null,
    runtimeProfileSequence: v.runtimeProfileSequence as number | null,
    evaluationFingerprint: fingerprint,
    rubricVersion: String(m.rubricVersion),
    evaluationCount: Number(m.evaluationCount),
    baselineMse: Number(m.baselineMse),
    modelMse: Number(m.candidateMse),
    modelMinusBaselineMse: Number(m.candidateMinusBaselineMse),
    baselineDiagnostics,
    modelDiagnostics,
    cutoffUtc: String(v.cutoffUtc),
    recordedAtUtc: String(v.recordedAtUtc),
  };
}

function parseXgboost(raw: unknown, fingerprint: string): AllocationComparisonEvidence | null {
  const v = common(raw, fingerprint);
  if (!v || !uuid(v.trainingRunId) || !digest(v.artifactSha256) ||
      v.runtimeApplied !== false)
    return null;
  const m = metricCommon(v.metrics, fingerprint, String(v.cutoffUtc));
  if (!m ||
      !finite(m.shadowMse) || Number(m.shadowMse) < 0 ||
      !finite(m.shadowMinusBaselineMse))
    return null;
  const baselineDiagnostics = m.baselineDiagnostics === undefined || m.baselineDiagnostics === null
    ? null : diagnostics(m.baselineDiagnostics);
  const modelDiagnostics = m.shadowDiagnostics === undefined || m.shadowDiagnostics === null
    ? null : diagnostics(m.shadowDiagnostics);
  if ((v.protocolVersion === "henna-xgboost-shadow-benchmark-v3") &&
      (!baselineDiagnostics || !modelDiagnostics))
    return null;
  return {
    kind: "XGBOOST",
    id: String(v.id),
    protocolVersion: String(v.protocolVersion),
    modelVersion: String(v.modelVersion),
    candidateVersion: null,
    artifactSha256: String(v.artifactSha256),
    baselineVersion: String(v.baselineVersion),
    datasetVersion: String(v.datasetVersion),
    sourceInstructionReference: String(v.sourceInstructionReference),
    runtimeProposalId: v.runtimeProposalId as string | null,
    runtimeProfileSequence: v.runtimeProfileSequence as number | null,
    evaluationFingerprint: fingerprint,
    rubricVersion: String(m.rubricVersion),
    evaluationCount: Number(m.evaluationCount),
    baselineMse: Number(m.baselineMse),
    modelMse: Number(m.shadowMse),
    modelMinusBaselineMse: Number(m.shadowMinusBaselineMse),
    baselineDiagnostics,
    modelDiagnostics,
    cutoffUtc: String(v.cutoffUtc),
    recordedAtUtc: String(v.recordedAtUtc),
  };
}

function parseEbm(raw: unknown, fingerprint: string): AllocationComparisonEvidence | null {
  const v = common(raw, fingerprint);
  if (!v || !uuid(v.ebmArtifactId) || !uuid(v.trainingRunId) ||
      !digest(v.artifactSha256) ||
      v.proposalCreated !== false || v.runtimeApplied !== false)
    return null;
  const m = metricCommon(v.metrics, fingerprint, String(v.cutoffUtc));
  if (!m ||
      !finite(m.ebmMse) || Number(m.ebmMse) < 0 ||
      !finite(m.ebmMinusBaselineMse))
    return null;
  const baselineDiagnostics = m.baselineDiagnostics === undefined || m.baselineDiagnostics === null
    ? null : diagnostics(m.baselineDiagnostics);
  const modelDiagnostics = m.ebmDiagnostics === undefined || m.ebmDiagnostics === null
    ? null : diagnostics(m.ebmDiagnostics);
  if ((v.protocolVersion === "henna-ebm-shadow-benchmark-v2") &&
      (!baselineDiagnostics || !modelDiagnostics))
    return null;
  return {
    kind: "EBM",
    id: String(v.id),
    protocolVersion: String(v.protocolVersion),
    modelVersion: String(v.modelVersion),
    candidateVersion: null,
    artifactSha256: String(v.artifactSha256),
    baselineVersion: String(v.baselineVersion),
    datasetVersion: String(v.datasetVersion),
    sourceInstructionReference: String(v.sourceInstructionReference),
    runtimeProposalId: v.runtimeProposalId as string | null,
    runtimeProfileSequence: v.runtimeProfileSequence as number | null,
    evaluationFingerprint: fingerprint,
    rubricVersion: String(m.rubricVersion),
    evaluationCount: Number(m.evaluationCount),
    baselineMse: Number(m.baselineMse),
    modelMse: Number(m.ebmMse),
    modelMinusBaselineMse: Number(m.ebmMinusBaselineMse),
    baselineDiagnostics,
    modelDiagnostics,
    cutoffUtc: String(v.cutoffUtc),
    recordedAtUtc: String(v.recordedAtUtc),
  };
}

export function parseAllocationModelComparisonSources(
  raw: unknown,
  evaluationFingerprint: string,
): AllocationModelComparison | null {
  if (!digest(evaluationFingerprint)) return null;
  const root = object(raw);
  if (!root) return null;
  const profilePage = page(root.profile);
  const xgboostPage = page(root.xgboost);
  const ebmPage = page(root.ebm);
  if (!profilePage || !xgboostPage || !ebmPage) return null;

  const profile = profilePage.items.map(x => parseProfile(x, evaluationFingerprint));
  const xgboost = xgboostPage.items.map(x => parseXgboost(x, evaluationFingerprint));
  const ebm = ebmPage.items.map(x => parseEbm(x, evaluationFingerprint));
  const parsedItems = [...profile, ...xgboost, ...ebm];
  const items = parsedItems
    .filter((x): x is AllocationComparisonEvidence => x !== null)
    .sort((a, b) => Date.parse(b.recordedAtUtc) - Date.parse(a.recordedAtUtc));
  if (items.length !== parsedItems.length)
    return null;
  const lineageKeys = new Set(items.map(x => JSON.stringify([
    x.baselineVersion,
    x.datasetVersion,
    x.sourceInstructionReference,
    x.runtimeProposalId,
    x.runtimeProfileSequence,
    x.cutoffUtc,
    x.rubricVersion,
  ])));
  return {
    evaluationFingerprint: evaluationFingerprint.toLowerCase(),
    lineageAligned: lineageKeys.size <= 1,
    truncated: profilePage.truncated || xgboostPage.truncated || ebmPage.truncated,
    items,
    winner: null,
    approved: false,
    active: false,
    runtimeApplied: false,
  };
}
