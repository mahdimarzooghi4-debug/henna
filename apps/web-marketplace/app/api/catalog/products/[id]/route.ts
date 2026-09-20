import {
  catalogError, catalogGet, parseProduct, validCatalogId,
} from "../../../../../lib/server-catalog";

export async function GET(
  _request: Request, context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!validCatalogId(id))
    return catalogError(404, "این کالا یا خدمت در کاتالوگ منتشرشده پیدا نشد.");
  return catalogGet("/api/v1/catalog/products/" + id, parseProduct, true);
}
