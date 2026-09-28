import { NextRequest } from "next/server";
import { mutateSellerOffer } from "../../../../../../lib/seller-offer-mutation-bff";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ offerId: string }> },
) {
  const { offerId } = await context.params;
  return mutateSellerOffer(request, offerId, "publish");
}
