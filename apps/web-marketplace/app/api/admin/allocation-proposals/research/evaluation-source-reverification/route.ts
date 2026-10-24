import { NextRequest } from "next/server";
import { forwardEvaluationSourceReverification } from "../../../../../../lib/server-evaluation-source-reverification";
export function POST(request:NextRequest) {
  return forwardEvaluationSourceReverification(request);
}
