import { commerceId } from "../../../packages/buyer-commerce/contracts.ts";
import type { StaffIntent } from "./staff-commerce";

const storageKey = "hana.seller.commerce-operations.pending.v1";
const changeEvent = "hana:seller-pending-commerce-changed";
const maxStored = 12000;

function row(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

function integer(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= min && value <= max;
}

function boundedText(value: unknown, max: number) {
  return typeof value === "string" && value.length > 0 &&
    value.length <= max && value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function evidenceReference(value: unknown) {
  return boundedText(value, 240);
}

export type SellerPendingArea = "operations" | "business";

function pathArea(path: string): SellerPendingArea | null {
  if (/^orders\/[0-9a-f-]+\/state$/i.test(path) ||
      /^returns\/[0-9a-f-]+\/(contact|visit)$/i.test(path))
    return "operations";
  if (path === "offers" || path === "service-listings" ||
      path === "tickets" || /^notifications\/[0-9a-f-]+\/read$/i.test(path))
    return "business";
  return null;
}

export function sellerCommerceIntentArea(
  intent: Pick<StaffIntent, "path">,
): SellerPendingArea | null {
  return pathArea(intent.path);
}

function validIntent(path: string, body: unknown) {
  const value = row(body);
  if (!value) return false;

  const order = /^orders\/([0-9a-f-]+)\/state$/i.exec(path);
  if (order && commerceId(order[1]))
    return exactKeys(value, ["expectedVersion", "state"]) &&
      integer(value.expectedVersion, 1, 2147483647) &&
      ["PREPARING", "READY_FOR_PICKUP"].includes(String(value.state));

  const returned = /^returns\/([0-9a-f-]+)\/(contact|visit)$/i.exec(path);
  if (returned && commerceId(returned[1]))
    return exactKeys(value, ["evidenceReference"]) &&
      evidenceReference(value.evidenceReference);

  if (path === "offers")
    return exactKeys(value, [
      "offerId", "productId", "priceRial", "stock", "expectedVersion",
    ]) &&
      commerceId(value.offerId) && commerceId(value.productId) &&
      integer(value.priceRial, 1, Number.MAX_SAFE_INTEGER) &&
      integer(value.stock, 0, 1000000) &&
      integer(value.expectedVersion, 0, 2147483647);

  if (path === "service-listings")
    return exactKeys(value, [
      "listingId", "productId", "priceRial", "availabilityNote",
      "expectedVersion",
    ]) &&
      commerceId(value.listingId) && commerceId(value.productId) &&
      integer(value.priceRial, 1, Number.MAX_SAFE_INTEGER) &&
      boundedText(value.availabilityNote, 500) &&
      integer(value.expectedVersion, 0, 2147483647);

  if (path === "tickets")
    return exactKeys(value, ["subject", "message"]) &&
      boundedText(value.subject, 120) && boundedText(value.message, 2000);

  const notification = /^notifications\/([0-9a-f-]+)\/read$/i.exec(path);
  if (notification && commerceId(notification[1]))
    return exactKeys(value, []);

  return false;
}

function parse(raw: string | null): StaffIntent | null {
  if (raw === null) return null;
  if (raw.length > maxStored)
    throw Error("Pending seller commerce state is too large.");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw Error("Pending seller commerce state is invalid.");
  }
  const value = row(parsed);
  if (!value || !exactKeys(value, ["version", "scope", "path", "body", "key"]) ||
      value.version !== 1 || value.scope !== "seller-commerce" ||
      typeof value.path !== "string" || typeof value.body !== "string" ||
      value.body.length > 8192 || !commerceId(value.key))
    throw Error("Pending seller commerce state is invalid.");

  let body: unknown;
  try { body = JSON.parse(value.body); } catch {
    throw Error("Pending seller commerce body is invalid.");
  }
  if (!validIntent(value.path, body) || JSON.stringify(body) !== value.body)
    throw Error("Pending seller commerce body is not canonical.");

  return Object.freeze({
    path: value.path,
    body: value.body,
    key: value.key,
  });
}

function storage(): Storage {
  if (typeof window === "undefined")
    throw Error("Pending seller commerce storage unavailable.");
  try {
    return window.sessionStorage;
  } catch {
    throw Error("Pending seller commerce storage unavailable.");
  }
}

export function restoreSellerCommerceIntent(): StaffIntent | null {
  return parse(storage().getItem(storageKey));
}

export function persistSellerCommerceIntent(intent: StaffIntent) {
  if (!commerceId(intent.key) || intent.body.length > 8192)
    throw Error("Pending seller commerce intent is invalid.");

  let body: unknown;
  try { body = JSON.parse(intent.body); } catch {
    throw Error("Pending seller commerce intent is invalid.");
  }
  if (!validIntent(intent.path, body) || JSON.stringify(body) !== intent.body)
    throw Error("Pending seller commerce intent is invalid.");

  const store = storage();
  const existing = store.getItem(storageKey);
  if (existing !== null) {
    const restored = parse(existing);
    if (!restored || restored.key !== intent.key ||
        restored.path !== intent.path || restored.body !== intent.body)
      throw Error("Another pending seller commerce intent must be resolved first.");
    return;
  }

  const record = JSON.stringify({
    version: 1,
    scope: "seller-commerce",
    path: intent.path,
    body: intent.body,
    key: intent.key,
  });
  if (record.length > maxStored)
    throw Error("Pending seller commerce state is too large.");
  store.setItem(storageKey, record);
  window.dispatchEvent(new Event(changeEvent));
}

export function clearSellerCommerceIntent(expectedKey: string) {
  if (!commerceId(expectedKey)) return false;
  let store: Storage;
  try { store = storage(); } catch { return false; }

  const raw = store.getItem(storageKey);
  if (raw === null) return true;

  let restored: StaffIntent | null;
  try { restored = parse(raw); } catch { return false; }
  if (!restored || restored.key !== expectedKey) return false;
  store.removeItem(storageKey);
  window.dispatchEvent(new Event(changeEvent));
  return true;
}

export function subscribeSellerCommerceIntent(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(changeEvent, listener);
  return () => window.removeEventListener(changeEvent, listener);
}
