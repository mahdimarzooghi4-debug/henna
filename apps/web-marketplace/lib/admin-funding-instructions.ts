type JsonObject = Record<string, unknown>;

export const fundingInstructionStates = [
  "PENDING_VERIFICATION", "VERIFIED", "REJECTED",
] as const;
export const fundingInstructionDecisions = ["VERIFIED", "REJECTED"] as const;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: JsonObject, keys: string[]) =>
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const validId = (value: unknown): value is string =>
  typeof value === "string" && uuid.test(value) &&
  value !== "00000000-0000-0000-0000-000000000000";
const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  !Number.isNaN(Date.parse(value));
const validText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max &&
  !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const nullableText = (value: unknown, max: number) =>
  value === null || validText(value, max);
const nullableTimestamp = (value: unknown) =>
  value === null || validTimestamp(value);
const isState = (value: unknown): value is typeof fundingInstructionStates[number] =>
  typeof value === "string" &&
  (fundingInstructionStates as readonly string[]).includes(value);
const isMode = (value: unknown) =>
  value === "HENNA_NEEDS_BASED" || value === "ORGANIZATION_DEFINED";

const listItemKeys = [
  "instructionId", "organizationName", "programName", "allocationMode",
  "sourceInstructionReference", "state", "revision", "submittedAtUtc",
  "reviewReason", "reviewedAtUtc",
];

function parseListItem(value: unknown): JsonObject | null {
  if (!isRecord(value) || !exactKeys(value, listItemKeys) ||
    !validId(value.instructionId) || !validText(value.organizationName, 160) ||
    !validText(value.programName, 120) || !isMode(value.allocationMode) ||
    !validText(value.sourceInstructionReference, 160) || !isState(value.state) ||
    !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 ||
    !validTimestamp(value.submittedAtUtc) || !nullableText(value.reviewReason, 1000) ||
    !nullableTimestamp(value.reviewedAtUtc)) return null;
  return Object.fromEntries(listItemKeys.map(key => [key, value[key]]));
}

export function parseFundingInstructionPage(
  value: unknown, requestedPage: number, requestedSize: number,
): JsonObject | null {
  if (!isRecord(value) || !exactKeys(value, ["items", "page", "pageSize", "total"]) ||
    !Array.isArray(value.items) || value.items.length > requestedSize ||
    value.page !== requestedPage || value.pageSize !== requestedSize ||
    !Number.isSafeInteger(value.total) || (value.total as number) < value.items.length)
    return null;
  const items = value.items.map(parseListItem);
  if (items.some(item => item === null)) return null;
  return { items, page: requestedPage, pageSize: requestedSize, total: value.total };
}

const detailKeys = [
  "instructionId", "programId", "programRevision", "organizationName",
  "programName", "allocationMode", "sourceInstructionReference", "state",
  "revision", "submittedAtUtc", "reviewReason", "reviewedAtUtc",
];

export function parseFundingInstructionDetail(value: unknown): JsonObject | null {
  if (!isRecord(value) || !exactKeys(value, detailKeys) ||
    !validId(value.instructionId) || !validId(value.programId) ||
    value.programRevision !== 1 || !validText(value.organizationName, 160) ||
    !validText(value.programName, 120) || !isMode(value.allocationMode) ||
    !validText(value.sourceInstructionReference, 160) || !isState(value.state) ||
    !Number.isSafeInteger(value.revision) || (value.revision as number) < 1 ||
    !validTimestamp(value.submittedAtUtc) || !nullableText(value.reviewReason, 1000) ||
    !nullableTimestamp(value.reviewedAtUtc) ||
    (value.state === "PENDING_VERIFICATION"
      ? value.reviewReason !== null || value.reviewedAtUtc !== null
      : value.reviewedAtUtc === null ||
        (value.state === "REJECTED" && !validText(value.reviewReason, 1000))))
    return null;
  return Object.fromEntries(detailKeys.map(key => [key, value[key]]));
}

const eventKeys = [
  "eventId", "instructionId", "revision", "decision", "reference", "reason",
  "actorAccountId", "occurredAtUtc",
];

export function parseFundingInstructionEvents(
  value: unknown, instructionId: string,
): JsonObject[] | null {
  if (!isRecord(value) || !exactKeys(value, ["events"]) ||
    !Array.isArray(value.events) || value.events.length > 1000) return null;
  const events = value.events.map(event => {
    if (!isRecord(event) || !exactKeys(event, eventKeys) ||
      !validId(event.eventId) || event.instructionId !== instructionId ||
      !Number.isSafeInteger(event.revision) || (event.revision as number) < 2 ||
      !(event.decision === "VERIFIED" || event.decision === "REJECTED" || event.decision === "RESUBMITTED") ||
      !validText(event.reference, 160) || !nullableText(event.reason, 1000) ||
      !validId(event.actorAccountId) || !validTimestamp(event.occurredAtUtc)) return null;
    return {
      eventId: event.eventId, instructionId: event.instructionId,
      revision: event.revision, decision: event.decision,
      reference: event.reference, reason: event.reason,
      occurredAtUtc: event.occurredAtUtc,
    };
  });
  if (events.some(event => event === null)) return null;
  const ordered = events as JsonObject[];
  if (ordered.some((event, index) => index > 0 &&
    (ordered[index - 1].revision as number) >= (event.revision as number))) return null;
  return ordered;
}

export function validFundingInstructionId(value: string): boolean {
  return validId(value);
}

export function parseFundingReviewResult(
  value: unknown, instructionId: string, expectedRevision: number,
): JsonObject | null {
  const keys = ["eventId", "instructionId", "revision", "decision", "reference",
    "reason", "actorAccountId", "occurredAtUtc"];
  if (!isRecord(value) || !exactKeys(value, keys) || !validId(value.eventId) ||
    value.instructionId !== instructionId || value.revision !== expectedRevision + 1 ||
    !(value.decision === "VERIFIED" || value.decision === "REJECTED") ||
    !validText(value.reference, 160) || !nullableText(value.reason, 1000) ||
    !validId(value.actorAccountId) || !validTimestamp(value.occurredAtUtc) ||
    (value.decision === "REJECTED" && !validText(value.reason, 1000))) return null;
  return {
    eventId: value.eventId, instructionId: value.instructionId,
    revision: value.revision, decision: value.decision,
    reference: value.reference, reason: value.reason,
    occurredAtUtc: value.occurredAtUtc,
  };
}
