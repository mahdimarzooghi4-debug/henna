/** Server-side release link policy. Public/browser-facing code must not read env directly. */
export function approvedAndroidReleaseUrl(raw: string | undefined): string | null {
  if (!raw || raw.length > 2048 || raw.trim() !== raw) return null;
  try {
    const value = new URL(raw);
    const host = value.hostname.toLowerCase();
    if (value.protocol !== "https:" || value.username || value.password ||
      value.hash || value.port && value.port !== "443" ||
      !host.includes(".") || host.endsWith(".invalid") ||
      host.endsWith(".localhost") || host === "localhost" ||
      host.endsWith(".local") || host.endsWith(".test") ||
      /^127\./.test(host) || host === "0.0.0.0" ||
      host === "169.254.169.254" || host === "[::1]" ||
      host === "10.0.2.2")
      return null;
    return value.href;
  } catch {
    return null;
  }
}

/** Review approval alone is insufficient; role+activation must still be live. */
export function sellerMayReceiveMobileLink(input: unknown): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const state = input as Record<string, unknown>;
  if (state.overallStatus !== "APPROVED" ||
      state.sellerAccessEnabled !== true ||
      state.sellerPanelEnabled !== true ||
      typeof state.trackingCode !== "string" ||
      !/^HNA-[0-9A-F]{16}$/.test(state.trackingCode) ||
      typeof state.activatedAtUtc !== "string" ||
      !Number.isFinite(Date.parse(state.activatedAtUtc)) ||
      typeof state.reviewedAtUtc !== "string" ||
      !Number.isFinite(Date.parse(state.reviewedAtUtc)))
    return false;
  const steps = state.steps;
  return Array.isArray(steps) && steps.length === 5 &&
    steps[4] && typeof steps[4] === "object" &&
    steps[4].key === "REVIEW" && steps[4].status === "APPROVED";
}
