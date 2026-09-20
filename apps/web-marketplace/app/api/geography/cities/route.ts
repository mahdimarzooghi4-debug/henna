import { NextRequest } from "next/server";
import {
  geographyError, geographyGet, parseCities, validGeographyId,
} from "../../../../lib/server-geography";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const provinceId = query.get("provinceId");
  if ([...query.keys()].length !== 1 ||
    query.getAll("provinceId").length !== 1 ||
    provinceId === null || !validGeographyId(provinceId))
    return geographyError(400);

  const url = new URLSearchParams({ provinceId });
  return geographyGet("/api/v1/geography/cities?" + url,
    (value) => parseCities(value, provinceId));
}
