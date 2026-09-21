/**
 * Rechecking a user-visible native session when returning from background
 * prevents a stale "signed in" message after remote revocation/expiry.
 *
 * Never interrupt a partly entered OTP: the app must not silently discard a
 * challenge just because the OS displayed a notification or app switcher.
 * The API remains authoritative; this is only a foreground trigger policy.
 */
export type MobileAuthView =
  "checking" | "phone" | "code" | "session" | "offline";

export function shouldRecheckOnForeground(
  previousState: string,
  currentState: string,
  view: MobileAuthView,
  requestPending: boolean,
): boolean {
  return (previousState === "background" || previousState === "inactive") &&
    currentState === "active" && !requestPending &&
    (view === "session" || view === "offline");
}
