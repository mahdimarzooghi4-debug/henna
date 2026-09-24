export type OrganizationReportsOverview = {
  organizationType: string;
  lastRecordedSyncAtUtc: null;
  matching: {
    available: true;
    scope: "ELIGIBLE_PROGRAM_RECIPIENT_RECORDS";
    eligibleProgramCount: number;
    totalEnrollmentRecordCount: number;
    matchedRecordCount: number;
    needsReviewRecordCount: number;
    matchRatePercent: number | null;
  };
  usage: {
    available: false;
    usedBudget: null;
    utilizationPercent: null;
  };
  allocationDistributionTrend: {
    available: false;
    points: [];
  };
  capability: {
    financialReportingAvailable: false;
    allocationDistributionTrendAvailable: false;
  };
};

export type OrganizationReportsOverviewState =
  | { status: "ready"; data: OrganizationReportsOverview }
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

function count(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 2147483647;
}

function validRate(value: unknown): value is number | null {
  return value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100);
}

export function parseOrganizationReportsOverview(
  value: unknown,
): OrganizationReportsOverview | null {
  if (!value || typeof value !== "object")
    return null;

  const data = value as Record<string, unknown>;
  if (!exactKeys(
      data,
      [
        "organizationType",
        "lastRecordedSyncAtUtc",
        "matching",
        "usage",
        "allocationDistributionTrend",
        "capability",
      ],
    ) ||
    !safeText(data.organizationType, 80) ||
    data.lastRecordedSyncAtUtc !== null ||
    !data.matching ||
    typeof data.matching !== "object" ||
    !data.usage ||
    typeof data.usage !== "object" ||
    !data.allocationDistributionTrend ||
    typeof data.allocationDistributionTrend !== "object" ||
    !data.capability ||
    typeof data.capability !== "object")
    return null;

  const matching = data.matching as Record<string, unknown>;
  if (!exactKeys(
      matching,
      [
        "available",
        "scope",
        "eligibleProgramCount",
        "totalEnrollmentRecordCount",
        "matchedRecordCount",
        "needsReviewRecordCount",
        "matchRatePercent",
      ],
    ) ||
    matching.available !== true ||
    matching.scope !== "ELIGIBLE_PROGRAM_RECIPIENT_RECORDS" ||
    !count(matching.eligibleProgramCount) ||
    !count(matching.totalEnrollmentRecordCount) ||
    !count(matching.matchedRecordCount) ||
    !count(matching.needsReviewRecordCount) ||
    !validRate(matching.matchRatePercent) ||
    matching.matchedRecordCount + matching.needsReviewRecordCount !==
      matching.totalEnrollmentRecordCount)
    return null;

  if (matching.totalEnrollmentRecordCount === 0) {
    if (matching.matchRatePercent !== null)
      return null;
  } else {
    if (matching.matchRatePercent === null)
      return null;
    const expected = Math.round(
      matching.matchedRecordCount * 10000 /
        matching.totalEnrollmentRecordCount,
    ) / 100;
    if (Math.abs(matching.matchRatePercent - expected) > 0.000001)
      return null;
  }

  const usage = data.usage as Record<string, unknown>;
  if (!exactKeys(
      usage,
      ["available", "usedBudget", "utilizationPercent"],
    ) ||
    usage.available !== false ||
    usage.usedBudget !== null ||
    usage.utilizationPercent !== null)
    return null;

  const trend =
    data.allocationDistributionTrend as Record<string, unknown>;
  if (!exactKeys(trend, ["available", "points"]) ||
    trend.available !== false ||
    !Array.isArray(trend.points) ||
    trend.points.length !== 0)
    return null;

  const capability = data.capability as Record<string, unknown>;
  if (!exactKeys(
      capability,
      [
        "financialReportingAvailable",
        "allocationDistributionTrendAvailable",
      ],
    ) ||
    capability.financialReportingAvailable !== false ||
    capability.allocationDistributionTrendAvailable !== false)
    return null;

  return {
    organizationType: data.organizationType.trim(),
    lastRecordedSyncAtUtc: null,
    matching: {
      available: true,
      scope: "ELIGIBLE_PROGRAM_RECIPIENT_RECORDS",
      eligibleProgramCount: matching.eligibleProgramCount,
      totalEnrollmentRecordCount:
        matching.totalEnrollmentRecordCount,
      matchedRecordCount: matching.matchedRecordCount,
      needsReviewRecordCount: matching.needsReviewRecordCount,
      matchRatePercent: matching.matchRatePercent,
    },
    usage: {
      available: false,
      usedBudget: null,
      utilizationPercent: null,
    },
    allocationDistributionTrend: {
      available: false,
      points: [],
    },
    capability: {
      financialReportingAvailable: false,
      allocationDistributionTrendAvailable: false,
    },
  };
}
