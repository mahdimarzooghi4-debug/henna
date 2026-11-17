/**
 * Public applicant's private receipt credential, scoped to the applicant's
 * browser session. It is not a buyer login, verified phone, or Seller role.
 */
export const publicIntakeCookie = "hana_public_seller_intake";
export const publicIntakeTokenPattern = /^[0-9A-F]{64}$/;
export const publicIntakeTrackingPattern = /^HNA-P-[0-9A-F]{16}$/;

export function validPublicIntakeReceipt(raw: unknown): raw is {
  status: "RECEIVED"; trackingCode: string; submittedAtUtc: string;
} {
  if (!raw || typeof raw !== "object") return false;
  const value = raw as Record<string, unknown>;
  return value.status === "RECEIVED" &&
    typeof value.trackingCode === "string" &&
    publicIntakeTrackingPattern.test(value.trackingCode) &&
    typeof value.submittedAtUtc === "string" &&
    !Number.isNaN(Date.parse(value.submittedAtUtc));
}
