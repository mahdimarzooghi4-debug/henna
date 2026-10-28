export type LandingPreviewProduct = {
  id: string;
  title: string;
  detail: string;
  image: string;
  badge?: string;
  oldPrice?: string;
  price: string;
};

export const LANDING_PREVIEW_PRODUCTS: LandingPreviewProduct[] = [
  { id: "cheese", title: "پنیر سفید ایرانی ممتاز", detail: "۴۰۰ گرم - لبنیات هراز", image: "product-1.png", badge: "ویژه کالابرگ", oldPrice: "۶۵,۰۰۰", price: "۵۴,۰۰۰" },
  { id: "yogurt", title: "ماست سون همزده پرچرب", detail: "۹۰۰ گرم - کاله", image: "product-2.png", badge: "تخفیف ویژه", price: "۴۸,۵۰۰" },
  { id: "rice", title: "برنج هاشمی درجه یک", detail: "۵ کیلوگرم - کشتزار شمال", image: "product-3.png", badge: "طرح حمایتی", oldPrice: "۷۲۰,۰۰۰", price: "۶۴۰,۰۰۰" },
  { id: "oil", title: "روغن آفتابگردان خالص", detail: "۱.۵ لیتر - لادن", image: "product-4.png", price: "۸۹,۰۰۰" },
  { id: "tea", title: "چای سیاه ارگانیک لاهیجان", detail: "۴۵۰ گرم - ممتاز باروتی", image: "product-5.png", badge: "تخفیف ویژه", oldPrice: "۱۴۵,۰۰۰", price: "۱۲۸,۰۰۰" },
];

export type LandingPreviewCartItem = {
  productId: string;
  quantity: number;
};

export const LANDING_PREVIEW_CART_EVENT = "henna:landing-preview-cart-changed";

const storageKey = "henna:landing-preview-cart:v1";
const validProductIds = new Set(LANDING_PREVIEW_PRODUCTS.map((product) => product.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readLandingPreviewCart(): LandingPreviewCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const quantities = new Map<string, number>();
    for (const value of raw) {
      if (!isRecord(value) || typeof value.productId !== "string" ||
        !validProductIds.has(value.productId) ||
        !Number.isInteger(value.quantity) || (value.quantity as number) < 1 ||
        (value.quantity as number) > 99) continue;
      quantities.set(value.productId,
        Math.min(99, (quantities.get(value.productId) ?? 0) + (value.quantity as number)));
    }
    return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
  } catch {
    return [];
  }
}

export function saveLandingPreviewCart(items: LandingPreviewCartItem[]): boolean {
  if (typeof window === "undefined") return false;
  const normalized = items
    .filter((item) => validProductIds.has(item.productId) &&
      Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function addLandingPreviewProduct(productId: string):
  "added" | "limit" | "unavailable" {
  if (!validProductIds.has(productId)) return "unavailable";
  const cart = readLandingPreviewCart();
  const item = cart.find((entry) => entry.productId === productId);
  if (item?.quantity === 99) return "limit";
  if (item) item.quantity += 1;
  else cart.push({ productId, quantity: 1 });
  return saveLandingPreviewCart(cart) ? "added" : "unavailable";
}

export function setLandingPreviewQuantity(productId: string, quantity: number): boolean {
  if (!validProductIds.has(productId) || !Number.isInteger(quantity) ||
    quantity < 1 || quantity > 99) return false;
  const cart = readLandingPreviewCart();
  const item = cart.find((entry) => entry.productId === productId);
  if (!item) return false;
  item.quantity = quantity;
  return saveLandingPreviewCart(cart);
}

export function removeLandingPreviewProduct(productId: string): boolean {
  const cart = readLandingPreviewCart();
  return saveLandingPreviewCart(cart.filter((item) => item.productId !== productId));
}
