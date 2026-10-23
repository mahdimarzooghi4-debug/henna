import { NextRequest } from "next/server";
import { forwardPartitionPreflight } from "../../../../../../../../lib/server-seven-factor-partitions";

export function POST(request: NextRequest) {
  return forwardPartitionPreflight(request, true);
}
