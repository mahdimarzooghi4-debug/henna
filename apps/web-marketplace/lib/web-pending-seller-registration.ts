export type SellerRegistrationSubmitIntent = {
  revision: number;
  key: string;
  body: string;
};

const storageKey = "hana.seller.registration-submit.pending.v1";
const maxStored = 2000;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validRevision(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
}

function parseBody(body: string) {
  if (body.length > 1000) return null;
  let value: unknown;
  try { value = JSON.parse(body); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== 3 ||
      keys[0] !== "revision" ||
      keys[1] !== "idempotencyKey" ||
      keys[2] !== "confirmed" ||
      !validRevision(row.revision) ||
      typeof row.idempotencyKey !== "string" ||
      !uuid.test(row.idempotencyKey) ||
      row.confirmed !== true)
    return null;

  const canonical = JSON.stringify({
    revision: row.revision,
    idempotencyKey: row.idempotencyKey,
    confirmed: true,
  });
  if (canonical !== body) return null;
  return { revision: row.revision, key: row.idempotencyKey };
}

function parse(raw: string | null): SellerRegistrationSubmitIntent | null {
  if (raw === null) return null;
  if (raw.length > maxStored)
    throw Error("Pending seller registration submit is too large.");

  let value: unknown;
  try { value = JSON.parse(raw); } catch {
    throw Error("Pending seller registration submit is invalid.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Pending seller registration submit is invalid.");

  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== 4 ||
      keys[0] !== "version" ||
      keys[1] !== "revision" ||
      keys[2] !== "key" ||
      keys[3] !== "body" ||
      row.version !== 1 ||
      !validRevision(row.revision) ||
      typeof row.key !== "string" || !uuid.test(row.key) ||
      typeof row.body !== "string")
    throw Error("Pending seller registration submit is invalid.");

  const body = parseBody(row.body);
  if (!body || body.revision !== row.revision || body.key !== row.key)
    throw Error("Pending seller registration submit is invalid.");

  return Object.freeze({
    revision: row.revision,
    key: row.key,
    body: row.body,
  });
}

function storage(): Storage {
  if (typeof window === "undefined")
    throw Error("Pending seller registration storage unavailable.");
  try {
    return window.sessionStorage;
  } catch {
    throw Error("Pending seller registration storage unavailable.");
  }
}

export function sellerRegistrationSubmitIntent(
  revision: number,
  previous: SellerRegistrationSubmitIntent | null = null,
): SellerRegistrationSubmitIntent {
  if (!validRevision(revision))
    throw Error("Seller registration revision is invalid.");
  if (previous && previous.revision === revision) return previous;
  const key = crypto.randomUUID();
  return Object.freeze({
    revision,
    key,
    body: JSON.stringify({ revision, idempotencyKey: key, confirmed: true }),
  });
}

export function restoreSellerRegistrationSubmitIntent() {
  return parse(storage().getItem(storageKey));
}

export function persistSellerRegistrationSubmitIntent(
  intent: SellerRegistrationSubmitIntent,
) {
  const parsed = parseBody(intent.body);
  if (!parsed || parsed.revision !== intent.revision ||
      parsed.key !== intent.key || !uuid.test(intent.key))
    throw Error("Pending seller registration submit is invalid.");

  const store = storage();
  const existing = store.getItem(storageKey);
  if (existing !== null) {
    const restored = parse(existing);
    if (!restored || restored.key !== intent.key ||
        restored.revision !== intent.revision ||
        restored.body !== intent.body)
      throw Error("Another pending seller registration submit must be resolved first.");
    return;
  }

  store.setItem(storageKey, JSON.stringify({
    version: 1,
    revision: intent.revision,
    key: intent.key,
    body: intent.body,
  }));
}

export function clearSellerRegistrationSubmitIntent(expectedKey: string) {
  if (!uuid.test(expectedKey)) return false;
  let store: Storage;
  try { store = storage(); } catch { return false; }
  const raw = store.getItem(storageKey);
  if (raw === null) return true;
  let restored: SellerRegistrationSubmitIntent | null;
  try { restored = parse(raw); } catch { return false; }
  if (!restored || restored.key !== expectedKey) return false;
  store.removeItem(storageKey);
  return true;
}
