import { NextRequest } from "next/server";
import { forwardSevenFactorEvidence } from "../../../../../../../lib/server-seven-factor-evidence";

export function GET(request: NextRequest) {
  return forwardSevenFactorEvidence(request, false);
}
