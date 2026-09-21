/**
 * Recheck only when a visible tab displays a confirmed session (or an
 * unresolved session outage). Do not consume the user's partly entered OTP
 * when another tab changes or the browser switches windows.
 */
export type WebAuthStage =
  "checking" | "phone" | "code" | "authenticated" |
  "session-unavailable";

export function shouldRecheckVisibleWebSession(
  visibility: string,
  stage: WebAuthStage,
  authRequestPending: boolean,
): boolean {
  return visibility === "visible" && !authRequestPending &&
    (stage === "authenticated" || stage === "session-unavailable");
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A 200 by itself does not prove a valid authenticated session body. */
export function isConfirmedWebSession(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return false;
  const session = value as Record<string, unknown>;
  return session.authenticated === true &&
    typeof session.accountId === "string" &&
    uuid.test(session.accountId) &&
    session.accountId.toLowerCase() !==
      "00000000-0000-0000-0000-000000000000";
}
