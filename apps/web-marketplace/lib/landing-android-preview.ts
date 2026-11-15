/**
 * Versioned APK links for the main public landing site's download page.
 * Preview-only, CI debug-signed, not Play Store/operational commerce releases.
 * Buyer and seller must remain independently pinned.
 */
export const buyerAndroidPreview = {
  apk: "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-buyer-figma-android-f0230c6/hana-buyer-figma-android-preview.apk",
  details: "https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-buyer-figma-android-f0230c6",
  sha: "f0230c6aab993c44be3f079d0093e4986b00a2ad",
  digest: "sha256:6786bda798c54109b864062192edb90588638edb950acd272f100972f50d0a61d",
} as const;

export const sellerAndroidPreview = {
  apk: "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-mobile-preview-1783-1/hana-seller-preview.apk",
  details: "https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-mobile-preview-1783-1",
} as const;
