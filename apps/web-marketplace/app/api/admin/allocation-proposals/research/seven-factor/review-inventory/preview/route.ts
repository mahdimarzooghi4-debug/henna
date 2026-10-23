import { NextRequest } from "next/server";
import { forwardSevenFactorEvidence } from "../../../../../../../../lib/server-seven-factor-evidence";

export function POST(request: NextRequest) {
  return forwardSevenFactorEvidence(request, true);
}
