import { NextRequest } from "next/server";
import { forwardResearch } from "../../../../../../../lib/server-allocation-research";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) { return forwardResearch(request, "runs", (await context.params).id); }
