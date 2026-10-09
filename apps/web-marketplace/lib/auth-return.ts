export type AuthReturnTo = "/seller/register" | "/cart" | "/checkout" | "/orders" | "/account" | "/wallet" | `/orders/${string}`;
export function safeAuthReturnTo(value: unknown): AuthReturnTo | null {
  if (value === "/seller/register") return value;
  if (value === "/cart" || value === "/checkout" || value === "/orders" ||
      value === "/account" || value === "/wallet") return value;
  return typeof value === "string" && /^\/orders\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value as AuthReturnTo : null;
}
