import { NextRequest } from "next/server";
import { forwardAllocationModelComparison } from "../../../../../../lib/server-allocation-model-comparison";

export function GET(request: NextRequest) {
  return forwardAllocationModelComparison(request);
}
