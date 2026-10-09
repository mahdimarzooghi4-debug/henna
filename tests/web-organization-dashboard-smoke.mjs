import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOrganizationDashboard,
  organizationRial,
} from "../apps/web-marketplace/lib/organization-portal.ts";

const ORG = "60000000-0000-4000-8000-000000000031";
const PROGRAM = "60000000-0000-4000-8000-000000000032";

test("organization dashboard accepts only scoped bounded server data", () => {
  const parsed = parseOrganizationDashboard({
    organizations: [{
      id: ORG,
      name: "سازمان CI",
      managerCount: 2,
      beneficiaryCount: 14,
      programCount: 1,
    }],
    programs: [{
      id: PROGRAM,
      organizationId: ORG,
      name: "طرح CI",
      fundedRial: 10000,
      unallocatedRial: 2500,
      expiresAtUtc: "2026-11-05T00:00:00Z",
      categoryCount: 2,
    }],
    unreadNotifications: 3,
    openTickets: 1,
  });
  assert.ok(parsed);
  assert.equal(parsed.organizations[0].beneficiaryCount, 14);
  assert.equal(parsed.programs[0].unallocatedRial, 2500);
  assert.match(organizationRial(2500), /ریال/);
});

test("organization dashboard rejects cross-org and malformed values", () => {
  const base = {
    organizations: [{
      id: ORG, name: "سازمان CI",
      managerCount: 1, beneficiaryCount: 0, programCount: 1,
    }],
    programs: [{
      id: PROGRAM, organizationId: ORG, name: "طرح CI",
      fundedRial: 10000, unallocatedRial: 5000,
      expiresAtUtc: "2026-11-05T00:00:00Z", categoryCount: 1,
    }],
    unreadNotifications: 0, openTickets: 0,
  };
  assert.equal(parseOrganizationDashboard({
    ...base,
    programs: [{...base.programs[0],
      organizationId: "60000000-0000-4000-8000-000000000099"}],
  }), null);
  assert.equal(parseOrganizationDashboard({
    ...base,
    programs: [{...base.programs[0], unallocatedRial: 10001}],
  }), null);
  assert.equal(parseOrganizationDashboard({
    ...base,
    organizations: [{...base.organizations[0], programCount: 2}],
  }), null);
  assert.equal(parseOrganizationDashboard({
    ...base,
    organizations: [],
  }), null);
});
