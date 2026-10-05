import assert from "node:assert/strict";
import test from "node:test";
import {
  adminSellerIntent,
  parseAdminSellerDetail,
  parseAdminSellerList,
  parseAdminSellerMutation,
} from "../apps/web-marketplace/lib/admin-sellers.ts";

const ID = "60000000-0000-4000-8000-000000000041";
const item = {
  applicationId: ID,
  storeName: "فروشگاه CI",
  businessName: "کسب‌وکار CI",
  applicantType: "NATURAL",
  identityStatus: "VERIFIED",
  offeringType: "GOOD",
  revision: 7,
  trackingCode: "HNA-A1B2C3D4E5F60718",
  reviewStatus: "UNDER_REVIEW",
  reviewedAtUtc: null,
  activatedAtUtc: null,
  submittedAtUtc: "2026-10-05T03:00:00Z",
};
const detail = {
  ...item,
  ownerName: "مالک CI",
  nationalCodeMasked: "******1234",
  legalNationalId: null,
  legalName: null,
  legalRepresentativeName: null,
  legalRepresentativePhoneMasked: null,
  businessDescription: "شرح کسب‌وکار",
  businessPhone: "02112345678",
  activityAddress: "نشانی فعالیت",
  activityLatitude: null,
  activityLongitude: null,
  activityHours: "شنبه تا پنجشنبه",
  sellerDelivery: false,
  pickup: true,
  serviceArea: "شهر CI",
  registrationContactName: "تماس CI",
  registrationContactRole: "مالک",
  backupPhoneMasked: null,
  websiteOrSocial: null,
  businessEmail: null,
  responseHours: "۹ تا ۱۸",
  phoneMasked: "0912*******",
  city: "شهر CI",
  address: "نشانی CI",
  postalCode: "1234567890",
  reviewReason: null,
  sellerSuspended: false,
  suspendedAtUtc: null,
  suspensionReason: null,
};

test("admin seller list/detail parsers accept bounded masked data", () => {
  const list = parseAdminSellerList({
    items: [item], page: 1, pageSize: 20, total: 1,
  }, 1);
  assert.equal(list?.items[0].id, ID);
  assert.equal(list?.total, 1);

  const normalized = parseAdminSellerList({
    items: [{...item, id: ID, applicationId: undefined}],
    page: 1, pageSize: 20, total: 1,
  }, 1);
  assert.equal(normalized?.items[0].id, ID);

  const parsed = parseAdminSellerDetail(detail, ID);
  assert.equal(parsed?.phoneMasked, "0912*******");
  assert.equal(parsed?.pickup, true);
  const suspended = parseAdminSellerDetail({
    ...detail,
    sellerSuspended: true,
    suspendedAtUtc: "2026-10-05T04:00:00Z",
    suspensionReason: "بررسی انطباق",
  }, ID);
  assert.equal(suspended?.sellerSuspended, true);
  assert.equal(parseAdminSellerDetail({
    ...detail, sellerSuspended: true,
  }, ID), null);
});

test("admin seller parsers reject unsafe status and malformed tracking", () => {
  assert.equal(parseAdminSellerList({
    items: [{...item, reviewStatus: "ACTIVE"}],
    page: 1, pageSize: 20, total: 1,
  }, 1), null);
  assert.equal(parseAdminSellerDetail({
    ...detail, trackingCode: "bad",
  }, ID), null);
  assert.equal(parseAdminSellerMutation({
    applicationId: ID, revision: 8,
    reviewStatus: "APPROVED", reviewReason: "بررسی شد",
    sellerActivated: "yes",
  }, ID), null);
});

test("admin seller retry intent retains exact key/body", () => {
  const first = adminSellerIntent(null, ID + "/review", {
    revision: 7, decision: "APPROVED", reason: "بررسی شد",
  });
  const same = adminSellerIntent(first, ID + "/review", {
    revision: 7, decision: "APPROVED", reason: "بررسی شد",
  });
  assert.deepEqual(same, first);
  const changed = adminSellerIntent(first, ID + "/review", {
    revision: 7, decision: "REJECTED", reason: "بررسی شد",
  });
  assert.notEqual(changed.key, first.key);
});
