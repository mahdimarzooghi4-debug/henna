import { NextRequest } from "next/server";
import { forwardAllocationRetention } from "../../../../../../../lib/server-allocation-retention";

export function GET(request: NextRequest) {
  return forwardAllocationRetention(request, "events");
}
