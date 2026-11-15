/**
 * Versioned APK links for the main public landing site's download page.
 * Preview-only, CI debug-signed, not Play Store/operational commerce releases.
 * Buyer and seller must remain independently pinned.
 */
export const buyerAndroidPreview = {
  apk: "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-buyer-figma-android-4655ad8/hana-buyer-figma-android-preview.apk",
  details: "https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-buyer-figma-android-4655ad8",
  sha: "4655ad8173fa8c649dbed0e0346a8844e0e03b45",
  digest: "sha256:3e52292e2d1541b05db7d0992638abd799c7146cebfdaecf95afa392a93fa40c",
} as const;

export const sellerAndroidPreview = {
  apk: "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-1783-1/hana-seller-preview.apk",
  details: "https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-mobile-preview-1783-1",
} as const;
