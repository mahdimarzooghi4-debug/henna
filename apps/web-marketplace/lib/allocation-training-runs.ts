export type TrainingRun = { id: string; status: "PROPOSED" | "NO_IMPROVEMENT"; datasetVersion: string; modelVersion: string; proposalId: string | null; recordedAtUtc: string };
export type TrainingRunDetail = TrainingRun & { cutoffUtc: string; poolRial: number; sourceInstructionReference: string; rubricVersion: string; trainingCount: number; validationCount: number; learningMetrics: { BaselineValidationMse: number; CandidateValidationMse: number } | null };
const uuid = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const text = (x: unknown): x is string => typeof x === "string" && !!x.trim() && x.length <= 120;
const date = (x: unknown): x is string => typeof x === "string" && x.length <= 50 && Number.isFinite(Date.parse(x));
const object = (x: unknown): Record<string,unknown> | null => !!x && typeof x === "object" && !Array.isArray(x) ? x as Record<string,unknown> : null;
function parseRun(raw: unknown): TrainingRun | null {
  const x = object(raw);
  if (!x || !uuid(x.id) || !text(x.datasetVersion) || !text(x.modelVersion) || !date(x.recordedAtUtc) ||
    !(x.status === "PROPOSED" && uuid(x.proposalId) || x.status === "NO_IMPROVEMENT" && x.proposalId === null)) return null;
  return x as TrainingRun;
}
export function parseTrainingRuns(raw: unknown): TrainingRun[] | null {
  const x = object(raw);
  if (!x || x.active !== false || !Array.isArray(x.items) || x.items.length > 20) return null;
  const rows = x.items.map(parseRun);
  return rows.every((r): r is TrainingRun => !!r) ? rows : null;
}
export function parseTrainingRunDetail(raw: unknown): TrainingRunDetail | null {
  const x = object(raw), run = parseRun(raw);
  if (!x || !run || x.active !== false || !date(x.cutoffUtc) || !text(x.sourceInstructionReference) || !text(x.rubricVersion) ||
    !Number.isSafeInteger(x.poolRial) || Number(x.poolRial) <= 0 || !Number.isInteger(x.trainingCount) || Number(x.trainingCount) < 30 ||
    !Number.isInteger(x.validationCount) || Number(x.validationCount) < 10 || Number(x.trainingCount)+Number(x.validationCount) > 500) return null;
  const metrics = object(x.learningMetrics);
  if (run.status === "PROPOSED" && (!metrics || [metrics.BaselineValidationMse,metrics.CandidateValidationMse].some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1))) return null;
  if (run.status === "NO_IMPROVEMENT" && x.learningMetrics !== null) return null;
  return x as TrainingRunDetail;
}
