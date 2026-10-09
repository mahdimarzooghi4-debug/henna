import { NextRequest } from "next/server";
import { forwardProposal } from "../../../../../lib/server-allocation-proposals";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return forwardProposal(request, (await context.params).id);
}
