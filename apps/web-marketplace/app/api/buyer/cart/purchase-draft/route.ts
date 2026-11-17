import { NextRequest } from "next/server";
import { handleBuyerPurchaseDraft } from "../../../../../lib/buyer-cart-bff";

export async function GET(request: NextRequest) {
  return handleBuyerPurchaseDraft(request);
}

export async function PUT(request: NextRequest) {
  return handleBuyerPurchaseDraft(request);
}

export async function DELETE(request: NextRequest) {
  return handleBuyerPurchaseDraft(request);
}
