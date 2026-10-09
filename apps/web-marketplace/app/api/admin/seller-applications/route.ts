import { NextRequest } from "next/server";
import { forwardAdminSeller } from "../../../../lib/server-admin-sellers";

export const GET = (request: NextRequest) =>
  forwardAdminSeller(request, [], "GET");
