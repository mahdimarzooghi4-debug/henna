import { catalogGet, parseCategories } from "../../../../lib/server-catalog";

export async function GET() {
  return catalogGet("/api/v1/catalog/categories", parseCategories);
}
