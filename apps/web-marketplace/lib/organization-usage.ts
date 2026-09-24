export type OrganizationUsageStatus = {
  organizationType: string;
  lastRecordedSyncAtUtc: null;
  summary: {
    available: false;
    totalAllocated: null;
    activeInUse: null;
    consumed: null;
    idleOrUnused: null;
  };
  beneficiaryUsage: {
    available: false;
    items: [];
  };
  capability: {
    state: "NOT_CONFIGURED";
    monetaryUsageReadModelAvailable: false;
    ledgerAvailable: false;
  };
};

export type OrganizationUsageStatusState =
  | { status: "ready"; data: OrganizationUsageStatus }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" };

const controlChars = /[\u0000-\u001f\u007f]/;

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  const actual = Object.keys(value);
  return actual.length === keys.length &&
    actual.every(key => keys.includes(key));
}

function safeText(value: unknown, max: number): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= max &&
    !controlChars.test(value);
}

export function parseOrganizationUsageStatus(
  value: unknown,
): OrganizationUsageStatus | null {
  if (!value || typeof value !== "object")
    return null;

  const data = value as Record<string, unknown>;
  if (!exactKeys(
      data,
      [
        "organizationType",
        "lastRecordedSyncAtUtc",
        "summary",
        "beneficiaryUsage",
        "capability",
      ],
    ) ||
    !safeText(data.organizationType, 80) ||
    data.lastRecordedSyncAtUtc !== null ||
    !data.summary ||
    typeof data.summary !== "object" ||
    !data.beneficiaryUsage ||
    typeof data.beneficiaryUsage !== "object" ||
    !data.capability ||
    typeof data.capability !== "object")
    return null;

  const summary = data.summary as Record<string, unknown>;
  if (!exactKeys(
      summary,
      [
        "available",
        "totalAllocated",
        "activeInUse",
        "consumed",
        "idleOrUnused",
      ],
    ) ||
    summary.available !== false ||
    summary.totalAllocated !== null ||
    summary.activeInUse !== null ||
    summary.consumed !== null ||
    summary.idleOrUnused !== null)
    return null;

  const beneficiaryUsage =
    data.beneficiaryUsage as Record<string, unknown>;
  if (!exactKeys(
      beneficiaryUsage,
      ["available", "items"],
    ) ||
    beneficiaryUsage.available !== false ||
    !Array.isArray(beneficiaryUsage.items) ||
    beneficiaryUsage.items.length !== 0)
    return null;

  const capability = data.capability as Record<string, unknown>;
  if (!exactKeys(
      capability,
      [
        "state",
        "monetaryUsageReadModelAvailable",
        "ledgerAvailable",
      ],
    ) ||
    capability.state !== "NOT_CONFIGURED" ||
    capability.monetaryUsageReadModelAvailable !== false ||
    capability.ledgerAvailable !== false)
    return null;

  return {
    organizationType: data.organizationType.trim(),
    lastRecordedSyncAtUtc: null,
    summary: {
      available: false,
      totalAllocated: null,
      activeInUse: null,
      consumed: null,
      idleOrUnused: null,
    },
    beneficiaryUsage: {
      available: false,
      items: [],
    },
    capability: {
      state: "NOT_CONFIGURED",
      monetaryUsageReadModelAvailable: false,
      ledgerAvailable: false,
    },
  };
}
