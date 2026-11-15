/**
 * Versioned APK links for the main public landing site's download page.
 * Preview-only, CI debug-signed, not Play Store/operational commerce releases.
 * Buyer and seller must remain independently pinned.
 */
export const buyerAndroidPreview = {
  apk: "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-buyer-figma-android-8f775b2/hana-buyer-figma-android-preview.apk",
  details: "https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-buyer-figma-android-8f775b2",
  sha: "8f775b2de780e8d69326cec6f721fa59012a02d3",
  digest: "sha256:9c2ff139af976f2eddf7fccf0664abf4b18bb9a1ac8c85c20ec2c94130b03429",
} as const;

export const sellerAndroidPreview = {
  apk: "https://github.com/mahdimarzooghi4-debug/henna/releases/download/hana-seller-android-8f775b2/hana-seller-preview.apk",
  details: "https://github.com/mahdimarzooghi4-debug/henna/releases/tag/hana-seller-android-8f775b2",
  sha: "8f775b2de780e8d69326cec6f721fa59012a02d3",
  digest: "sha256:21dd585c1ec45b481ac3b718d6d745636b833641736c16ea212ff73d330c2ba2",
} as const;
