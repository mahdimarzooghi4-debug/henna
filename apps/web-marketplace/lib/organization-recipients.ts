import {
  organizationProgramIdPattern,
  organizationProgramStatuses,
  type OrganizationProgramStatus,
} from "./organization-programs";

export const organizationRecipientSources = ["MANUAL", "API"] as const;
export type OrganizationRecipientSource =
  (typeof organizationRecipientSources)[number];

export const organizationRecipientMatchStatuses = [
  "MATCHED",
  "NEEDS_MATCH",
  "PENDING_REVIEW",
] as const;
export type OrganizationRecipientMatchStatus =
  (typeof organizationRecipientMatchStatuses)[number];

export type OrganizationRecipientProgram = {
  id: string;
  name: string;
  status: OrganizationProgramStatus;
};

export type OrganizationRecipient = {
  id: string;
  displayName: string;
  referenceMasked: string;
  source: OrganizationRecipientSource;
  matchStatus: OrganizationRecipientMatchStatus;
  hanaAccountMatched: boolean;
  program: OrganizationRecipientProgram;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type OrganizationRecipientList = {
  items: OrganizationRecipient[];
  page: number;
  pageSize: number;
  total: number;
};

export type OrganizationRecipientListQuery = {
  page: number;
  pageSize: number;
  programId: string | null;
  source: OrganizationRecipientSource | null;
  matchStatus: OrganizationRecipientMatchStatus | null;
  search: string | null;
};

export type OrganizationRecipientsState =
  | { status: "ready"; data: OrganizationRecipientList }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "invalid" };

export const defaultRecipientListQuery: OrganizationRecipientListQuery = {
  page: 1,
  pageSize: 20,
  programId: null,
  source: null,
  matchStatus: null,
  search: null,
};

export const organizationRecipientSourceLabels:
  Record<OrganizationRecipientSource, string> = {
    API: "API / منبع داده سازمان",
    MANUAL: "ورود دستی",
  };

export const organizationRecipientMatchLabels:
  Record<OrganizationRecipientMatchStatus, string> = {
    MATCHED: "حساب حنا شناسایی شده",
    NEEDS_MATCH: "نیازمند تطبیق",
    PENDING_REVIEW: "در انتظار بررسی",
  };

const controlChars = /[\u0000-\u001f\u007f]/;
const recipientIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredString(value: unknown, max: number): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= max &&
    !controlChars.test(value);
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

function isProgramStatus(value: unknown): value is OrganizationProgramStatus {
  return typeof value === "string" &&
    (organizationProgramStatuses as readonly string[]).includes(value);
}

function isSource(value: unknown): value is OrganizationRecipientSource {
  return typeof value === "string" &&
    (organizationRecipientSources as readonly string[]).includes(value);
}

function isMatchStatus(
  value: unknown,
): value is OrganizationRecipientMatchStatus {
  return typeof value === "string" &&
    (organizationRecipientMatchStatuses as readonly string[]).includes(value);
}

function parseRecipient(value: unknown): OrganizationRecipient | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const programValue = data.program;
  if (!programValue || typeof programValue !== "object") return null;
  const program = programValue as Record<string, unknown>;

  if (typeof data.id !== "string" ||
    !recipientIdPattern.test(data.id) ||
    !requiredString(data.displayName, 200) ||
    !requiredString(data.referenceMasked, 80) ||
    !isSource(data.source) ||
    !isMatchStatus(data.matchStatus) ||
    typeof data.hanaAccountMatched !== "boolean" ||
    typeof program.id !== "string" ||
    !organizationProgramIdPattern.test(program.id) ||
    !requiredString(program.name, 200) ||
    !isProgramStatus(program.status) ||
    !isoDate(data.createdAtUtc) ||
    !isoDate(data.updatedAtUtc))
    return null;

  if ((data.matchStatus === "MATCHED") !== data.hanaAccountMatched)
    return null;

  return {
    id: data.id,
    displayName: data.displayName.trim(),
    referenceMasked: data.referenceMasked.trim(),
    source: data.source,
    matchStatus: data.matchStatus,
    hanaAccountMatched: data.hanaAccountMatched,
    program: {
      id: program.id,
      name: program.name.trim(),
      status: program.status,
    },
    createdAtUtc: data.createdAtUtc,
    updatedAtUtc: data.updatedAtUtc,
  };
}

export function parseOrganizationRecipientList(
  value: unknown,
): OrganizationRecipientList | null {
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

  const items: OrganizationRecipient[] = [];
  for (const raw of data.items) {
    const item = parseRecipient(raw);
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

export function parseOrganizationRecipientPageQuery(
  values: Record<string, string | string[] | undefined>,
): OrganizationRecipientListQuery | null {
  const allowed = new Set([
    "page", "pageSize", "programId", "source", "matchStatus", "search",
  ]);
  if (Object.keys(values).some(key => !allowed.has(key))) return null;

  const rawPage = single(values.page);
  const rawPageSize = single(values.pageSize);
  const rawProgramId = single(values.programId);
  const rawSource = single(values.source);
  const rawMatchStatus = single(values.matchStatus);
  const rawSearch = single(values.search);
  const supplied = [
    ["page", rawPage],
    ["pageSize", rawPageSize],
    ["programId", rawProgramId],
    ["source", rawSource],
    ["matchStatus", rawMatchStatus],
    ["search", rawSearch],
  ] as const;
  for (const [key, parsed] of supplied) {
    if (values[key] !== undefined && parsed === null) return null;
  }

  const page = parseInteger(rawPage, 1, 1, 10000);
  const pageSize = parseInteger(rawPageSize, 20, 1, 50);
  if (page === null || pageSize === null) return null;

  const programId = rawProgramId?.trim() || null;
  if (programId !== null && !organizationProgramIdPattern.test(programId))
    return null;

  const normalizedSource = rawSource?.trim().toUpperCase() || null;
  if (normalizedSource !== null && !isSource(normalizedSource))
    return null;

  const normalizedMatchStatus =
    rawMatchStatus?.trim().toUpperCase() || null;
  if (normalizedMatchStatus !== null &&
    !isMatchStatus(normalizedMatchStatus))
    return null;

  const search = rawSearch?.trim() || null;
  if (search !== null &&
    (search.length > 120 || controlChars.test(search)))
    return null;

  return {
    page,
    pageSize,
    programId,
    source: normalizedSource,
    matchStatus: normalizedMatchStatus,
    search,
  };
}

export function parseOrganizationRecipientUrlQuery(
  params: URLSearchParams,
): OrganizationRecipientListQuery | null {
  const values: Record<string, string | string[] | undefined> = {};
  for (const key of params.keys()) {
    const all = params.getAll(key);
    values[key] = all.length === 1 ? all[0] : all;
  }
  return parseOrganizationRecipientPageQuery(values);
}

export function recipientListQueryString(
  query: OrganizationRecipientListQuery,
): string {
  const params = new URLSearchParams();
  if (query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize !== 20)
    params.set("pageSize", String(query.pageSize));
  if (query.programId) params.set("programId", query.programId);
  if (query.source) params.set("source", query.source);
  if (query.matchStatus) params.set("matchStatus", query.matchStatus);
  if (query.search) params.set("search", query.search);
  return params.toString();
}
