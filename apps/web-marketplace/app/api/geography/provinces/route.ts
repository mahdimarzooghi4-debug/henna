import {
  geographyError, geographyGet, parseProvinces,
} from "../../../../lib/server-geography";

export async function GET(request: Request) {
  if (new URL(request.url).search)
    return geographyError(400, "پارامتر اضافی برای استان‌ها معتبر نیست.");
  return geographyGet("/api/v1/geography/provinces", parseProvinces);
}
