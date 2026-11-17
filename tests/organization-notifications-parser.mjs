import assert from "node:assert/strict";
import { parseOrganizationNotifications } from
  "../apps/web-marketplace/lib/organization-notifications.ts";

const event = {
  id: "notification-1",
  type: "PROGRAM_REGISTERED",
  title: "ثبت طرح",
  message: "طرح ثبت شد.",
  createdAtUtc: "2026-09-24T12:00:00Z",
  readState: "UNREAD",
};

assert.deepEqual(parseOrganizationNotifications({ notifications: [] }), []);
assert.deepEqual(parseOrganizationNotifications({ notifications: [event] }), [event]);

for (const payload of [
  { notifications: [event], organizationId: "foreign" },
  { notifications: [{ ...event, amountIrr: 1000 }] },
  { notifications: [{ ...event, type: "UNKNOWN" }] },
  { notifications: [{ ...event, readState: "MAYBE" }] },
  { notifications: [{ ...event, createdAtUtc: "yesterday" }] },
  { notifications: [event, event] },
  { notifications: "none" },
]) assert.equal(parseOrganizationNotifications(payload), null);

console.log("Organization notification payload boundaries OK");
