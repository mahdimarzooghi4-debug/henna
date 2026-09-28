export type ReferenceCartItem = { productId: string; quantity: number; unitName: string; quantityScale: number };
export type ReferenceCart = { revision: number; items: ReferenceCartItem[] };
type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => x !== null && typeof x === "object" && !Array.isArray(x);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseReferenceCart(raw: unknown): ReferenceCart | null {
  if (!object(raw) || !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 0 || !Array.isArray(raw.items) || raw.items.length > 100) return null;
  const items: ReferenceCartItem[] = [], seen = new Set<string>();
  for (const value of raw.items) {
    if (!object(value) || Object.keys(value).sort().join("|") !== "productId|quantity|quantityScale|unitName" || typeof value.productId !== "string" || !uuid.test(value.productId) || value.productId === "00000000-0000-0000-0000-000000000000" || typeof value.quantity !== "number" || !Number.isFinite(value.quantity) || value.quantity <= 0 || value.quantity > 1_000_000_000_000 || typeof value.unitName !== "string" || !value.unitName.trim() || value.unitName.length > 40 || !Number.isInteger(value.quantityScale) || (value.quantityScale as number) < 0 || (value.quantityScale as number) > 6 || seen.has(value.productId.toLowerCase())) return null;
    const factor = 10 ** (value.quantityScale as number);
    if (Math.abs(value.quantity * factor - Math.round(value.quantity * factor)) > 1e-7) return null;
    seen.add(value.productId.toLowerCase());
    items.push({ productId: value.productId, quantity: value.quantity, unitName: value.unitName, quantityScale: value.quantityScale as number });
  }
  return { revision: raw.revision as number, items };
}
