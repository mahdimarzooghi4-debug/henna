export type BuyerDemoCartItem = {
  id: string;
  name: string;
  detail: string;
  kind: "GOOD" | "SERVICE";
  quantity: number;
  unitPrice: number | null;
  image: string | null;
};

const CART_KEY = "henna.buyer-demo-cart.v1";
const CART_EVENT = "henna:buyer-demo-cart-change";

function isCartItem(value: unknown): value is BuyerDemoCartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && item.id.length > 0 && item.id.length <= 80 &&
    typeof item.name === "string" && item.name.length > 0 && item.name.length <= 200 &&
    typeof item.detail === "string" && item.detail.length <= 200 &&
    (item.kind === "GOOD" || item.kind === "SERVICE") &&
    Number.isSafeInteger(item.quantity) && (item.quantity as number) >= 1 && (item.quantity as number) <= 99 &&
    (item.unitPrice === null || Number.isSafeInteger(item.unitPrice) && (item.unitPrice as number) >= 0) &&
    (item.image === null || typeof item.image === "string" && item.image.startsWith("/"));
}

export function readBuyerDemoCart(): BuyerDemoCartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem).slice(0, 50) : [];
  } catch { return []; }
}

export function writeBuyerDemoCart(items: BuyerDemoCartItem[]) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items.filter(isCartItem).slice(0, 50)));
    window.dispatchEvent(new Event(CART_EVENT));
  } catch { /* Private browsing/storage restrictions leave the UI usable. */ }
}

export function addBuyerDemoCartItem(item: Omit<BuyerDemoCartItem, "quantity">) {
  const cart = readBuyerDemoCart();
  const current = cart.find((entry) => entry.id === item.id);
  if (current) current.quantity = Math.min(99, current.quantity + 1);
  else cart.push({ ...item, quantity: 1 });
  writeBuyerDemoCart(cart);
}

export function buyerDemoCartCount(items: BuyerDemoCartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function buyerDemoCartEventName() { return CART_EVENT; }

export function formatBuyerDemoPrice(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value) + " تومان";
}

export type BuyerDemoOrder = {
  code: string;
  storeId: string;
  storeName: string;
  address: string;
  recipient: string;
  phone: string;
  payment: "online" | "cash" | "credit";
  items: BuyerDemoCartItem[];
  total: number | null;
};

export const BUYER_DEMO_ORDER_KEY = "henna.buyer-demo-order.v1";
export const BUYER_DEMO_STORE_KEY = "henna.buyer-demo-store.v1";

export function readBuyerDemoOrder(): BuyerDemoOrder | null {
  try {
    const raw = window.localStorage.getItem(BUYER_DEMO_ORDER_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const order = value as Record<string, unknown>;
    if (typeof order.code !== "string" || typeof order.storeId !== "string" ||
      typeof order.storeName !== "string" || typeof order.address !== "string" ||
      typeof order.recipient !== "string" || typeof order.phone !== "string" ||
      !Array.isArray(order.items) || !order.items.every(isCartItem) ||
      !(order.payment === "online" || order.payment === "cash" || order.payment === "credit") ||
      !(order.total === null || Number.isSafeInteger(order.total))) return null;
    return order as BuyerDemoOrder;
  } catch { return null; }
}
