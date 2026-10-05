import { commerceId } from "../../../packages/buyer-commerce/contracts.ts";
export { commerceId };

type Row = Record<string, unknown>;
const row = (value: unknown): Row => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
  return value as Row;
};
const id = (value: unknown): string => {
  if (!commerceId(value)) throw Error();
  return value;
};
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) ||
      value < min || value > max) throw Error();
  return value;
};
const signedInteger = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw Error();
  return value;
};
const text = (value: unknown, max = 1000): string => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error();
  return value;
};
const time = (value: unknown): string => {
  const parsed = text(value, 50);
  if (!Number.isFinite(Date.parse(parsed))) throw Error();
  return parsed;
};
const optionalTime = (value: unknown): string | null =>
  value === null ? null : time(value);
const list = <T>(value: unknown, parse: (entry: unknown) => T, max = 500): T[] => {
  if (!Array.isArray(value) || value.length > max) throw Error();
  return value.map(parse);
};
const attempt = <T>(fn: () => T): T | null => {
  try { return fn(); } catch { return null; }
};

export type StaffOrder = {
  id: string;
  state: "PAID" | "PREPARING" | "READY_FOR_PICKUP" | "COLLECTED" | "CANCELLED";
  refundState: string;
  version: number;
  totalRial: number;
  createdAtUtc: string;
  items: {
    productId: string;
    productName: string | null;
    quantity: number;
    unitPriceRial: number;
    refundedQuantity: number;
  }[];
};

export type StaffIncident = {
  id: string;
  orderId: string;
  orderItemId: string;
  type: "DAMAGED_ITEM" | "MISSING_ITEM";
  quantity: number;
  evidenceId: string;
  state: "UNDER_REVIEW" | "REJECTED" | "AWAITING_RETURN" | "RESOLVED" |
    "COLLECTED" | "CUSTOMER_UNAVAILABLE_VERIFIED";
  reportedAtUtc: string;
  approvedAtUtc: string | null;
  returnDueAtUtc: string | null;
  firstContactAtUtc: string | null;
  doorVisitAtUtc: string | null;
  collectedAtUtc: string | null;
  penaltyApplied: boolean;
  refundRial: number;
};

export type StaffOffer = {
  id: string;
  productId: string;
  categoryId: string;
  priceRial: number;
  stock: number;
  version: number;
  published: boolean;
};

export type StaffSettlement = {
  id: string;
  orderId: string;
  grossRial: number;
  refundRial: number;
  penaltyRial: number;
  fixedFeeRial: number;
  feeVersion: string;
  netRial: number;
  state: "READY_FOR_BANK_TRANSFER" | "FINANCE_REVIEW_REQUIRED";
  createdAtUtc: string;
};

export type StaffNotification = {
  id: string;
  code: string;
  resourceId: string;
  createdAtUtc: string;
  read: boolean;
};

export type StaffTicket = {
  id: string;
  subject: string;
  message: string;
  state: "OPEN" | "ANSWERED";
  createdAtUtc: string;
  reply: string | null;
};

export type StaffReport = {
  orders: number;
  paid: number;
  preparing: number;
  readyForPickup: number;
  collected: number;
  cancelled: number;
  grossRial: number;
  openIncidents: number;
  incidentRefundRial: number;
  preparedSettlements: number;
  settlementGrossRial: number;
  settlementRefundRial: number;
  settlementPenaltyRial: number;
  settlementFeeRial: number;
  settlementNetRial: number;
  financeReviewRequired: number;
};

const order = (value: unknown): StaffOrder => {
  const data = row(value);
  const states = ["PAID", "PREPARING", "READY_FOR_PICKUP",
    "COLLECTED", "CANCELLED"] as const;
  if (typeof data.State !== "string" ||
      !states.includes(data.State as typeof states[number])) throw Error();
  const items = list(data.Items, entry => {
    const item = row(entry);
    const quantity = integer(item.Quantity, 1, 999);
    return {
      productId: id(item.ProductId),
      productName: item.ProductName === null || item.ProductName === undefined
        ? null : text(item.ProductName, 200),
      quantity,
      unitPriceRial: integer(item.UnitPriceRial, 1),
      refundedQuantity: integer(item.RefundedQuantity, 0, quantity),
    };
  }, 100);
  if (!items.length) throw Error();
  const totalRial = integer(data.TotalRial, 1);
  if (totalRial !== items.reduce(
    (sum, item) => sum + item.unitPriceRial * item.quantity, 0)) throw Error();
  return {
    id: id(data.Id),
    state: data.State as StaffOrder["state"],
    refundState: text(data.RefundState, 30),
    version: integer(data.Version, 1),
    totalRial,
    createdAtUtc: time(data.CreatedAtUtc),
    items,
  };
};

const incident = (value: unknown): StaffIncident => {
  const data = row(value);
  if (!["DAMAGED_ITEM", "MISSING_ITEM"].includes(String(data.Type)) ||
      !["UNDER_REVIEW", "REJECTED", "AWAITING_RETURN", "RESOLVED",
        "COLLECTED", "CUSTOMER_UNAVAILABLE_VERIFIED"].includes(String(data.State)) ||
      typeof data.PenaltyApplied !== "boolean") throw Error();
  return {
    id: id(data.Id),
    orderId: id(data.OrderId),
    orderItemId: id(data.OrderItemId),
    type: data.Type as StaffIncident["type"],
    quantity: integer(data.Quantity, 1, 999),
    evidenceId: id(data.EvidenceReference),
    state: data.State as StaffIncident["state"],
    reportedAtUtc: time(data.ReportedAtUtc),
    approvedAtUtc: optionalTime(data.ApprovedAtUtc),
    returnDueAtUtc: optionalTime(data.ReturnDueAtUtc),
    firstContactAtUtc: optionalTime(data.FirstContactAtUtc),
    doorVisitAtUtc: optionalTime(data.DoorVisitAtUtc),
    collectedAtUtc: optionalTime(data.CollectedAtUtc),
    penaltyApplied: data.PenaltyApplied,
    refundRial: integer(data.RefundRial),
  };
};

const offer = (value: unknown): StaffOffer => {
  const data = row(value);
  if (typeof data.Published !== "boolean") throw Error();
  return {
    id: id(data.Id),
    productId: id(data.ProductId),
    categoryId: id(data.CategoryId),
    priceRial: integer(data.PriceRial, 1),
    stock: integer(data.Stock, 0, 1000000),
    version: integer(data.Version, 1),
    published: data.Published,
  };
};

const settlement = (value: unknown): StaffSettlement => {
  const data = row(value);
  if (!["READY_FOR_BANK_TRANSFER", "FINANCE_REVIEW_REQUIRED"]
      .includes(String(data.State))) throw Error();
  return {
    id: id(data.Id),
    orderId: id(data.OrderId),
    grossRial: integer(data.GrossRial),
    refundRial: integer(data.RefundRial),
    penaltyRial: integer(data.PenaltyRial),
    fixedFeeRial: integer(data.FixedFeeRial),
    feeVersion: text(data.FeeVersion, 120),
    netRial: signedInteger(data.NetRial),
    state: data.State as StaffSettlement["state"],
    createdAtUtc: time(data.CreatedAtUtc),
  };
};

const notification = (value: unknown): StaffNotification => {
  const data = row(value);
  if (typeof data.Read !== "boolean") throw Error();
  return {
    id: id(data.Id),
    code: text(data.Code, 120),
    resourceId: id(data.ResourceId),
    createdAtUtc: time(data.CreatedAtUtc),
    read: data.Read,
  };
};

const ticket = (value: unknown): StaffTicket => {
  const data = row(value);
  if (!["OPEN", "ANSWERED"].includes(String(data.State))) throw Error();
  return {
    id: id(data.Id),
    subject: text(data.Subject, 120),
    message: text(data.Message, 2000),
    state: data.State as StaffTicket["state"],
    createdAtUtc: time(data.CreatedAtUtc),
    reply: data.Reply === null ? null : text(data.Reply, 2000),
  };
};

const report = (value: unknown): StaffReport => {
  const data = row(value);
  const keys = [
    "orders", "paid", "preparing", "readyForPickup", "collected", "cancelled",
    "grossRial", "openIncidents", "incidentRefundRial", "preparedSettlements",
    "settlementGrossRial", "settlementRefundRial", "settlementPenaltyRial",
    "settlementFeeRial", "financeReviewRequired",
  ] as const;
  for (const key of keys) integer(data[key]);
  const net = signedInteger(data.settlementNetRial);
  if (data.paid as number + (data.preparing as number) +
      (data.readyForPickup as number) + (data.collected as number) +
      (data.cancelled as number) !== data.orders) throw Error();
  return {
    orders: data.orders as number,
    paid: data.paid as number,
    preparing: data.preparing as number,
    readyForPickup: data.readyForPickup as number,
    collected: data.collected as number,
    cancelled: data.cancelled as number,
    grossRial: data.grossRial as number,
    openIncidents: data.openIncidents as number,
    incidentRefundRial: data.incidentRefundRial as number,
    preparedSettlements: data.preparedSettlements as number,
    settlementGrossRial: data.settlementGrossRial as number,
    settlementRefundRial: data.settlementRefundRial as number,
    settlementPenaltyRial: data.settlementPenaltyRial as number,
    settlementFeeRial: data.settlementFeeRial as number,
    settlementNetRial: net,
    financeReviewRequired: data.financeReviewRequired as number,
  };
};

const page = <T>(
  value: unknown,
  parse: (entry: unknown) => T,
  expectedPage: number,
): T[] => {
  const data = row(value);
  if (!Number.isInteger(expectedPage) || expectedPage < 1 ||
      expectedPage > 10000 || data.page !== expectedPage ||
      data.pageSize !== 20) throw Error();
  return list(data.items, parse, 20);
};

export type StaffScope = "seller" | "support";

export function parseStaffCommerce(
  scope: StaffScope,
  path: string,
  method: "GET" | "POST",
  value: unknown,
  expectedPage = 1,
): unknown | null {
  return attempt(() => {
    if (scope === "seller" && path === "orders" && method === "GET")
      return page(value, order, expectedPage);
    if (scope === "seller" && path === "returns" && method === "GET")
      return page(value, incident, expectedPage);
    if (scope === "seller" && path === "offers" && method === "GET")
      return page(value, offer, expectedPage);
    if (scope === "seller" && path === "settlements" && method === "GET")
      return page(value, settlement, expectedPage);
    if (scope === "seller" && path === "notifications" && method === "GET")
      return page(value, notification, expectedPage);
    if (scope === "seller" && path === "tickets" && method === "GET")
      return page(value, ticket, expectedPage);
    if (scope === "seller" && path === "report" && method === "GET")
      return report(value);
    if (scope === "support" && path === "incidents" && method === "GET")
      return page(value, incident, expectedPage);
    if (scope === "support" && path === "tickets" && method === "GET")
      return page(value, ticket, expectedPage);
    if (scope === "seller" && path === "offers" && method === "POST")
      return offer(value);
    if (scope === "seller" && path === "tickets" && method === "POST")
      return ticket(value);
    if (scope === "seller" && /^notifications\/[^/]+\/read$/.test(path) &&
        method === "POST") return notification(value);
    if (scope === "seller" && /^orders\/[^/]+\/state$/.test(path) &&
        method === "POST") return order(value);
    if (scope === "seller" &&
        /^returns\/[^/]+\/(contact|visit)$/.test(path) &&
        method === "POST") {
      const data = row(value);
      return {
        incident: incident(data.incident),
        evidence: text(data.evidence),
      };
    }
    if (scope === "support" && /^incidents\/[^/]+\/decision$/.test(path) &&
        method === "POST") {
      const data = row(value);
      return {
        incident: incident(data.incident),
        reason: text(data.reason, 1000),
      };
    }
    if (scope === "support" && /^returns\/[^/]+\/unavailability$/.test(path) &&
        method === "POST") {
      const data = row(value);
      return {
        incident: incident(data.incident),
        reason: text(data.reason, 1000),
      };
    }
    if (scope === "support" && /^tickets\/[^/]+\/reply$/.test(path) &&
        method === "POST") return ticket(value);
    throw Error();
  });
}

export const staffMessages: Record<string, string> = {
  ORDER_VERSION_CHANGED:
    "نسخه سفارش تغییر کرده است؛ داده تازه را دریافت کنید.",
  ORDER_TRANSITION_INVALID:
    "این تغییر برای وضعیت فعلی سفارش مجاز نیست.",
  INCIDENT_ALREADY_DECIDED:
    "این گزارش قبلاً بررسی شده است؛ وضعیت تازه را دریافت کنید.",
  RETURN_STATE_INVALID:
    "این مرجوعی در وضعیت فعلی قابل ثبت نیست.",
  RETURN_CONTACT_REQUIRED:
    "پیش از ثبت مراجعه، تماس اول باید ثبت شده باشد.",
  TIMELY_CALL_AND_DOOR_EVIDENCE_REQUIRED:
    "شواهد تماس و مراجعه در مهلت مقرر کامل نیست.",
  SETTLEMENT_ALREADY_PREPARED:
    "برای این سفارش تسویه قبلاً آماده شده و این تصمیم دیگر قابل ثبت نیست.",
  COMMAND_RATE_LIMITED:
    "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.",
  IDEMPOTENCY_PAYLOAD_CHANGED:
    "بدنه درخواست با کلید قبلی تغییر کرده است.",
  INVALID_COMMERCE_INPUT:
    "اطلاعات عملیاتی معتبر نیست.",
};

export class StaffCommerceError extends Error {
  status: number;
  code: string;
  constructor(status: number, code = "") {
    super(staffMessages[code] ??
      (status === 401 ? "برای ادامه وارد حساب خود شوید." :
        status === 403 ? "مجوز لازم برای این پنل فعال نیست." :
          status === 404 ? "رکورد موردنظر پیدا نشد یا قابل مشاهده نیست." :
            status === 400 ? "اطلاعات واردشده معتبر نیست." :
              status === 409 ? "وضعیت سرور تغییر کرده است؛ اطلاعات را تازه کنید." :
                "پاسخ سرور تأیید نشد؛ دوباره تلاش کنید."));
    this.status = status;
    this.code = code;
  }
}

export type StaffIntent = { path: string; body: string; key: string };
export function staffIntent(
  previous: StaffIntent | null,
  path: string,
  input: unknown,
): StaffIntent {
  const body = JSON.stringify(input);
  return previous?.path === path && previous.body === body
    ? previous
    : { path, body, key: crypto.randomUUID() };
}

export async function staffGet<T>(
  scope: StaffScope,
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  try {
    const response = await fetch(`/api/${scope}/commerce/${path}`, {
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal,
      headers: { Accept: "application/json" },
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw new StaffCommerceError(response.status,
        payload && typeof payload === "object" && "code" in payload
          ? String(payload.code) : "");
    if (!payload ||
        !response.headers.get("content-type")?.includes("application/json"))
      throw new StaffCommerceError(503);
    return payload as T;
  } catch (error) {
    if (error instanceof StaffCommerceError) throw error;
    if (signal?.aborted) throw error;
    throw new StaffCommerceError(503);
  }
}

export async function staffPost<T>(
  scope: StaffScope,
  intent: StaffIntent,
): Promise<T> {
  try {
    const response = await fetch(
      `/api/${scope}/commerce/${intent.path}`, {
        method: "POST",
        body: intent.body,
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": intent.key,
        },
      });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw new StaffCommerceError(response.status,
        payload && typeof payload === "object" && "code" in payload
          ? String(payload.code) : "");
    if (!payload ||
        !response.headers.get("content-type")?.includes("application/json"))
      throw new StaffCommerceError(503);
    return payload as T;
  } catch (error) {
    if (error instanceof StaffCommerceError) throw error;
    throw new StaffCommerceError(503);
  }
}

export function supportEvidenceUrl(evidenceId: string): string {
  if (!commerceId(evidenceId)) throw Error("Invalid evidence id");
  return `/api/support/commerce/evidence/${evidenceId}`;
}

export const staffRial = (value: number) =>
  new Intl.NumberFormat("fa-IR").format(value) + " ریال";
export const staffTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value)) : "—";
