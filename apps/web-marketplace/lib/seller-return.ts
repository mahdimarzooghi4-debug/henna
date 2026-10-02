/**
 * Return targets are a deliberate same-origin allowlist, never a free-form URL.
 * Encoded variants, query/hash suffixes and external destinations are rejected.
 */
export const sellerRegistrationPath = "/seller/register" as const;
export const sellerLoginHref = "/auth?returnTo=%2Fseller%2Fregister" as const;
export type AuthReturnTo = typeof sellerRegistrationPath | `/organization/${string}`;

const organizationReturnPaths = new Set([
  "/organization",
  "/organization/programs",
  "/organization/programs/new",
  "/organization/people",
  "/organization/people/new",
  "/organization/allocation",
  "/organization/usage",
  "/organization/data-sources",
  "/organization/reports",
  "/organization/notifications",
  "/organization/profile",
  "/organization/support",
  "/organization/settings",
]);
const organizationIdPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const organizationDynamicReturnPatterns = [
  new RegExp("^/organization/programs/" + organizationIdPattern + "$", "i"),
  new RegExp("^/organization/programs/" + organizationIdPattern + "/(?:funding-instruction|household-referrals)$", "i"),
  new RegExp("^/organization/allocation/" + organizationIdPattern + "$", "i"),
];

export function safeSellerReturnTo(value: unknown): typeof sellerRegistrationPath | null {
  return value === sellerRegistrationPath ? sellerRegistrationPath : null;
}

export function safeAuthReturnTo(value: unknown): AuthReturnTo | null {
  if (safeSellerReturnTo(value)) return sellerRegistrationPath;
  if (typeof value !== "string") return null;
  if (organizationReturnPaths.has(value) ||
    organizationDynamicReturnPatterns.some((pattern) => pattern.test(value)))
    return value as AuthReturnTo;
  return null;
}
