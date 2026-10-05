type Row = Record<string, unknown>;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function row(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Row : null;
}
function id(value: unknown): value is string {
  return typeof value === "string" && ID.test(value) &&
    value !== "00000000-0000-0000-0000-000000000000";
}
function textValue(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
function money(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function utc(value: unknown): value is string {
  return typeof value === "string" && value.length <= 50 &&
    Number.isFinite(Date.parse(value));
}

export type OrganizationSummaryItem = {
  id: string;
  name: string;
};

export type OrganizationProgramItem = {
  id: string;
  organizationId: string;
  name: string;
  fundedRial: number;
  unallocatedRial: number;
  expiresAtUtc: string;
  categoryCount: number;
};

export type OrganizationDashboardData = {
  organizations: OrganizationSummaryItem[];
  programs: OrganizationProgramItem[];
  truncated: boolean;
};

export function parseOrganizationResourcePage(
  raw: unknown,
  expectedPage: number,
): OrganizationSummaryItem[] | null {
  const data = row(raw);
  if (!data || data.page !== expectedPage || data.pageSize !== 20 ||
      !Array.isArray(data.items) || data.items.length > 20) return null;
  const out: OrganizationSummaryItem[] = [];
  for (const value of data.items) {
    const item = row(value);
    if (!item || !id(item.Id) || !textValue(item.Name, 200))
      return null;
    out.push({ id: item.Id, name: item.Name.trim() });
  }
  return out;
}

export function parseOrganizationProgramPage(
  raw: unknown,
  expectedPage: number,
  allowedOrganizations: Set<string>,
): OrganizationProgramItem[] | null {
  const data = row(raw);
  if (!data || data.page !== expectedPage || data.pageSize !== 20 ||
      !Array.isArray(data.items) || data.items.length > 20) return null;
  const out: OrganizationProgramItem[] = [];
  for (const value of data.items) {
    const item = row(value);
    if (!item || !id(item.Id) || !id(item.OrganizationId) ||
        !allowedOrganizations.has(item.OrganizationId) ||
        !textValue(item.Name, 120) || !money(item.FundedRial) ||
        !money(item.UnallocatedRial) ||
        item.UnallocatedRial > item.FundedRial ||
        !utc(item.ExpiresAtUtc) || !Array.isArray(item.CategoryIds) ||
        item.CategoryIds.length < 1 || item.CategoryIds.length > 100 ||
        !item.CategoryIds.every(id)) return null;
    out.push({
      id: item.Id,
      organizationId: item.OrganizationId,
      name: item.Name.trim(),
      fundedRial: item.FundedRial,
      unallocatedRial: item.UnallocatedRial,
      expiresAtUtc: item.ExpiresAtUtc,
      categoryCount: item.CategoryIds.length,
    });
  }
  return out;
}

export function organizationRial(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value) + " ریال";
}

export function organizationDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" })
    .format(new Date(value));
}
