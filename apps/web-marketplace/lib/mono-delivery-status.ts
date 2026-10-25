type Row = Record<string, unknown>;

export type MonoDeliveryStatusView = {
  orderId: string;
  correlationState: "PREPARED" | "REQUEST_RECEIVED" | "MISSION_LINKED";
  deliveryRequestId: string | null;
  providerStatus: string | null;
  missionId: string | null;
  missionStatus: string | null;
  committedDeliveryAt: string | null;
  correlationUpdatedAtUtc: string;
  correlationRevision: number;
  courierLocation: null | { latitude: number; longitude: number; accuracyMeters: number | null; observedAt: string };
  quote: null | {
    quoteId: string;
    version: number;
    expiresAt: string;
    isExpired: boolean;
    distanceMeters: number;
    fareToman: number;
    buyerShareToman: number;
    sellerShareToman: number;
  };
  promise: null | {
    promiseId: string;
    version: number;
    committedDeliveryAt: string;
    outcome: string;
  };
};

function row(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Row : null;
}
function boundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}
function iso(value: unknown): value is string {
  return boundedString(value, 64) && Number.isFinite(Date.parse(value));
}
function nullableString(value: unknown, max: number): value is string | null {
  return value === null || boundedString(value, max);
}
function safeInteger(value: unknown, min = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min;
}

export function parseMonoDeliveryStatusView(
  value: unknown,
): MonoDeliveryStatusView | null {
  const x = row(value);
  if (!x || typeof x.orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x.orderId) ||
      !["PREPARED", "REQUEST_RECEIVED", "MISSION_LINKED"].includes(String(x.correlationState)) ||
      !nullableString(x.deliveryRequestId, 64) ||
      x.deliveryRequestId !== null && !/^drq_[0-9a-f]{32}$/.test(x.deliveryRequestId) ||
      !nullableString(x.providerStatus, 32) ||
      !nullableString(x.missionId, 64) ||
      !nullableString(x.missionStatus, 32) ||
      !nullableString(x.committedDeliveryAt, 64) ||
      x.committedDeliveryAt !== null && !iso(x.committedDeliveryAt) ||
      !iso(x.correlationUpdatedAtUtc) ||
      !safeInteger(x.correlationRevision, 1))
    return null;

  const courierLocationRow = x.courierLocation == null ? null : row(x.courierLocation);
  let courierLocation: MonoDeliveryStatusView["courierLocation"] = null;
  if (x.courierLocation != null) {
    if (!courierLocationRow || typeof courierLocationRow.latitude !== "number" ||
        !Number.isFinite(courierLocationRow.latitude) || courierLocationRow.latitude < -90 || courierLocationRow.latitude > 90 ||
        typeof courierLocationRow.longitude !== "number" || !Number.isFinite(courierLocationRow.longitude) ||
        courierLocationRow.longitude < -180 || courierLocationRow.longitude > 180 ||
        !(courierLocationRow.accuracy_meters === null || typeof courierLocationRow.accuracy_meters === "number" &&
          Number.isFinite(courierLocationRow.accuracy_meters) && courierLocationRow.accuracy_meters >= 0) ||
        !iso(courierLocationRow.observed_at))
      return null;
    courierLocation = {
      latitude: courierLocationRow.latitude,
      longitude: courierLocationRow.longitude,
      accuracyMeters: courierLocationRow.accuracy_meters as number | null,
      observedAt: courierLocationRow.observed_at,
    };
  }

  const quoteRow = x.quote === null ? null : row(x.quote);
  let quote: MonoDeliveryStatusView["quote"] = null;
  if (x.quote !== null) {
    if (!quoteRow || !boundedString(quoteRow.quoteId, 128) ||
        !safeInteger(quoteRow.version, 1) || !iso(quoteRow.expiresAt) ||
        typeof quoteRow.isExpired !== "boolean" ||
        !safeInteger(quoteRow.distanceMeters, 1) ||
        !safeInteger(quoteRow.fareToman, 1) ||
        !safeInteger(quoteRow.buyerShareToman) ||
        !safeInteger(quoteRow.sellerShareToman) ||
        BigInt(quoteRow.buyerShareToman) + BigInt(quoteRow.sellerShareToman) !== BigInt(quoteRow.fareToman))
      return null;
    quote = {
      quoteId: quoteRow.quoteId,
      version: quoteRow.version,
      expiresAt: quoteRow.expiresAt,
      isExpired: quoteRow.isExpired,
      distanceMeters: quoteRow.distanceMeters,
      fareToman: quoteRow.fareToman,
      buyerShareToman: quoteRow.buyerShareToman,
      sellerShareToman: quoteRow.sellerShareToman,
    };
  }

  const promiseRow = x.promise === null ? null : row(x.promise);
  let promise: MonoDeliveryStatusView["promise"] = null;
  if (x.promise !== null) {
    if (!promiseRow || !boundedString(promiseRow.promiseId, 128) ||
        !safeInteger(promiseRow.version, 1) ||
        !iso(promiseRow.committedDeliveryAt) ||
        !boundedString(promiseRow.outcome, 32))
      return null;
    promise = {
      promiseId: promiseRow.promiseId,
      version: promiseRow.version,
      committedDeliveryAt: promiseRow.committedDeliveryAt,
      outcome: promiseRow.outcome,
    };
  }

  return {
    orderId: x.orderId.toLowerCase(),
    correlationState: x.correlationState as MonoDeliveryStatusView["correlationState"],
    deliveryRequestId: x.deliveryRequestId,
    providerStatus: x.providerStatus,
    missionId: x.missionId,
    missionStatus: x.missionStatus,
    committedDeliveryAt: x.committedDeliveryAt,
    correlationUpdatedAtUtc: x.correlationUpdatedAtUtc,
    correlationRevision: x.correlationRevision,
    courierLocation,
    quote,
    promise,
  };
}
