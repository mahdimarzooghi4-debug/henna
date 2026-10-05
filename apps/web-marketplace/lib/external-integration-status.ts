type Row = Record<string, unknown>;

export type ExternalIntegrationStatus = {
  sms: { configured: boolean; requiredForPublicSignIn: true };
  sellerIdentity: {
    configured: boolean;
    requiredForNaturalSellerVerification: true;
  };
  payment: { configured: boolean; requiredForExternalPayment: true };
  logistics: { configured: boolean; requiredForDelivery: true };
  allExternalReady: boolean;
};

function row(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Row : null;
}
function readiness(
  value: unknown,
  requiredKey: string,
): { configured: boolean; [key: string]: boolean } | null {
  const x = row(value);
  if (!x || typeof x.configured !== "boolean" || x[requiredKey] !== true)
    return null;
  return { configured: x.configured, [requiredKey]: true };
}

export function parseExternalIntegrationStatus(
  value: unknown,
): ExternalIntegrationStatus | null {
  const x = row(value);
  if (!x || typeof x.allExternalReady !== "boolean") return null;
  const sms = readiness(x.sms, "requiredForPublicSignIn");
  const sellerIdentity = readiness(
    x.sellerIdentity, "requiredForNaturalSellerVerification");
  const payment = readiness(x.payment, "requiredForExternalPayment");
  const logistics = readiness(x.logistics, "requiredForDelivery");
  if (!sms || !sellerIdentity || !payment || !logistics) return null;
  const expected = sms.configured && sellerIdentity.configured &&
    payment.configured && logistics.configured;
  if (x.allExternalReady !== expected) return null;
  return {
    sms: sms as ExternalIntegrationStatus["sms"],
    sellerIdentity:
      sellerIdentity as ExternalIntegrationStatus["sellerIdentity"],
    payment: payment as ExternalIntegrationStatus["payment"],
    logistics: logistics as ExternalIntegrationStatus["logistics"],
    allExternalReady: x.allExternalReady,
  };
}
