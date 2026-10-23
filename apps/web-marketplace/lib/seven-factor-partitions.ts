import { uuidPattern } from "./seven-factor-evidence";

// This is a structural review only; no training Dataset or positive label admission.
export const partitionContract = "HENNA-SEVEN-FACTOR-HUMAN-PARTITION-PREFLIGHT-v1";
export const partitionNotAdmitted = "NOT_ADMITTED_COMPLETE_RUBRIC_AND_EVALUATION_GOVERNANCE_REQUIRED";
const digest = /^[0-9a-f]{64}$/;
const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const utc = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(v) &&
  !Number.isNaN(Date.parse(v));
const safeText = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 180;
const inactive = (v: Record<string, unknown>) =>
  v.active === false && v.admitted === false && v.runtimeApplied === false &&
  v.contractVersion === partitionContract && v.admissionStatus === partitionNotAdmitted;

export type HumanReview = {
  id: string; sevenFactorReviewId: string; reviewedAtUtc: string;
  evidenceDisposition: number; scaleVersion: string; criteriaVersion: string;
};
export type HumanReviewInventory = {
  items: HumanReview[]; page: number; hasMore: boolean;
  contractVersion: typeof partitionContract; admissionStatus: typeof partitionNotAdmitted;
  active: false; admitted: false; runtimeApplied: false;
};
export type PartitionPreflightPreview = {
  contractVersion: typeof partitionContract; cutoffUtc: string;
  sourceFormulaVersion: string; sourceDatasetVersion: string;
  sourceInstructionReference: string; trainingCount: number;
  validationCount: number; evaluationCount: number;
  sha256: string; admissionStatus: typeof partitionNotAdmitted;
  active: false; admitted: false; runtimeApplied: false;
};
export function parseHumanReviewInventory(raw: unknown): HumanReviewInventory | null {
  if (!isObject(raw) || !inactive(raw) ||
      !Number.isInteger(raw.page) || (raw.page as number) < 1 || (raw.page as number) > 10000 ||
      typeof raw.hasMore !== "boolean" || !Array.isArray(raw.items) || raw.items.length > 20)
    return null;
  const items: HumanReview[] = [];
  for (const r of raw.items) {
    if (!isObject(r) || typeof r.id !== "string" || !uuidPattern.test(r.id) ||
        typeof r.sevenFactorReviewId !== "string" || !uuidPattern.test(r.sevenFactorReviewId) ||
        !utc(r.reviewedAtUtc) || !Number.isInteger(r.evidenceDisposition) ||
        (r.evidenceDisposition as number) < 0 || (r.evidenceDisposition as number) > 3 ||
        !safeText(r.scaleVersion) || !safeText(r.criteriaVersion)) return null;
    items.push({
      id: r.id, sevenFactorReviewId: r.sevenFactorReviewId,
      reviewedAtUtc: r.reviewedAtUtc,
      evidenceDisposition: r.evidenceDisposition as number,
      scaleVersion: r.scaleVersion, criteriaVersion: r.criteriaVersion,
    });
  }
  if (new Set(items.map(x => x.id)).size !== items.length) return null;
  return { items, page: raw.page as number, hasMore: raw.hasMore,
    contractVersion: partitionContract, admissionStatus: partitionNotAdmitted,
    active: false, admitted: false, runtimeApplied: false };
}
export function parsePartitionPreflightPreview(raw: unknown): PartitionPreflightPreview | null {
  if (!isObject(raw) || !inactive(raw) || !utc(raw.cutoffUtc) ||
      !safeText(raw.sourceFormulaVersion) || !safeText(raw.sourceDatasetVersion) ||
      !safeText(raw.sourceInstructionReference) ||
      typeof raw.sha256 !== "string" || !digest.test(raw.sha256)) return null;
  for (const key of ["trainingCount", "validationCount", "evaluationCount"] as const) {
    if (!Number.isInteger(raw[key]) || (raw[key] as number) < 1 ||
        (raw[key] as number) > 500) return null;
  }
  const count = (raw.trainingCount as number) + (raw.validationCount as number) +
    (raw.evaluationCount as number);
  if (count > 500) return null;
  return {
    contractVersion: partitionContract, cutoffUtc: raw.cutoffUtc,
    sourceFormulaVersion: raw.sourceFormulaVersion,
    sourceDatasetVersion: raw.sourceDatasetVersion,
    sourceInstructionReference: raw.sourceInstructionReference,
    trainingCount: raw.trainingCount as number,
    validationCount: raw.validationCount as number,
    evaluationCount: raw.evaluationCount as number,
    sha256: raw.sha256, admissionStatus: partitionNotAdmitted,
    active: false, admitted: false, runtimeApplied: false,
  };
}

export type PartitionChoices = {
  trainingReviewIds: string[]; validationReviewIds: string[];
  evaluationReviewIds: string[]; cutoffUtc: string;
};
export function validPartitionChoices(input: unknown): input is PartitionChoices {
  if (!isObject(input) || Object.keys(input).sort().join("|") !==
      ["cutoffUtc", "evaluationReviewIds", "trainingReviewIds", "validationReviewIds"].join("|"))
    return false;
  const groups = [input.trainingReviewIds, input.validationReviewIds, input.evaluationReviewIds];
  if (groups.some(g => !Array.isArray(g) || g.length === 0) ||
      !groups.every(g => (g as unknown[]).every(id => typeof id === "string" && uuidPattern.test(id))))
    return false;
  const ids = groups.flat() as string[];
  return ids.length <= 500 && new Set(ids.map(id => id.toLowerCase())).size === ids.length &&
    utc(input.cutoffUtc) && Date.parse(input.cutoffUtc) <= Date.now();
}
