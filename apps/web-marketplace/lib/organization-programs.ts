export const organizationProgramStatuses = [
  "DRAFT", "REGISTERED", "ACTIVE", "PAUSED", "ENDED",
] as const;

export type OrganizationProgramStatus =
  (typeof organizationProgramStatuses)[number];

export type OrganizationProgramSummary = {
  id: string;
  name: string;
  kind: string;
  allocationMethod: string;
  beneficiarySource: string;
  status: OrganizationProgramStatus;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type OrganizationProgramDetail = OrganizationProgramSummary & {
  description: string | null;
  revision: number;
  registeredAtUtc: string | null;
};

export type OrganizationProgramList = {
  items: OrganizationProgramSummary[];
  page: number;
  pageSize: number;
  total: number;
};

export type OrganizationProgramListQuery = {
  page: number;
  pageSize: number;
  status: OrganizationProgramStatus | null;
};

export type OrganizationProgramsState =
  | { status: "ready"; data: OrganizationProgramList }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "invalid" };

export type OrganizationProgramDetailState =
  | { status: "ready"; program: OrganizationProgramDetail }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "unavailable" };

export type OrganizationProgramOptionsState =
  | { status: "ready"; programs: OrganizationProgramSummary[] }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export const defaultProgramListQuery: OrganizationProgramListQuery = {
  page: 1,
  pageSize: 20,
  status: null,
};

export const organizationProgramStatusLabels:
  Record<OrganizationProgramStatus, string> = {
    DRAFT: "پیش‌نویس",
    REGISTERED: "ثبت‌شده",
    ACTIVE: "فعال",
    PAUSED: "متوقف",
    ENDED: "پایان‌یافته",
  };

export const organizationProgramIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const controlChars = /[\u0000-\u001f\u007f]/;

function requiredString(value: unknown, max: number): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= max &&
    !controlChars.test(value);
}

function optionalString(value: unknown, max: number): value is string | null {
  return value === null ||
    (typeof value === "string" &&
      value.length <= max &&
      !controlChars.test(value));
}

function positiveInteger(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max;
}

function isoDate(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 64 &&
    Number.isFinite(Date.parse(value));
}

function isStatus(value: unknown): value is OrganizationProgramStatus {
  return typeof value === "string" &&
    (organizationProgramStatuses as readonly string[]).includes(value);
}

export function parseOrganizationProgramSummary(
  value: unknown,
): OrganizationProgramSummary | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const id = data.id;
  const name = data.name;
  const kind = data.kind;
  const allocationMethod = data.allocationMethod;
  const beneficiarySource = data.beneficiarySource;
  const status = data.status;
  const createdAtUtc = data.createdAtUtc;
  const updatedAtUtc = data.updatedAtUtc;

  if (typeof id !== "string" || !organizationProgramIdPattern.test(id) ||
    !requiredString(name, 200) ||
    !requiredString(kind, 120) ||
    !requiredString(allocationMethod, 120) ||
    !requiredString(beneficiarySource, 120) ||
    !isStatus(status) ||
    !isoDate(createdAtUtc) ||
    !isoDate(updatedAtUtc))
    return null;

  return {
    id,
    name: name.trim(),
    kind: kind.trim(),
    allocationMethod: allocationMethod.trim(),
    beneficiarySource: beneficiarySource.trim(),
    status,
    createdAtUtc,
    updatedAtUtc,
  };
}

export function parseOrganizationProgramList(
  value: unknown,
): OrganizationProgramList | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.items) ||
    !positiveInteger(data.page, 1, 10000) ||
    !positiveInteger(data.pageSize, 1, 50) ||
    typeof data.total !== "number" ||
    !Number.isSafeInteger(data.total) ||
    data.total < 0 ||
    data.items.length > data.pageSize)
    return null;

  const items: OrganizationProgramSummary[] = [];
  for (const raw of data.items) {
    const item = parseOrganizationProgramSummary(raw);
    if (!item) return null;
    items.push(item);
  }
  if (data.total < items.length) return null;

  return {
    items,
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
  };
}

export function parseOrganizationProgramDetail(
  value: unknown,
): OrganizationProgramDetail | null {
  const summary = parseOrganizationProgramSummary(value);
  if (!summary || !value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const description = data.description;
  const revision = data.revision;
  const registeredAtUtc = data.registeredAtUtc;
  if (!optionalString(description, 2000) ||
    !positiveInteger(revision, 1, 2147483646) ||
    !(registeredAtUtc === null || isoDate(registeredAtUtc)))
    return null;
  return {
    ...summary,
    description: description?.trim() || null,
    revision,
    registeredAtUtc,
  };
}

function single(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  return typeof value === "string" ? value : null;
}

function parseInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max
    ? parsed : null;
}

export function parseOrganizationProgramPageQuery(
  values: Record<string, string | string[] | undefined>,
): OrganizationProgramListQuery | null {
  const allowed = new Set(["page", "pageSize", "status"]);
  if (Object.keys(values).some(key => !allowed.has(key))) return null;

  const rawPage = single(values.page);
  const rawPageSize = single(values.pageSize);
  const rawStatus = single(values.status);
  if ((values.page !== undefined && rawPage === null) ||
    (values.pageSize !== undefined && rawPageSize === null) ||
    (values.status !== undefined && rawStatus === null))
    return null;

  const page = parseInteger(rawPage, 1, 1, 10000);
  const pageSize = parseInteger(rawPageSize, 20, 1, 50);
  const normalized = rawStatus?.trim().toUpperCase() || null;
  if (page === null || pageSize === null) return null;

  let status: OrganizationProgramStatus | null = null;
  if (normalized !== null) {
    if (!isStatus(normalized)) return null;
    status = normalized;
  }

  return { page, pageSize, status };
}

export function parseOrganizationProgramUrlQuery(
  params: URLSearchParams,
): OrganizationProgramListQuery | null {
  const values: Record<string, string | string[] | undefined> = {};
  for (const key of params.keys()) {
    const all = params.getAll(key);
    values[key] = all.length === 1 ? all[0] : all;
  }
  return parseOrganizationProgramPageQuery(values);
}

export function programListQueryString(
  query: OrganizationProgramListQuery,
): string {
  const params = new URLSearchParams();
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize !== 20)
    params.set("pageSize", String(query.pageSize));
  if (query.status) params.set("status", query.status);
  return params.toString();
}
