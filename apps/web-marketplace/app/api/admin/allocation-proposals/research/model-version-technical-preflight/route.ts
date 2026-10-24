import { NextRequest } from "next/server";
import { forwardModelVersionTechnicalPreflight } from "../../../../../../lib/server-model-version-technical-preflight";

export function POST(request: NextRequest) {
  return forwardModelVersionTechnicalPreflight(request);
}
