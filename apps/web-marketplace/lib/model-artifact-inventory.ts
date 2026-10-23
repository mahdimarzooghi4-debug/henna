// Stored research artifacts are not approved Model Registry entries.
// SHA-256 matching means only byte integrity, not evidence sufficiency.
export const artifactInventoryContract = "HENNA-RESEARCH-MODEL-ARTIFACT-INVENTORY-v1";
export type ArtifactEvidenceItem = {
  artifactId: string; trainingRunId: string; modelVersion: string;
  artifactFormat: string; artifactSha256: string; datasetVersion: string;
  recordedAtUtc: string; artifactVerified: boolean; evaluationCount: number;
};
export type ModelArtifactInventory = {
  contractVersion: typeof artifactInventoryContract; page: number;
  xgboostHasMore: boolean; ebmHasMore: boolean;
  xgboostItems: ArtifactEvidenceItem[]; ebmItems: ArtifactEvidenceItem[];
  admitted: false; registryReady: false; registrationEnabled: false;
  approved: false; active: false; runtimeApplied: false;
};
const object = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x);
const uuid = (s: unknown): s is string => typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const text = (s: unknown): s is string =>
  typeof s === "string" && s.trim().length > 0 && s.length <= 120;
const digest = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
const utc = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|\+00:00)$/.test(s) &&
  !Number.isNaN(Date.parse(s));

function parseItems(raw: unknown): ArtifactEvidenceItem[] | null {
  if (!Array.isArray(raw) || raw.length > 10) return null;
  const seen = new Set<string>();
  const rows: ArtifactEvidenceItem[] = [];
  for (const item of raw) {
    if (!object(item) || !uuid(item.artifactId) || !uuid(item.trainingRunId) ||
        !text(item.modelVersion) || !text(item.artifactFormat) ||
        !digest(item.artifactSha256) || !text(item.datasetVersion) ||
        !utc(item.recordedAtUtc) || typeof item.artifactVerified !== "boolean" ||
        !Number.isSafeInteger(item.evaluationCount) ||
        Number(item.evaluationCount) < 0 || Number(item.evaluationCount) > 100000)
      return null;
    if (seen.has(item.artifactId.toLowerCase())) return null;
    seen.add(item.artifactId.toLowerCase());
    rows.push({
      artifactId: item.artifactId, trainingRunId: item.trainingRunId,
      modelVersion: item.modelVersion, artifactFormat: item.artifactFormat,
      artifactSha256: item.artifactSha256, datasetVersion: item.datasetVersion,
      recordedAtUtc: item.recordedAtUtc, artifactVerified: item.artifactVerified,
      evaluationCount: item.evaluationCount,
    });
  }
  return rows;
}
export function parseModelArtifactInventory(raw: unknown): ModelArtifactInventory | null {
  if (!object(raw) || raw.contractVersion !== artifactInventoryContract ||
      !Number.isSafeInteger(raw.page) || Number(raw.page) < 1 || Number(raw.page) > 10000 ||
      typeof raw.xgboostHasMore !== "boolean" || typeof raw.ebmHasMore !== "boolean" ||
      raw.admitted !== false || raw.registryReady !== false ||
      raw.registrationEnabled !== false || raw.approved !== false ||
      raw.active !== false || raw.runtimeApplied !== false)
    return null;
  const xgboostItems = parseItems(raw.xgboostItems);
  const ebmItems = parseItems(raw.ebmItems);
  if (!xgboostItems || !ebmItems) return null;
  return {
    contractVersion: artifactInventoryContract, page: raw.page as number,
    xgboostHasMore: raw.xgboostHasMore, ebmHasMore: raw.ebmHasMore,
    xgboostItems, ebmItems, admitted: false, registryReady: false,
    registrationEnabled: false, approved: false, active: false,
    runtimeApplied: false,
  };
}
