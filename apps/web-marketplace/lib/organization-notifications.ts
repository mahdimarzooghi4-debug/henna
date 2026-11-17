export type OrganizationNotification = {
  id: string;
  type: "PROGRAM_REGISTERED";
  title: string;
  message: string;
  createdAtUtc: string;
  readState: "READ" | "UNREAD";
};

export type OrganizationNotificationsState =
  | { status: "ready"; notifications: OrganizationNotification[] }
  | { status: "unauthenticated" | "forbidden" | "unavailable" };

const keys = ["id", "type", "title", "message", "createdAtUtc", "readState"];
const safeText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);

export function parseOrganizationNotifications(value: unknown): OrganizationNotification[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== 1 || !("notifications" in value)) return null;
  const items = value.notifications;
  if (!Array.isArray(items) || items.length > 100) return null;
  const ids = new Set<string>();
  const parsed: OrganizationNotification[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        Object.keys(item).length !== keys.length ||
        !Object.keys(item).every(key => keys.includes(key))) return null;
    const row = item as Record<string, unknown>;
    if (!safeText(row.id, 80) || row.type !== "PROGRAM_REGISTERED" ||
        !safeText(row.title, 160) || !safeText(row.message, 500) ||
        !safeText(row.createdAtUtc, 40) ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(row.createdAtUtc) ||
        Number.isNaN(Date.parse(row.createdAtUtc)) ||
        (row.readState !== "READ" && row.readState !== "UNREAD") ||
        ids.has(row.id)) return null;
    ids.add(row.id);
    parsed.push({ id: row.id, type: row.type, title: row.title,
      message: row.message, createdAtUtc: row.createdAtUtc,
      readState: row.readState });
  }
  return parsed;
}
