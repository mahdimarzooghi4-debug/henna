// Explicit human selection; existing hard-coded research family contracts only.
// Successful technical identity checks never permit model registration or Production.
export const modelVersionPreflightContract = "HENNA-MODEL-VERSION-TECHNICAL-PREFLIGHT-v1";
export const xgboostTechnicalStatus = "EXISTING_IN_PROCESS_RAW_PREDICTION_FOUNDATION_ONLY";
export const ebmTechnicalStatus = "OFFLINE_CHALLENGER_NO_PRODUCTION_EXECUTION_CONTRACT";
export const xgboostExecutionFoundation = "henna-xgboost-runtime-contract-v1";
export type ModelFamily = "XGBOOST" | "EBM";
export type ModelVersionTechnicalSelection = {
  family: ModelFamily; artifactId: string; evaluationId: string;
};
export type ModelVersionTechnicalPreflight = {
  contractVersion: typeof modelVersionPreflightContract;
  family: ModelFamily; artifactId: string; trainingRunId: string; evaluationId: string;
  evaluationFingerprint: string; modelVersion: string; artifactFormat: string;
  artifactSha256: string; datasetVersion: string;
  sourceInstructionReference: string; evaluationProtocolVersion: string;
  existingExecutionFoundationVersion: string | null;
  technicalStatus: typeof xgboostTechnicalStatus | typeof ebmTechnicalStatus;
  artifactHashVerified: true; evaluationRecordLinked: true;
  productionRuntimeCompatible: false; registrationEnabled: false;
  datasetAdmitted: false; modelApproved: false; candidateCreated: false;
  runtimeApplied: false;
};
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const digest = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const text = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 120;
export function validTechnicalSelection(v: unknown): v is ModelVersionTechnicalSelection {
  if (!object(v) || Object.keys(v).sort().join("|") !==
      ["artifactId", "evaluationId", "family"].join("|")) return false;
  return (v.family === "XGBOOST" || v.family === "EBM") &&
    uuid(v.artifactId) && uuid(v.evaluationId);
}
export function parseModelVersionTechnicalPreflight(
  raw: unknown, expected: ModelVersionTechnicalSelection,
): ModelVersionTechnicalPreflight | null {
  if (!validTechnicalSelection(expected) || !object(raw) ||
      raw.contractVersion !== modelVersionPreflightContract ||
      raw.family !== expected.family ||
      !uuid(raw.artifactId) || raw.artifactId.toLowerCase() !== expected.artifactId.toLowerCase() ||
      !uuid(raw.evaluationId) || raw.evaluationId.toLowerCase() !== expected.evaluationId.toLowerCase() ||
      !uuid(raw.trainingRunId) || !digest(raw.evaluationFingerprint) ||
      !digest(raw.artifactSha256) || !text(raw.modelVersion) ||
      !text(raw.artifactFormat) || !text(raw.datasetVersion) ||
      !text(raw.sourceInstructionReference) || !text(raw.evaluationProtocolVersion) ||
      raw.artifactHashVerified !== true || raw.evaluationRecordLinked !== true ||
      raw.productionRuntimeCompatible !== false || raw.registrationEnabled !== false ||
      raw.datasetAdmitted !== false || raw.modelApproved !== false ||
      raw.candidateCreated !== false || raw.runtimeApplied !== false)
    return null;
  if (raw.family === "XGBOOST") {
    if (raw.artifactId.toLowerCase() !== raw.trainingRunId.toLowerCase() ||
        raw.modelVersion !== "henna-xgboost-v1-offline" ||
        raw.artifactFormat !== "xgboost-json" ||
        raw.evaluationProtocolVersion !== "henna-xgboost-shadow-benchmark-v3" ||
        raw.technicalStatus !== xgboostTechnicalStatus ||
        raw.existingExecutionFoundationVersion !== xgboostExecutionFoundation)
      return null;
  } else if (raw.family === "EBM") {
    if (raw.modelVersion !== "henna-ebm-v1-offline" ||
        raw.artifactFormat !== "henna-ebm-portable-json-v1" ||
        raw.evaluationProtocolVersion !== "henna-ebm-shadow-benchmark-v2" ||
        raw.technicalStatus !== ebmTechnicalStatus ||
        raw.existingExecutionFoundationVersion !== null)
      return null;
  }
  // Project a fixed safe DTO; unrecognized upstream fields are never sent to UI.
  return {
    contractVersion: modelVersionPreflightContract,
    family: expected.family,
    artifactId: raw.artifactId, trainingRunId: raw.trainingRunId,
    evaluationId: raw.evaluationId, evaluationFingerprint: raw.evaluationFingerprint,
    modelVersion: raw.modelVersion, artifactFormat: raw.artifactFormat,
    artifactSha256: raw.artifactSha256, datasetVersion: raw.datasetVersion,
    sourceInstructionReference: raw.sourceInstructionReference,
    evaluationProtocolVersion: raw.evaluationProtocolVersion,
    existingExecutionFoundationVersion:
      raw.existingExecutionFoundationVersion as string | null,
    technicalStatus: expected.family === "XGBOOST" ? xgboostTechnicalStatus : ebmTechnicalStatus,
    artifactHashVerified: true, evaluationRecordLinked: true,
    productionRuntimeCompatible: false,
    registrationEnabled: false, datasetAdmitted: false, modelApproved: false,
    candidateCreated: false, runtimeApplied: false,
  };
}
