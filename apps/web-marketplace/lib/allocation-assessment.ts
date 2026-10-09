export type AssessmentInput = {
  snapshotId: string; householdKey: string; datasetVersion: string; sourceInstructionReference: string;
  evidenceReference: string; geographicFactor: number; allocatedRial: number; assessedAtUtc: string;
  scores: Record<string, number>;
};
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown, limit: number): value is string => typeof value === "string" && !!value.trim() && value.length <= limit;
export function parseAssessmentInput(raw: unknown, now = Date.now()): AssessmentInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const x = raw as Record<string, unknown>;
  if (!uuid(x.snapshotId) || !uuid(x.householdKey) || !text(x.datasetVersion,120) ||
    !text(x.sourceInstructionReference,120) || !text(x.evidenceReference,240) ||
    typeof x.geographicFactor !== "number" || !Number.isFinite(x.geographicFactor) || x.geographicFactor <= 0 ||
    typeof x.allocatedRial !== "number" || !Number.isSafeInteger(x.allocatedRial) || x.allocatedRial < 0 ||
    typeof x.assessedAtUtc !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x.assessedAtUtc) ||
    !Number.isFinite(Date.parse(x.assessedAtUtc)) || Date.parse(x.assessedAtUtc) > now ||
    !x.scores || typeof x.scores !== "object" || Array.isArray(x.scores)) return null;
  const scores: Record<string,number> = {};
  for (const key of ["health","hardship","age","size","care","education"]) {
    const value = (x.scores as Record<string,unknown>)[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 3) return null;
    scores[key] = value;
  }
  return { snapshotId: x.snapshotId, householdKey: x.householdKey, datasetVersion: x.datasetVersion.trim(),
    sourceInstructionReference: x.sourceInstructionReference.trim(), evidenceReference: x.evidenceReference.trim(),
    geographicFactor: x.geographicFactor, allocatedRial: x.allocatedRial, assessedAtUtc: x.assessedAtUtc, scores };
}
