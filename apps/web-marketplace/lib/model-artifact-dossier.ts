export const modelDossierContract = "HENNA-RESEARCH-ARTIFACT-EVIDENCE-DOSSIER-v1";
export const modelDossierStatus = "RESEARCH_EVIDENCE_ONLY_NOT_APPROVED";
export type ModelDossierEvaluation = {
  id: string; protocolVersion: string; evaluationFingerprint: string;
  datasetVersion: string; sourceInstructionReference: string;
  cutoffUtc: string; recordedAtUtc: string;
};
export type ModelArtifactDossier = {
  contractVersion: typeof modelDossierContract;
  family: "XGBOOST" | "EBM"; artifactId: string; trainingRunId: string;
  modelVersion: string; artifactFormat: string; artifactSha256: string;
  datasetVersion: string; recordedAtUtc: string; artifactVerified: true;
  evaluations: ModelDossierEvaluation[];
  evidenceStatus: typeof modelDossierStatus;
  registered: false; approved: false; active: false; runtimeApplied: false;
};
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const sha = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const label = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 120;
const utc = (v: unknown): v is string => typeof v === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)$/.test(v) &&
  Number.isFinite(Date.parse(v));

export function parseModelArtifactDossier(
  raw: unknown, family: "XGBOOST" | "EBM", id: string,
): ModelArtifactDossier | null {
  if (!object(raw) || raw.contractVersion !== modelDossierContract ||
      raw.family !== family || !uuid(raw.artifactId) ||
      raw.artifactId.toLowerCase() !== id.toLowerCase() ||
      !uuid(raw.trainingRunId) || !label(raw.modelVersion) ||
      !label(raw.artifactFormat) || !sha(raw.artifactSha256) ||
      !label(raw.datasetVersion) || !utc(raw.recordedAtUtc) ||
      raw.artifactVerified !== true || raw.evidenceStatus !== modelDossierStatus ||
      raw.registered !== false || raw.approved !== false ||
      raw.active !== false || raw.runtimeApplied !== false ||
      !Array.isArray(raw.evaluations) || raw.evaluations.length > 100)
    return null;
  const seen = new Set<string>();
  const evaluations: ModelDossierEvaluation[] = [];
  for (const e of raw.evaluations) {
    if (!object(e) || !uuid(e.id) || seen.has(e.id.toLowerCase()) ||
        !label(e.protocolVersion) || !sha(e.evaluationFingerprint) ||
        e.datasetVersion !== raw.datasetVersion ||
        !label(e.sourceInstructionReference) ||
        !utc(e.cutoffUtc) || !utc(e.recordedAtUtc)) return null;
    seen.add(e.id.toLowerCase());
    evaluations.push({
      id: e.id, protocolVersion: e.protocolVersion,
      evaluationFingerprint: e.evaluationFingerprint,
      datasetVersion: e.datasetVersion as string,
      sourceInstructionReference: e.sourceInstructionReference,
      cutoffUtc: e.cutoffUtc, recordedAtUtc: e.recordedAtUtc,
    });
  }
  return {
    contractVersion: modelDossierContract, family,
    artifactId: raw.artifactId, trainingRunId: raw.trainingRunId,
    modelVersion: raw.modelVersion, artifactFormat: raw.artifactFormat,
    artifactSha256: raw.artifactSha256, datasetVersion: raw.datasetVersion,
    recordedAtUtc: raw.recordedAtUtc, artifactVerified: true,
    evaluations, evidenceStatus: modelDossierStatus,
    registered: false, approved: false, active: false, runtimeApplied: false,
  };
}
