import { commerceId } from "../../../packages/buyer-commerce/contracts.ts";
import {
  mobileCommerceIntent, type MobileCommerceIntent,
} from "./mobile-commerce.ts";

export type PendingCommerceScope =
  "cart" | "checkout" | "orders" | "incidents";

export type PendingIncidentContext = {
  orderId: string;
  itemId: string;
  type: "DAMAGED_ITEM" | "MISSING_ITEM";
  quantity: number;
  photoUri: string;
};

export type RestoredPendingCommerce = {
  scope: PendingCommerceScope;
  intent: MobileCommerceIntent;
  incident: PendingIncidentContext | null;
};

export type PendingCommerceRoute = {
  screen: PendingCommerceScope;
  selectedOrderId: string | null;
  incidentOrderId: string | null;
};

export interface PendingTextStore {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
}

export interface PendingPhotoStore {
  readBase64(uri: string): Promise<string>;
  remove(uri: string): Promise<void>;
  cleanup(keepUri: string | null): Promise<void>;
}

type StoredPending = {
  version: 1;
  scope: PendingCommerceScope;
  path: string;
  key: string;
  body?: string;
  incident?: PendingIncidentContext;
};

const scopes = new Set<PendingCommerceScope>([
  "cart", "checkout", "orders", "incidents",
]);

function allowed(scope: PendingCommerceScope, path: string) {
  if (scope === "cart") return path === "cart-items";
  if (scope === "checkout")
    return ["addresses", "quotes", "orders"].includes(path);
  if (scope === "orders")
    return /^orders\/[0-9a-f-]+\/(cancel|pickup-confirmation)$/i.test(path);
  return path === "evidence" ||
    /^orders\/[0-9a-f-]+\/incidents$/i.test(path) ||
    /^item-returns\/[0-9a-f-]+\/confirm-collection$/i.test(path);
}

function incidentContext(value: unknown): PendingIncidentContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const x = value as Record<string, unknown>;
  if (!commerceId(x.orderId) || !commerceId(x.itemId) ||
      !["DAMAGED_ITEM", "MISSING_ITEM"].includes(String(x.type)) ||
      !Number.isSafeInteger(x.quantity) || Number(x.quantity) < 1 ||
      Number(x.quantity) > 999 || typeof x.photoUri !== "string" ||
      x.photoUri.length < 8 || x.photoUri.length > 2048 ||
      !x.photoUri.startsWith("file://")) return null;
  return {
    orderId: x.orderId,
    itemId: x.itemId,
    type: x.type as PendingIncidentContext["type"],
    quantity: Number(x.quantity),
    photoUri: x.photoUri,
  };
}

function parseStored(raw: string | null): StoredPending | null {
  if (raw === null || raw.length > 16384) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const x = value as Record<string, unknown>;
  if (x.version !== 1 || !scopes.has(x.scope as PendingCommerceScope) ||
      typeof x.path !== "string" || !allowed(x.scope as PendingCommerceScope, x.path) ||
      !commerceId(x.key)) return null;

  const incident = x.incident === undefined ? null : incidentContext(x.incident);
  if (x.incident !== undefined && incident === null) return null;

  if (x.path === "evidence") {
    if (x.scope !== "incidents" || incident === null || x.body !== undefined)
      return null;
  } else {
    if (typeof x.body !== "string" || x.body.length > 8192) return null;
    let input: unknown;
    try { input = JSON.parse(x.body); } catch { return null; }
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    try {
      const rebuilt = mobileCommerceIntent(
        x.path, input as object, x.key as string);
      if (rebuilt.body !== x.body) return null;
    } catch { return null; }
  }
  return {
    version: 1,
    scope: x.scope as PendingCommerceScope,
    path: x.path,
    key: x.key as string,
    ...(x.body !== undefined ? { body: x.body as string } : {}),
    ...(incident ? { incident } : {}),
  };
}

function orderFromPath(path: string): string | null {
  const match = /^orders\/([0-9a-f-]+)\//i.exec(path);
  return match && commerceId(match[1]) ? match[1].toLowerCase() : null;
}

export class MobilePendingCommerceStore {
  private readonly text: PendingTextStore;
  private readonly photos: PendingPhotoStore;
  constructor(text: PendingTextStore, photos: PendingPhotoStore) {
    this.text=text;
    this.photos=photos;
  }

  private async stored(): Promise<StoredPending | null> {
    const raw=await this.text.read();
    if(raw===null)return null;
    const parsed=parseStored(raw);
    if(!parsed)throw Error("Pending commerce state is invalid.");
    return parsed;
  }

  private record(
    scope: PendingCommerceScope,
    intent: MobileCommerceIntent,
    incident: PendingIncidentContext | null,
  ): StoredPending {
    if (!scopes.has(scope) || !allowed(scope, intent.path) ||
        !commerceId(intent.key)) throw Error("Invalid pending commerce intent.");
    const parsedIncident = incident === null ? null : incidentContext(incident);
    if (incident !== null && parsedIncident === null)
      throw Error("Invalid incident recovery context.");

    if (intent.path === "evidence") {
      if (scope !== "incidents" || !parsedIncident)
        throw Error("Evidence recovery context required.");
      let input: unknown;
      try { input = JSON.parse(intent.body); } catch { throw Error(); }
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          (input as Record<string, unknown>).contentType !== "image/jpeg" ||
          typeof (input as Record<string, unknown>).contentBase64 !== "string")
        throw Error("Invalid evidence intent.");
      return {
        version: 1, scope, path: intent.path, key: intent.key,
        incident: parsedIncident,
      };
    }
    if (intent.body.length > 8192)
      throw Error("Pending commerce body too large.");
    const restored = mobileCommerceIntent(
      intent.path, JSON.parse(intent.body) as object, intent.key);
    if (restored.body !== intent.body)
      throw Error("Pending commerce body is not stable.");
    return {
      version: 1, scope, path: intent.path, key: intent.key,
      body: intent.body,
      ...(parsedIncident ? { incident: parsedIncident } : {}),
    };
  }

  async route(): Promise<PendingCommerceRoute | null> {
    const stored = await this.stored();
    if (!stored) return null;
    return {
      screen: stored.scope,
      selectedOrderId: stored.scope === "orders"
        ? orderFromPath(stored.path) : null,
      incidentOrderId: stored.scope === "incidents"
        ? stored.incident?.orderId ?? orderFromPath(stored.path) : null,
    };
  }

  async save(
    scope: PendingCommerceScope,
    intent: MobileCommerceIntent,
    incident: PendingIncidentContext | null = null,
  ): Promise<void> {
    const record=this.record(scope,intent,incident);
    const existing=await this.stored();
    if(existing){
      if(existing.key!==record.key ||
          JSON.stringify(existing)!==JSON.stringify(record))
        throw Error("Another pending commerce intent must be resolved first.");
      return;
    }
    await this.text.write(JSON.stringify(record));
  }

  async advance(
    expectedKey: string,
    scope: PendingCommerceScope,
    intent: MobileCommerceIntent,
    incident: PendingIncidentContext | null = null,
  ): Promise<void> {
    if(!commerceId(expectedKey))throw Error("Invalid prior intent key.");
    const existing=await this.stored();
    if(!existing||existing.key!==expectedKey)
      throw Error("Prior pending intent changed.");
    const record=this.record(scope,intent,incident);
    await this.text.write(JSON.stringify(record));
  }

  async restore(
    expectedScope: PendingCommerceScope,
  ): Promise<RestoredPendingCommerce | null> {
    const stored = await this.stored();
    if (!stored || stored.scope !== expectedScope) return null;
    if (stored.path === "evidence") {
      const incident = stored.incident!;
      const base64 = await this.photos.readBase64(incident.photoUri);
      const intent = mobileCommerceIntent("evidence", {
        contentType: "image/jpeg",
        contentBase64: base64,
      }, stored.key);
      return { scope: stored.scope, intent, incident };
    }
    return {
      scope: stored.scope,
      intent: Object.freeze({
        path: stored.path, body: stored.body!, key: stored.key,
      }),
      incident: stored.incident ?? null,
    };
  }

  async clear(expectedKey: string): Promise<boolean> {
    if (!commerceId(expectedKey)) return false;
    const stored = await this.stored();
    if (!stored) return true;
    if (stored.key !== expectedKey) return false;
    await this.text.remove();
    if (stored.incident?.photoUri) {
      try { await this.photos.remove(stored.incident.photoUri); }
      catch { /* startup cleanup handles a local orphan */ }
    }
    return true;
  }

  async discardPhoto(uri: string): Promise<void> {
    await this.photos.remove(uri);
  }

  async cleanupPhotos(): Promise<void> {
    const stored = await this.stored();
    await this.photos.cleanup(stored?.incident?.photoUri ?? null);
  }
}
