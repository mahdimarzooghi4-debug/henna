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
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER):
  value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= min && value <= max;
}
function utc(value: unknown): value is string {
  return typeof value === "string" && value.length <= 50 &&
    Number.isFinite(Date.parse(value));
}

export type OrganizationSummaryItem = {
  id: string;
  name: string;
  managerCount: number;
  beneficiaryCount: number;
  programCount: number;
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
  unreadNotifications: number;
  openTickets: number;
};

export function parseOrganizationDashboard(
  raw: unknown,
): OrganizationDashboardData | null {
  const data = row(raw);
  if (!data || !Array.isArray(data.organizations) ||
      data.organizations.length > 100 ||
      !Array.isArray(data.programs) || data.programs.length > 1000 ||
      !integer(data.unreadNotifications) || !integer(data.openTickets))
    return null;

  const organizations: OrganizationSummaryItem[] = [];
  const allowed = new Set<string>();
  for (const value of data.organizations) {
    const item = row(value);
    if (!item || !id(item.id) || !textValue(item.name, 200) ||
        !integer(item.managerCount) || !integer(item.beneficiaryCount) ||
        !integer(item.programCount)) return null;
    allowed.add(item.id);
    organizations.push({
      id: item.id,
      name: item.name.trim(),
      managerCount: item.managerCount,
      beneficiaryCount: item.beneficiaryCount,
      programCount: item.programCount,
    });
  }
  if (organizations.length === 0) return null;

  const programs: OrganizationProgramItem[] = [];
  for (const value of data.programs) {
    const item = row(value);
    if (!item || !id(item.id) || !id(item.organizationId) ||
        !allowed.has(item.organizationId) || !textValue(item.name, 120) ||
        !integer(item.fundedRial) || !integer(item.unallocatedRial) ||
        item.unallocatedRial > item.fundedRial ||
        !utc(item.expiresAtUtc) || !integer(item.categoryCount, 1, 100))
      return null;
    programs.push({
      id: item.id,
      organizationId: item.organizationId,
      name: item.name.trim(),
      fundedRial: item.fundedRial,
      unallocatedRial: item.unallocatedRial,
      expiresAtUtc: item.expiresAtUtc,
      categoryCount: item.categoryCount,
    });
  }

  for (const organization of organizations) {
    if (organization.programCount !==
        programs.filter(p => p.organizationId === organization.id).length)
      return null;
  }

  return {
    organizations,
    programs,
    unreadNotifications: data.unreadNotifications,
    openTickets: data.openTickets,
  };
}

export function organizationRial(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value) + " ریال";
}

export function organizationDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" })
    .format(new Date(value));
}
