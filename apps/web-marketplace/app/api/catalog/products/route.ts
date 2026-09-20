import { NextRequest } from "next/server";
import {
  catalogError, catalogGet, parseProducts, validCatalogId,
} from "../../../../lib/server-catalog";

const allowed = new Set(["page", "pageSize", "categoryId", "search"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if ([...params.keys()].some((key) =>
    !allowed.has(key) || params.getAll(key).length !== 1))
    return catalogError(400, "پارامترهای فهرست معتبر نیست.");

  const pageRaw = params.get("page");
  const sizeRaw = params.get("pageSize");
  const page = pageRaw === null ? 1 : Number(pageRaw);
  const pageSize = sizeRaw === null ? 20 : Number(sizeRaw);
  const categoryId = params.get("categoryId");
  const search = params.get("search")?.trim();

  if ((pageRaw !== null && !/^[1-9][0-9]*$/.test(pageRaw)) ||
    (sizeRaw !== null && !/^[1-9][0-9]*$/.test(sizeRaw)) ||
    !Number.isSafeInteger(page) || page < 1 || page > 10000 ||
    !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 50 ||
    (categoryId !== null && !validCatalogId(categoryId)) ||
    (search !== undefined && (search.length > 80 ||
      /[\u0000-\u001f\u007f]/.test(search))))
    return catalogError(400, "پارامترهای جست‌وجو یا صفحه‌بندی معتبر نیست.");

  const query = new URLSearchParams({
    page: String(page), pageSize: String(pageSize),
  });
  if (categoryId !== null) query.set("categoryId", categoryId);
  if (search) query.set("search", search);
  return catalogGet("/api/v1/catalog/products?" + query, parseProducts);
}
