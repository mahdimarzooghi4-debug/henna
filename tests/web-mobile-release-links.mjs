import test from "node:test";
import assert from "node:assert/strict";
import {
  approvedAndroidReleaseUrl, sellerMayReceiveMobileLink,
} from "../apps/web-marketplace/lib/mobile-release-links.ts";

test("only human-configured plausible HTTPS release links can be published", () => {
  assert.equal(approvedAndroidReleaseUrl(undefined), null);
  assert.equal(approvedAndroidReleaseUrl("https://github.com/mahdimarzooghi4-debug/henna/releases/download/preview-1/hana-buyer-preview.apk"), "https://github.com/mahdimarzooghi4-debug/henna/releases/download/preview-1/hana-buyer-preview.apk");
  assert.equal(approvedAndroidReleaseUrl(""), null);
  assert.equal(approvedAndroidReleaseUrl("http://downloads.example.com/app.apk"), null);
  assert.equal(approvedAndroidReleaseUrl("https://username:secret@downloads.example.com/app.apk"), null);
  assert.equal(approvedAndroidReleaseUrl("https://downloads.example.invalid/app.apk"), null);
  assert.equal(approvedAndroidReleaseUrl("https://localhost/app.apk"), null);
  assert.equal(approvedAndroidReleaseUrl("https://downloads.example.com/app.apk#secret"), null);
  assert.equal(
    approvedAndroidReleaseUrl("https://downloads.example.com/hana-buyer.apk"),
    "https://downloads.example.com/hana-buyer.apk",
  );
});
const active = {
  overallStatus: "APPROVED", sellerAccessEnabled: true,
  sellerPanelEnabled: true, trackingCode: "HNA-A1B2C3D4E5F60718",
  reviewedAtUtc: "2026-11-01T10:00:00Z",
  activatedAtUtc: "2026-11-02T10:00:00Z",
  steps: [{}, {}, {}, {}, { key: "REVIEW", status: "APPROVED" }],
};
test("link eligibility requires approval, actual activation and active role", () => {
  assert.equal(sellerMayReceiveMobileLink(active), true);
  for (const changed of [
    { overallStatus: "UNDER_REVIEW" },
    { overallStatus: "REJECTED" },
    { sellerAccessEnabled: false },
    { sellerPanelEnabled: false },
    { activatedAtUtc: null },
    { reviewedAtUtc: null },
    { steps: [{}, {}, {}, {}, { key: "REVIEW", status: "UNDER_REVIEW" }] },
    { trackingCode: "fake" },
  ]) assert.equal(sellerMayReceiveMobileLink({ ...active, ...changed }), false);
  assert.equal(sellerMayReceiveMobileLink(null), false);
});
