import {
  organizationProgramIdPattern,
  type OrganizationProgramStatus,
} from "./organization-programs";

export type OrganizationAllocationSourceCounts = {
  manualRecordCount: number;
  apiRecordCount: number;
};

export type OrganizationAllocationProgramReadiness = {
  id: string;
  name: string;
  status: Extract<OrganizationProgramStatus, "REGISTERED" | "ACTIVE">;
  allocationMethod: string;
  inputRecordCount: number;
  readyRecordCount: number;
  needsReviewRecordCount: number;
  sources: OrganizationAllocationSourceCounts;
};

export type OrganizationAllocationExecutionBoundary = {
  enabled: false;
  state: "NOT_CONFIGURED";
  monetaryMutationSupported: false;
};

export type OrganizationAllocationReadiness = {
  organizationType: string;
  allocationMethod: string;
  targetPeriod: null;
  eligibleProgramCount: number;
  inputRecordCount: number;
  readyRecordCount: number;
  needsReviewRecordCount: number;
  sources: OrganizationAllocationSourceCounts;
  programs: OrganizationAllocationProgramReadiness[];
  execution: OrganizationAllocationExecutionBoundary;
  processHistory: {
    available: false;
    items: [];
  };
};

export type OrganizationAllocationProgramDetail = {
  program: OrganizationAllocationProgramReadiness;
  targetPeriod: null;
  execution: OrganizationAllocationExecutionBoundary;
  result: {
    available: false;
    allocatedRecordCount: null;
    needsReviewRecordCount: number;
  };
};

export type OrganizationAllocationReadinessState =
  | { status: "ready"; data: OrganizationAllocationReadiness }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" };

export type OrganizationAllocationProgramState =
  | { status: "ready"; data: OrganizationAllocationProgramDetail }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "unavailable" };

const controlChars = /[\u0000-\u001f\u007f]/;

function requiredString(value: unknown, max: number): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= max &&
    !controlChars.test(value);
}

function count(value: unknown, max = 2147483647): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max;
}

function objectKeysExactly(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    actual.every(key => keys.includes(key));
}

function parseSources(
  value: unknown,
): OrganizationAllocationSourceCounts | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (!objectKeysExactly(
      data,
      ["manualRecordCount", "apiRecordCount"],
    ) ||
    !count(data.manualRecordCount) ||
    !count(data.apiRecordCount))
    return null;

  return {
    manualRecordCount: data.manualRecordCount,
    apiRecordCount: data.apiRecordCount,
  };
}

function parseExecution(
  value: unknown,
): OrganizationAllocationExecutionBoundary | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  return objectKeysExactly(
      data,
      ["enabled", "state", "monetaryMutationSupported"],
    ) &&
    data.enabled === false &&
    data.state === "NOT_CONFIGURED" &&
    data.monetaryMutationSupported === false
    ? {
        enabled: false,
        state: "NOT_CONFIGURED",
        monetaryMutationSupported: false,
      }
    : null;
}

function parseProgram(
  value: unknown,
): OrganizationAllocationProgramReadiness | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const keys = [
    "id",
    "name",
    "status",
    "allocationMethod",
    "inputRecordCount",
    "readyRecordCount",
    "needsReviewRecordCount",
    "sources",
  ] as const;

  if (!objectKeysExactly(data, keys) ||
    typeof data.id !== "string" ||
    !organizationProgramIdPattern.test(data.id) ||
    !requiredString(data.name, 200) ||
    (data.status !== "REGISTERED" && data.status !== "ACTIVE") ||
    !requiredString(data.allocationMethod, 120) ||
    !count(data.inputRecordCount) ||
    !count(data.readyRecordCount) ||
    !count(data.needsReviewRecordCount))
    return null;

  const sources = parseSources(data.sources);
  if (!sources ||
    data.readyRecordCount + data.needsReviewRecordCount !==
      data.inputRecordCount ||
    sources.manualRecordCount + sources.apiRecordCount !==
      data.inputRecordCount)
    return null;

  return {
    id: data.id,
    name: data.name.trim(),
    status: data.status,
    allocationMethod: data.allocationMethod.trim(),
    inputRecordCount: data.inputRecordCount,
    readyRecordCount: data.readyRecordCount,
    needsReviewRecordCount: data.needsReviewRecordCount,
    sources,
  };
}

export function parseOrganizationAllocationReadiness(
  value: unknown,
): OrganizationAllocationReadiness | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const keys = [
    "organizationType",
    "allocationMethod",
    "targetPeriod",
    "eligibleProgramCount",
    "inputRecordCount",
    "readyRecordCount",
    "needsReviewRecordCount",
    "sources",
    "programs",
    "execution",
    "processHistory",
  ] as const;

  if (!objectKeysExactly(data, keys) ||
    !requiredString(data.organizationType, 80) ||
    !requiredString(data.allocationMethod, 120) ||
    data.targetPeriod !== null ||
    !count(data.eligibleProgramCount, 100000) ||
    !count(data.inputRecordCount) ||
    !count(data.readyRecordCount) ||
    !count(data.needsReviewRecordCount) ||
    !Array.isArray(data.programs))
    return null;

  const sources = parseSources(data.sources);
  const execution = parseExecution(data.execution);
  if (!sources || !execution ||
    !data.processHistory ||
    typeof data.processHistory !== "object")
    return null;

  const history = data.processHistory as Record<string, unknown>;
  if (!objectKeysExactly(history, ["available", "items"]) ||
    history.available !== false ||
    !Array.isArray(history.items) ||
    history.items.length !== 0)
    return null;

  const programs: OrganizationAllocationProgramReadiness[] = [];
  const seen = new Set<string>();
  for (const raw of data.programs) {
    const program = parseProgram(raw);
    if (!program || seen.has(program.id)) return null;
    seen.add(program.id);
    programs.push(program);
  }

  if (programs.length !== data.eligibleProgramCount ||
    programs.reduce((sum, item) => sum + item.inputRecordCount, 0) !==
      data.inputRecordCount ||
    programs.reduce((sum, item) => sum + item.readyRecordCount, 0) !==
      data.readyRecordCount ||
    programs.reduce((sum, item) => sum + item.needsReviewRecordCount, 0) !==
      data.needsReviewRecordCount ||
    programs.reduce((sum, item) => sum + item.sources.manualRecordCount, 0) !==
      sources.manualRecordCount ||
    programs.reduce((sum, item) => sum + item.sources.apiRecordCount, 0) !==
      sources.apiRecordCount)
    return null;

  return {
    organizationType: data.organizationType.trim(),
    allocationMethod: data.allocationMethod.trim(),
    targetPeriod: null,
    eligibleProgramCount: data.eligibleProgramCount,
    inputRecordCount: data.inputRecordCount,
    readyRecordCount: data.readyRecordCount,
    needsReviewRecordCount: data.needsReviewRecordCount,
    sources,
    programs,
    execution,
    processHistory: { available: false, items: [] },
  };
}

export function parseOrganizationAllocationProgramDetail(
  value: unknown,
): OrganizationAllocationProgramDetail | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (!objectKeysExactly(
      data,
      ["program", "targetPeriod", "execution", "result"],
    ) ||
    data.targetPeriod !== null ||
    !data.result ||
    typeof data.result !== "object")
    return null;

  const program = parseProgram(data.program);
  const execution = parseExecution(data.execution);
  const result = data.result as Record<string, unknown>;
  if (!program || !execution ||
    !objectKeysExactly(
      result,
      [
        "available",
        "allocatedRecordCount",
        "needsReviewRecordCount",
      ],
    ) ||
    result.available !== false ||
    result.allocatedRecordCount !== null ||
    !count(result.needsReviewRecordCount) ||
    result.needsReviewRecordCount !== program.needsReviewRecordCount)
    return null;

  return {
    program,
    targetPeriod: null,
    execution,
    result: {
      available: false,
      allocatedRecordCount: null,
      needsReviewRecordCount: result.needsReviewRecordCount,
    },
  };
}
