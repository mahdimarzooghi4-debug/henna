import type {
  ModelVersionTechnicalSelection, ModelVersionTechnicalPreflight,
} from "./model-version-technical-preflight";

export const registryIntakeContract = "HENNA-REGISTRY-INTAKE-READINESS-v1";
export const registryIntakeStatus = "TECHNICAL_LINEAGE_ONLY_NOT_ADMITTED";
export const gateUnverified = "NOT_ATTESTED_BY_THIS_REPORT";

export const registryRequirementCodes = [
  "APPROVED_COMPLETE_NUMERIC_REVIEW_RUBRIC",
  "DATASET_ADMISSION_AND_SOURCE_RIGHTS",
  "INDEPENDENT_EVALUATION_CONTENT_REATTESTATION",
  "TEMPORAL_FAIRNESS_AND_MISSINGNESS_CRITERIA",
  "ACCOUNTABLE_HUMAN_MODEL_REGISTRY_DECISION",
  "PILOT_AND_PRODUCTION_AUTHORIZATION",
  "EXPLICIT_RUNTIME_PROMOTION",
] as const;

export type RegistryIntakeReadiness = {
  contractVersion: typeof registryIntakeContract;
  manifestSha256: string;
  sourceTechnicalPreflightContractVersion: string;
  family: "XGBOOST" | "EBM";
  artifactId: string; trainingRunId: string; evaluationId: string;
  artifactSha256: string; evaluationFingerprint: string;
  datasetVersion: string; modelVersion: string; artifactFormat: string;
  evaluationProtocolVersion: string; existingExecutionFoundationVersion: string | null;
  status: typeof registryIntakeStatus;
  requirements: Array<{code: typeof registryRequirementCodes[number]; verification: typeof gateUnverified}>;
  registryRecordCreated: false; registrationAllowed: false; datasetAdmitted: false;
  approved: false; candidateCreated: false; productionCompatible: false;
  runtimeApplied: false;
};

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const digest = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const normalizedUuid = (v: string) => v.toLowerCase();
const validTechnicalSelection = (v: unknown): v is ModelVersionTechnicalSelection =>
  record(v) && Object.keys(v).sort().join("|") === "artifactId|evaluationId|family" &&
  (v.family === "XGBOOST" || v.family === "EBM") &&
  uuid(v.artifactId) && uuid(v.evaluationId);

export function parseRegistryIntakeReadiness(
  raw: unknown, selection: ModelVersionTechnicalSelection,
  technical: ModelVersionTechnicalPreflight,
): RegistryIntakeReadiness | null {
  if (!validTechnicalSelection(selection) || !record(raw) ||
      raw.contractVersion !== registryIntakeContract || !digest(raw.manifestSha256) ||
      raw.sourceTechnicalPreflightContractVersion !== technical.contractVersion ||
      raw.family !== technical.family || raw.family !== selection.family ||
      !uuid(raw.artifactId) || normalizedUuid(raw.artifactId) !== normalizedUuid(selection.artifactId) ||
      !uuid(raw.evaluationId) || normalizedUuid(raw.evaluationId) !== normalizedUuid(selection.evaluationId) ||
      !uuid(raw.trainingRunId) || normalizedUuid(raw.trainingRunId) !== normalizedUuid(technical.trainingRunId) ||
      raw.artifactSha256 !== technical.artifactSha256 ||
      raw.evaluationFingerprint !== technical.evaluationFingerprint ||
      raw.datasetVersion !== technical.datasetVersion ||
      raw.modelVersion !== technical.modelVersion ||
      raw.artifactFormat !== technical.artifactFormat ||
      raw.evaluationProtocolVersion !== technical.evaluationProtocolVersion ||
      raw.existingExecutionFoundationVersion !== technical.existingExecutionFoundationVersion ||
      raw.status !== registryIntakeStatus ||
      raw.registryRecordCreated !== false || raw.registrationAllowed !== false ||
      raw.datasetAdmitted !== false || raw.approved !== false ||
      raw.candidateCreated !== false || raw.productionCompatible !== false ||
      raw.runtimeApplied !== false ||
      !Array.isArray(raw.requirements) ||
      raw.requirements.length !== registryRequirementCodes.length)
    return null;
  for (let i = 0; i < registryRequirementCodes.length; i++) {
    const gate: unknown = raw.requirements[i];
    if (!record(gate) || gate.code !== registryRequirementCodes[i] ||
        gate.verification !== gateUnverified) return null;
  }
  return {
    contractVersion: registryIntakeContract,
    manifestSha256: raw.manifestSha256,
    sourceTechnicalPreflightContractVersion: technical.contractVersion,
    family: selection.family, artifactId: raw.artifactId,
    trainingRunId: raw.trainingRunId, evaluationId: raw.evaluationId,
    artifactSha256: technical.artifactSha256,
    evaluationFingerprint: technical.evaluationFingerprint,
    datasetVersion: technical.datasetVersion, modelVersion: technical.modelVersion,
    artifactFormat: technical.artifactFormat,
    evaluationProtocolVersion: technical.evaluationProtocolVersion,
    existingExecutionFoundationVersion: technical.existingExecutionFoundationVersion,
    status: registryIntakeStatus,
    requirements: registryRequirementCodes.map(code => ({
      code, verification: gateUnverified
    })),
    registryRecordCreated: false, registrationAllowed: false, datasetAdmitted: false,
    approved: false, candidateCreated: false, productionCompatible: false,
    runtimeApplied: false,
  };
}
