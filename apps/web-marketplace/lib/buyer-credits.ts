/** Strict, read-only credit view. Never fabricate missing balances or infer funding sources. */
export type BuyerCredit = {
  id: string;
  programId: string;
  grantedRial: number;
  availableRial: number;
  expiresAtUtc: string;
  categoryIds: string[];
};
export type BuyerCreditsPage = { items: BuyerCredit[]; page: number; pageSize: 20 };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const obj = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === "string" &&
  uuid.test(value) && value !== "00000000-0000-0000-0000-000000000000";
const rial = (value: unknown): value is number => typeof value === "number" &&
  Number.isSafeInteger(value) && value >= 0;
const utc = (value: unknown): value is string => typeof value === "string" &&
  value.length <= 40 && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

export function parseBuyerCreditsPage(input: unknown, expectedPage: number): BuyerCreditsPage | null {
  if (!obj(input) || input.page !== expectedPage || input.pageSize !== 20 ||
      !Array.isArray(input.items) || input.items.length > 20) return null;
  const items: BuyerCredit[] = [];
  const seen = new Set<string>();
  for (const raw of input.items) {
    if (!obj(raw) || !isId(raw.id) || !isId(raw.programId) ||
        !rial(raw.grantedRial) || raw.grantedRial <= 0 ||
        !rial(raw.availableRial) || raw.availableRial > raw.grantedRial ||
        !utc(raw.expiresAtUtc) || !Array.isArray(raw.categoryIds) ||
        raw.categoryIds.length > 100 ||
        raw.categoryIds.some(x => !isId(x)) ||
        new Set(raw.categoryIds.map((x: string) => x.toLowerCase())).size !== raw.categoryIds.length ||
        seen.has(raw.id.toLowerCase())) return null;
    seen.add(raw.id.toLowerCase());
    items.push({
      id: raw.id, programId: raw.programId,
      grantedRial: raw.grantedRial, availableRial: raw.availableRial,
      expiresAtUtc: raw.expiresAtUtc, categoryIds: raw.categoryIds,
    });
  }
  return { items, page: expectedPage, pageSize: 20 };
}
