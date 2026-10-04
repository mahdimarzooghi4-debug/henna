import { NextRequest } from "next/server";
import { forwardProposal } from "../../../../lib/server-allocation-proposals";
export const GET = (request: NextRequest) => forwardProposal(request);
