/**
 * Versioned APK links for the main public landing site's download page.
 * Preview-only, CI debug-signed, not Play Store/operational commerce releases.
 * Buyer and seller must remain independently pinned.
 */
export const buyerAndroidPreview = {
  apk: "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-buyer-figma-android-032eb3b/hana-buyer-figma-android-preview.apk",
  details: "https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-buyer-figma-android-032eb3b",
  sha: "032eb3bbfeff03503353197343500590d14bd855",
  digest: "sha256:54842902338d015848ade7781994a1c1dcba2687b19f4b2408cbc3fa85c4129b",
} as const;

export const sellerAndroidPreview = {
  apk: "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-1783-1/hana-seller-preview.apk",
  details: "https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-mobile-preview-1783-1",
} as const;
