// v1.1 reviewed evidence is not automatically a label, Dataset or Production model.
export const sevenFactorFormula = "HANA-NEEDS-BASED-ALLOCATION-v1.1";
export const sevenFactorAdmission = "REVIEW_ONLY_NUMERIC_RUBRIC_REQUIRED";
export const sevenFactorManifest = "HENNA-SEVEN-FACTOR-REVIEW-INVENTORY-v1";
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digestPattern = /^[a-f0-9]{64}$/;
const record = (x: unknown): Record<string, unknown> | null =>
  x !== null && typeof x === "object" && !Array.isArray(x)
    ? x as Record<string, unknown> : null;
const validUtc = (x: unknown) => typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(x) &&
  !Number.isNaN(Date.parse(x));
const safeString = (x: unknown) => typeof x === "string" && x.length > 0 && x.length <= 160;

export type SevenFactorEvidenceItem = {
  id: string; reviewedAtUtc: string; formulaVersion: string; hasQualitativeReview: boolean
};
export type SevenFactorEvidenceInventory = {
  items: SevenFactorEvidenceItem[]; page: number; hasMore: boolean;
  formulaVersion: typeof sevenFactorFormula; admissionStatus: typeof sevenFactorAdmission;
  active: false; admitted: false; runtimeApplied: false
};
export type SevenFactorEvidencePreview = {
  manifestContractVersion: typeof sevenFactorManifest;
  formulaVersion: typeof sevenFactorFormula;
  sourceFormulaVersion: string; sourceDatasetVersion: string;
  sourceInstructionReference: string; cutoffUtc: string;
  reviewedHouseholdCount: number; sha256: string;
  admissionStatus: typeof sevenFactorAdmission;
  active: false; admitted: false; runtimeApplied: false
};

const safeInactive = (x: Record<string, unknown>) =>
  x.active === false && x.admitted === false && x.runtimeApplied === false &&
  x.admissionStatus === sevenFactorAdmission &&
  x.formulaVersion === sevenFactorFormula;

export function parseSevenFactorInventory(raw: unknown): SevenFactorEvidenceInventory | null {
  const x = record(raw);
  if (!x || !safeInactive(x) || !Number.isInteger(x.page) ||
      (x.page as number) < 1 || (x.page as number) > 10000 ||
      typeof x.hasMore !== "boolean" || !Array.isArray(x.items) || x.items.length > 20)
    return null;
  const items: SevenFactorEvidenceItem[] = [];
  for (const value of x.items) {
    const item = record(value);
    if (!item || typeof item.id !== "string" || !uuidPattern.test(item.id) ||
        !validUtc(item.reviewedAtUtc) || item.formulaVersion !== sevenFactorFormula ||
        typeof item.hasQualitativeReview !== "boolean") return null;
    items.push({
      id: item.id, reviewedAtUtc: item.reviewedAtUtc as string,
      formulaVersion: sevenFactorFormula, hasQualitativeReview: item.hasQualitativeReview,
    });
  }
  if (new Set(items.map(i => i.id)).size !== items.length) return null;
  return { items, page: x.page as number, hasMore: x.hasMore,
    formulaVersion: sevenFactorFormula, admissionStatus: sevenFactorAdmission,
    active: false, admitted: false, runtimeApplied: false };
}

export function parseSevenFactorPreview(raw: unknown): SevenFactorEvidencePreview | null {
  const x = record(raw);
  if (!x || !safeInactive(x) || x.manifestContractVersion !== sevenFactorManifest ||
      !safeString(x.sourceFormulaVersion) || !safeString(x.sourceDatasetVersion) ||
      !safeString(x.sourceInstructionReference) || !validUtc(x.cutoffUtc) ||
      !Number.isInteger(x.reviewedHouseholdCount) ||
      (x.reviewedHouseholdCount as number) < 1 || (x.reviewedHouseholdCount as number) > 500 ||
      typeof x.sha256 !== "string" || !digestPattern.test(x.sha256)) return null;
  return {
    manifestContractVersion: sevenFactorManifest, formulaVersion: sevenFactorFormula,
    sourceFormulaVersion: x.sourceFormulaVersion as string,
    sourceDatasetVersion: x.sourceDatasetVersion as string,
    sourceInstructionReference: x.sourceInstructionReference as string,
    cutoffUtc: x.cutoffUtc as string, reviewedHouseholdCount: x.reviewedHouseholdCount as number,
    sha256: x.sha256, admissionStatus: sevenFactorAdmission,
    active: false, admitted: false, runtimeApplied: false
  };
}
