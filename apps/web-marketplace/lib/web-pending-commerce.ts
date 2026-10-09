import { commerceId } from "../../../packages/buyer-commerce/contracts.ts";
import type { CommerceIntent } from "./buyer-commerce";

const key = "hana.buyer.pending-commerce.v1";
const maxStored = 12000;

function row(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function exactKeys(x: Record<string, unknown>, names: string[]) {
  const actual = Object.keys(x).sort();
  const expected = [...names].sort();
  return actual.length === expected.length &&
    actual.every((name, index) => name === expected[index]);
}
function int(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= min && value <= max;
}
function number(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= min && value <= max;
}
function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 &&
    value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

export type WebPendingScope = "cart" | "checkout" | "orders" | "support" | "wallet";

function validBody(scope: WebPendingScope, path: string, value: unknown) {
  const x = row(value);
  if (!x) return false;

  if (scope === "cart" && path === "cart-items")
    return exactKeys(x, ["productId","quantity","expectedVersion"]) &&
      commerceId(x.productId) && int(x.quantity,0,999) &&
      int(x.expectedVersion,0,2147483647);

  if (scope === "checkout" && path === "addresses")
    return exactKeys(x,["addressId","cityId","text","latitude","longitude"]) &&
      commerceId(x.addressId) && commerceId(x.cityId) && text(x.text,1000) &&
      number(x.latitude,-90,90) && number(x.longitude,-180,180);

  if (scope === "checkout" && path === "quotes")
    return exactKeys(x,["sellerId","addressId","purchaseType","fulfillmentMode"]) &&
      commerceId(x.sellerId) && commerceId(x.addressId) &&
      ["PERSONAL","LEGAL"].includes(String(x.purchaseType)) &&
      x.fulfillmentMode === "PICKUP";

  if (scope === "checkout" && path === "orders")
    return exactKeys(x,[
      "quoteId","creditGrantId","unavailableDisposition","confirmUnavailable",
    ]) &&
      commerceId(x.quoteId) &&
      (x.creditGrantId === null || commerceId(x.creditGrantId)) &&
      ["KEEP","REMOVE"].includes(String(x.unavailableDisposition)) &&
      typeof x.confirmUnavailable === "boolean";

  if (scope === "orders" &&
      /^orders\/[0-9a-f-]+\/(cancel|pickup-confirmation)$/i.test(path)) {
    const id = path.split("/")[1];
    return commerceId(id) && exactKeys(x,["expectedVersion"]) &&
      int(x.expectedVersion,1,2147483647);
  }
  if (scope === "support" && path === "tickets")
    return exactKeys(x,["subject","message"]) &&
      text(x.subject,120) && text(x.message,2000);
  if (scope === "support" &&
      /^notifications\/[0-9a-f-]+\/read$/i.test(path)) {
    const id = path.split("/")[1];
    return commerceId(id) && exactKeys(x,[]);
  }
  if (scope === "wallet" && path === "withdrawals")
    return exactKeys(x,["amountRial","ibanVerificationRequestReference"]) &&
      int(x.amountRial,1,Number.MAX_SAFE_INTEGER) &&
      text(x.ibanVerificationRequestReference,240);
  if (scope === "wallet" &&
      /^withdrawals\/[0-9a-f-]+\/cancel$/i.test(path)) {
    const id = path.split("/")[1];
    return commerceId(id) && exactKeys(x,[]);
  }
  return false;
}

function parse(raw: string | null, scope: WebPendingScope):
  CommerceIntent | null {
  if (raw === null) return null;
  if (raw.length > maxStored) throw Error("Pending commerce state is too large.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw Error("Pending commerce state is invalid.");
  }
  const x = row(parsed);
  if (!x || x.version !== 1 || x.scope !== scope ||
      typeof x.path !== "string" || typeof x.body !== "string" ||
      x.body.length > 8192 || !commerceId(x.key))
    throw Error("Pending commerce state is invalid.");
  let body: unknown;
  try { body = JSON.parse(x.body); } catch {
    throw Error("Pending commerce body is invalid.");
  }
  if (!validBody(scope,x.path,body) ||
      JSON.stringify(body) !== x.body)
    throw Error("Pending commerce body is not canonical.");
  return Object.freeze({
    path:x.path,
    body:x.body,
    key:x.key,
  });
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function restoreWebCommerceIntent(scope: WebPendingScope):
  CommerceIntent | null {
  const store=storage();
  if (!store) return null;
  return parse(store.getItem(key),scope);
}

export function persistWebCommerceIntent(
  scope: WebPendingScope,
  intent: CommerceIntent,
) {
  if (!commerceId(intent.key) || intent.body.length > 8192)
    throw Error("Pending commerce intent is invalid.");
  let body: unknown;
  try { body=JSON.parse(intent.body); } catch { throw Error(); }
  if (!validBody(scope,intent.path,body) ||
      JSON.stringify(body)!==intent.body)
    throw Error("Pending commerce intent is invalid.");
  const store=storage();
  if (!store) throw Error("Pending commerce storage unavailable.");
  const existing=store.getItem(key);
  if (existing !== null) {
    const restored=parse(existing,scope);
    if (!restored || restored.key!==intent.key ||
        restored.path!==intent.path || restored.body!==intent.body)
      throw Error("Another pending commerce intent must be resolved first.");
    return;
  }
  const record=JSON.stringify({
    version:1,scope,path:intent.path,body:intent.body,key:intent.key,
  });
  if(record.length>maxStored)throw Error("Pending commerce state is too large.");
  store.setItem(key,record);
}

export function clearWebCommerceIntent(expectedKey: string) {
  if(!commerceId(expectedKey))return false;
  const store=storage();
  if(!store)return false;
  const raw=store.getItem(key);
  if(raw===null)return true;
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{return false;}
  const x=row(parsed);
  if(!x||x.key!==expectedKey)return false;
  store.removeItem(key);
  return true;
}

export function discardWebCommerceIntent() {
  storage()?.removeItem(key);
}
