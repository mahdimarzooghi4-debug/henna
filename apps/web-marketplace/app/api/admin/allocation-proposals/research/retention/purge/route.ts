import { NextRequest } from "next/server";
import { forwardAllocationRetention } from "../../../../../../../lib/server-allocation-retention";

export function POST(request: NextRequest) {
  return forwardAllocationRetention(request, "purge");
}
