import { NextRequest } from "next/server";
import { forwardAllocationOutcomes } from "../../../../../../lib/server-allocation-outcomes";

export function GET(request: NextRequest) {
  return forwardAllocationOutcomes(request);
}

export function POST(request: NextRequest) {
  return forwardAllocationOutcomes(request);
}
