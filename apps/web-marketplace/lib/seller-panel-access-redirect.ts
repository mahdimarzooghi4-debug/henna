/**
 * The seller dashboard never renders a separate 401/403 gateway card.
 * Unknown failures must fail closed (not be interpreted as logged out).
 */
export type SellerPanelRedirect = "/seller/login" | "/seller/register/status";
export function sellerPanelRedirectForStatus(status: number): SellerPanelRedirect | null {
  if (status === 401) return "/seller/login";
  if (status === 403) return "/seller/register/status";
  return null;
}
