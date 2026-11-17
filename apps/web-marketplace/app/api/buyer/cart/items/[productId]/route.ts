import { NextRequest } from "next/server";
import { cartError, forwardBuyerCart, validBuyerCartId } from "../../../../../../lib/buyer-cart-bff";
type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => x !== null && typeof x === "object" && !Array.isArray(x);

export async function PUT(request: NextRequest,
  context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  if (!validBuyerCartId(productId)) return cartError(404, "کالا پیدا نشد.");
  if ([...request.nextUrl.searchParams.keys()].length)
    return cartError(400, "پارامترهای درخواست معتبر نیست.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return cartError(400, "درخواست نامعتبر است.");
  try {
    const text = await request.text();
    if (text.length > 4096) return cartError(400, "درخواست بیش از حد بزرگ است.");
    const value: unknown = JSON.parse(text);
    if (!object(value) || Object.keys(value).sort().join("|") !== "quantity|revision" ||
      !Number.isSafeInteger(value.revision) || (value.revision as number) < 0 ||
      typeof value.quantity !== "number" || !Number.isFinite(value.quantity) ||
      value.quantity <= 0 || value.quantity > 1_000_000_000_000)
      return cartError(400, "مقدار یا نسخهٔ سبد معتبر نیست.");
    return forwardBuyerCart(request, "PUT", productId,
      { revision: value.revision as number, quantity: value.quantity });
  } catch { return cartError(400, "درخواست معتبر نیست."); }
}

export async function DELETE(request: NextRequest,
  context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  if (!validBuyerCartId(productId)) return cartError(404, "کالا پیدا نشد.");
  if ([...request.nextUrl.searchParams.keys()].some(k => k !== "revision") ||
    request.nextUrl.searchParams.getAll("revision").length !== 1 ||
    !/^(0|[1-9][0-9]*)$/.test(request.nextUrl.searchParams.get("revision") ?? ""))
    return cartError(400, "نسخهٔ سبد معتبر نیست.");
  const revision = Number(request.nextUrl.searchParams.get("revision"));
  if (!Number.isSafeInteger(revision)) return cartError(400, "نسخهٔ سبد معتبر نیست.");
  return forwardBuyerCart(request, "DELETE", productId, { revision });
}
