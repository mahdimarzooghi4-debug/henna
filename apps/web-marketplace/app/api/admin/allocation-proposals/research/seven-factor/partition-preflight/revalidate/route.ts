import { NextRequest } from "next/server";
import { forwardSevenFactorManifestRevalidation } from "../../../../../../../../lib/server-seven-factor-manifest-revalidation";

export function POST(request: NextRequest) {
  return forwardSevenFactorManifestRevalidation(request);
}
