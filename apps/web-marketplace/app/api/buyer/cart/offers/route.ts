import { NextRequest } from "next/server";
import { cartError, forwardBuyerCartOffers } from "../../../../../lib/buyer-cart-bff";

export async function GET(request: NextRequest) {
  if ([...request.nextUrl.searchParams.keys()].length)
    return cartError(400, "پارامترهای درخواست معتبر نیست.");
  return forwardBuyerCartOffers(request);
}
