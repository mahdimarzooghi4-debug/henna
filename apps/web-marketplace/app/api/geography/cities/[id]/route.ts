import {
  geographyError, geographyGet, parseCity, validGeographyId,
} from "../../../../../lib/server-geography";

export async function GET(
  request: Request, context: { params: Promise<{ id: string }> },
) {
  if (new URL(request.url).search)
    return geographyError(400, "پارامتر اضافی معتبر نیست.");
  const { id } = await context.params;
  if (!validGeographyId(id)) return geographyError(404);
  return geographyGet("/api/v1/geography/cities/" + id, parseCity, true);
}
