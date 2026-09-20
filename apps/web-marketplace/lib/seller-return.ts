/**
 * A deliberate allowlist, never a free-form "next" URL.
 * Only the already implemented first-stage seller page can be returned to.
 * External URLs, protocol-relative paths, encoded variants and query/hash
 * suffixes are never accepted as redirect targets.
 */
export const sellerRegistrationPath = "/seller/register" as const;
export const sellerLoginHref = "/auth?returnTo=%2Fseller%2Fregister" as const;

export function safeSellerReturnTo(value: unknown): typeof sellerRegistrationPath | null {
  return value === sellerRegistrationPath ? sellerRegistrationPath : null;
}
