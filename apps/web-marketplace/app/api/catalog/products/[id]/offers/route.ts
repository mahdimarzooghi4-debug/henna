import { NextRequest } from "next/server";
import {
  BUYER_OFFERS_PAGE_SIZE, parseBuyerOfferPage, validBuyerProductId,
} from "../../../../../../lib/buyer-catalog";
import { catalogError, catalogGet } from "../../../../../../lib/server-catalog";

export async function GET(
  request: NextRequest, context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!validBuyerProductId(id))
    return catalogError(404, "پیشنهاد منتشرشده‌ای برای این کالا پیدا نشد.");
  const params = request.nextUrl.searchParams;
  if ([...params.keys()].some((key) =>
    !["page", "pageSize"].includes(key) || params.getAll(key).length !== 1))
    return catalogError(400, "پارامترهای صفحه‌بندی معتبر نیست.");
  const pageRaw = params.get("page");
  const sizeRaw = params.get("pageSize");
  const page = pageRaw === null ? 1 : Number(pageRaw);
  const pageSize = sizeRaw === null ? BUYER_OFFERS_PAGE_SIZE : Number(sizeRaw);
  if ((pageRaw !== null && !/^[1-9][0-9]*$/.test(pageRaw)) ||
    (sizeRaw !== null && !/^[1-9][0-9]*$/.test(sizeRaw)) ||
    !Number.isSafeInteger(page) || page < 1 || page > 10000 ||
    !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50)
    return catalogError(400, "پارامترهای صفحه‌بندی معتبر نیست.");
  const query = new URLSearchParams({
    page: String(page), pageSize: String(pageSize),
  });
  return catalogGet(
    "/api/v1/catalog/products/" + id + "/offers?" + query,
    (value) => parseBuyerOfferPage(value, page, pageSize),
  );
}
