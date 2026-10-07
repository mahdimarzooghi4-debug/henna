import { NextRequest } from "next/server";
import { forwardAllocationShadowBenchmarks } from "../../../../../../lib/server-allocation-shadow-benchmarks";

export function GET(request: NextRequest) {
  return forwardAllocationShadowBenchmarks(request);
}
