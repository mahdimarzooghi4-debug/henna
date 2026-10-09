export const proposalId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export type ProposalItem = { id: string; candidateVersion: string; baselineVersion: string; modelVersion: string; createdAtUtc: string; decision: string | null };
export type ProposalDetail = { id: string; candidateVersion: string; rationale: string; status: string;
  weights: Record<string, number>; rows: { HouseholdKey?: string; HouseholdId?: string; BaselineAmountRial: number; ProposedAmountRial: number }[];
  metrics: Record<string, number> | null; reviewReason: string | null };
const object = (x: unknown): Record<string, unknown> | null => x !== null && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : null;
const text = (x: unknown, max: number): x is string => typeof x === "string" && !!x.trim() && x.length <= max;
const amount = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= Number.MAX_SAFE_INTEGER;
const status = (x: unknown) => ["PENDING_REVIEW", "APPROVED", "REJECTED"].includes(String(x));
export function parseProposalList(value: unknown): ProposalItem[] | null {
  const x = object(value);
  if (!x || x.active !== false || !Array.isArray(x.items) || x.items.length > 50) return null;
  const items: ProposalItem[] = [];
  for (const raw of x.items) {
    const item = object(raw);
    if (!item || typeof item.id !== "string" || !proposalId(item.id) || !text(item.candidateVersion, 120) ||
      !text(item.baselineVersion, 120) || !text(item.modelVersion, 120) || !text(item.createdAtUtc, 50) ||
      Number.isNaN(Date.parse(item.createdAtUtc)) || (item.decision !== null && !["APPROVED", "REJECTED"].includes(String(item.decision)))) return null;
    items.push(item as ProposalItem);
  }
  return items;
}
export function parseProposalDetail(value: unknown): ProposalDetail | null {
  const x = object(value), weights = object(x?.weights), simulation = object(x?.simulation);
  const keys = ["Health", "Hardship", "Age", "Size", "Care", "Education"];
  if (!x || x.active !== false || typeof x.id !== "string" || !proposalId(x.id) || !text(x.candidateVersion, 120) ||
    !text(x.rationale, 2000) || !status(x.status) || !weights || !keys.every(k => amount(weights[k]) && Number(weights[k]) <= 1) ||
    Math.abs(keys.reduce((sum, k) => sum + Number(weights[k]), 0) - 1) > 1e-8 ||
    !Array.isArray(simulation?.Rows) || simulation.Rows.length < 1 || simulation.Rows.length > 500) return null;
  const rows = simulation.Rows.map(object);
  if (rows.some(r => !r || typeof r.HouseholdKey !== "string" || !proposalId(r.HouseholdKey) ||
    !amount(r.BaselineAmountRial) || !amount(r.ProposedAmountRial))) return null;
  const rawMetrics = x.learningMetrics == null ? null : object(x.learningMetrics);
  if (x.learningMetrics != null && (!rawMetrics || !["TrainingCount", "ValidationCount", "BaselineValidationMse", "CandidateValidationMse"]
    .every(k => amount(rawMetrics[k])))) return null;
  const review = x.review === null ? null : object(x.review);
  if ((x.status === "PENDING_REVIEW" && review !== null) || (x.status !== "PENDING_REVIEW" &&
    (!review || review.decision !== x.status || !text(review.reason, 2000)))) return null;
  return { id: x.id, candidateVersion: x.candidateVersion, rationale: x.rationale, status: String(x.status),
    weights: Object.fromEntries(keys.map(k => [k, Number(weights[k])])),
    rows: rows as ProposalDetail["rows"], metrics: rawMetrics as Record<string, number> | null,
    reviewReason: review ? String(review.reason) : null };
}
