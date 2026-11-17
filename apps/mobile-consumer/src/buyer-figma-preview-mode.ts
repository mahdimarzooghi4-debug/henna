/** Explicit, isolated native Figma walkthrough. No provider/API/real orders.
 * Production and ordinary CI builds remain on their original real-catalog path.
 */
export function offlineAndroidFigmaPreview(
  platform: string,
  flag: string | undefined,
  apiBaseUrl: string | undefined,
): boolean {
  return platform === "android" && flag === "true" &&
    (apiBaseUrl === undefined || apiBaseUrl.trim() === "");
}
