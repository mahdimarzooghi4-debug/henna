import {
  parseOrganizationRecipient,
} from "./organization-recipients";

export const organizationRecipientImportMaxFileBytes = 2 * 1024 * 1024;

export const organizationRecipientImportErrorCodes = [
  "FILE_SIZE",
  "FILE_TYPE",
  "CSV_ENCODING",
  "CSV_FORMAT",
  "XLSX_STRUCTURE",
  "XLSX_EXPANDED_SIZE",
  "XLSX_SHEET",
  "XLSX_FORMAT",
  "XLSX_XML",
  "XLSX_CELL_REFERENCE",
  "XLSX_COLUMN_LIMIT",
  "EMPTY_FILE",
  "UNKNOWN_COLUMN",
  "DUPLICATE_COLUMN",
  "UNMAPPED_COLUMN_DATA",
  "MISSING_COLUMN",
  "ROW_LIMIT",
  "FORMULA_NOT_ALLOWED",
  "TEXT_REQUIRED",
  "NO_DATA_ROWS",
  "INVALID_NAME",
  "INVALID_REFERENCE",
  "INVALID_PHONE",
  "DUPLICATE_IN_FILE",
  "DUPLICATE_EXISTING",
] as const;

export type OrganizationRecipientImportErrorCode =
  (typeof organizationRecipientImportErrorCodes)[number];

export type OrganizationRecipientImportError = {
  row: number;
  field: string;
  code: OrganizationRecipientImportErrorCode;
  message: string;
};

export type OrganizationRecipientImportSummary = {
  importedCount: number;
  matchedCount: number;
  needsMatchCount: number;
  atomic: true;
  importedAtUtc: string;
};

export type OrganizationRecipientImportErrorResult = {
  importedCount: 0;
  atomic: true;
  errors: OrganizationRecipientImportError[];
};

const controlChars = /[\u0000-\u001f\u007f]/;

function safeInteger(
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

function knownErrorCode(
  value: unknown,
): value is OrganizationRecipientImportErrorCode {
  return typeof value === "string" &&
    (organizationRecipientImportErrorCodes as readonly string[])
      .includes(value);
}

export function parseOrganizationRecipientImportSuccess(
  value: unknown,
): OrganizationRecipientImportSummary | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (!safeInteger(data.importedCount, 1, 500) ||
    !safeInteger(data.matchedCount, 0, 500) ||
    !safeInteger(data.needsMatchCount, 0, 500) ||
    data.atomic !== true ||
    !Array.isArray(data.items) ||
    data.items.length !== data.importedCount ||
    data.matchedCount + data.needsMatchCount !== data.importedCount ||
    !isoDate(data.importedAtUtc))
    return null;

  const seenRows = new Set<number>();
  for (const raw of data.items) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>;
    if (!safeInteger(item.row, 2, 1_000_000) ||
      seenRows.has(item.row) ||
      !parseOrganizationRecipient(item.recipient))
      return null;
    seenRows.add(item.row);
  }

  return {
    importedCount: data.importedCount,
    matchedCount: data.matchedCount,
    needsMatchCount: data.needsMatchCount,
    atomic: true,
    importedAtUtc: data.importedAtUtc,
  };
}

export function parseOrganizationRecipientImportErrors(
  value: unknown,
): OrganizationRecipientImportErrorResult | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.importedCount !== 0 ||
    data.atomic !== true ||
    !Array.isArray(data.errors) ||
    data.errors.length < 1 ||
    data.errors.length > 500)
    return null;

  const errors: OrganizationRecipientImportError[] = [];
  for (const raw of data.errors) {
    if (!raw || typeof raw !== "object") return null;
    const error = raw as Record<string, unknown>;
    if (!safeInteger(error.row, 0, 1_000_000) ||
      typeof error.field !== "string" ||
      error.field.length < 1 ||
      error.field.length > 64 ||
      controlChars.test(error.field) ||
      !knownErrorCode(error.code) ||
      typeof error.message !== "string" ||
      error.message.length < 1 ||
      error.message.length > 300 ||
      controlChars.test(error.message))
      return null;

    errors.push({
      row: error.row,
      field: error.field,
      code: error.code,
      message: error.message,
    });
  }

  return { importedCount: 0, atomic: true, errors };
}
