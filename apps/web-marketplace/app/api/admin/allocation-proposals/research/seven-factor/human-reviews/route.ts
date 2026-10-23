import { NextRequest } from "next/server";
import { forwardPartitionPreflight } from "../../../../../../../lib/server-seven-factor-partitions";

export function GET(request: NextRequest) {
  return forwardPartitionPreflight(request, false);
}
