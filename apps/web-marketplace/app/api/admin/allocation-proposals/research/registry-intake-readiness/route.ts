import { NextRequest } from "next/server";
import { forwardRegistryIntakeReadiness } from "../../../../../../lib/server-registry-intake-readiness";

export function POST(request: NextRequest) {
  return forwardRegistryIntakeReadiness(request);
}
